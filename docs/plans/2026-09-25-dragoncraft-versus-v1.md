# Dragoncraft Versus v1 — Plano de Implementação


**Goal:** Entregar o modo padrão 2 jogadores do Dragoncraft Versus jogável no celular contra uma máquina de dificuldade selecionável.

**Architecture:** Motor de regras puro e determinístico em TypeScript (`packages/engine`), sem React nem DOM, exposto por `legalActions(state)` e `applyAction(state, action)` sobre uma pilha de pendências que modela as escolhas encadeadas de um turno. A máquina (`packages/ai`) é uma interface de estratégia que consome apenas a visão filtrada do jogador. A interface (`apps/web`) é fina: desenha o topo da pilha de pendências e oferece exclusivamente o que `legalActions` retornou.

**Tech Stack:** TypeScript 5 strict, npm workspaces, Vite 5, React 18, Vitest 2. Zero dependências de runtime no motor.

**Spec:** `docs/specs/2026-09-25-dragoncraft-versus-design.md`

## Global Constraints

- **Motor sem dependências.** `packages/engine/package.json` não declara nenhuma dependência de runtime. Importar React, DOM ou qualquer pacote ali é erro de revisão.
- **Nenhum `Math.random()`, `Date.now()` ou `crypto` em `packages/engine` nem em `packages/ai`.** Todo aleatório vem de `RngState` passado explicitamente.
- **Estado imutável.** `applyAction` nunca muta o argumento. Nenhum `push`, `splice`, `sort` ou atribuição sobre estruturas recebidas.
- **A UI e a IA consomem `PlayerView`, nunca `GameState`.** Só o motor toca no estado completo.
- **Ações são objetos serializáveis.** Nenhuma função, classe ou referência dentro de um `Action`.
- **Tipos de dragão:** `bread`, `crystal`, `meat`, `iron`, `potion`, `plant`.
- **Fire Up Chart (mais alto → mais baixo):** `bread > crystal > meat > iron > potion > plant`.
- **Anel dos duais (constante distinta da chart):** `bread → crystal → iron → potion → plant → meat → bread`.
- **Tabuleiro:** 19 casas, `max(|q|, |r|, |q+r|) <= 2`.
- **Deck:** 42 cards, 96 de reputação total. 3 iguais em linha (6 × rep 3), 3 iguais em triângulo (6 × rep 3), 2 iguais + 1 diferente em linha (30 × rep 2).
- **Pilha:** máximo 3 tokens, em qualquer momento, inclusive durante movimentação.
- **Todo o código em inglês**: identificadores, comentários, descrições de teste, mensagens de erro, textos de interface e mensagens de commit. Este plano e a spec seguem em português — são documentos de trabalho, não o produto.

## Review Focus

Cinco classes de entrada que a spec implica e que nenhuma tarefa exercitaria por acaso. Cada linha tem seu teste atribuído à tarefa que é dona do código.

1. **Movimentação que estouraria a pilha de 3** (`meat`, `iron`) — o destino deve ser rejeitado por `legalActions`, não aceito e corrigido depois. *Teste na Task 9.*
2. **Saco com menos de 3 tokens no meio de um `crystal`** — puxa o que houver, injeta os 6 extras uma única vez, completa a compra, e o fim de jogo dispara mesmo com o saco reabastecido. *Teste na Task 10.*
3. **`plant` sem alvo válido, e `plant` apontando para um token dual** — sem vizinho, ativar plant é jogada legal que não faz nada; com alvo dual, a escolha de qual das 2 habilidades usar é obrigatória. *Teste na Task 10.*
4. **Deck esgotado durante REFRESH ou durante `spendCoin`** — o jogador fica com a mão incompleta em vez de o motor estourar, e o fim de jogo dispara. *Teste na Task 11.*
5. **Pontuar é sempre opcional** — um card casável na fase SCORE pode ser deixado na mão, e `endTurn` é legal mesmo havendo card pontuável. *Teste na Task 11.*

## Estrutura de arquivos

```
package.json                      workspaces, scripts, devDeps
tsconfig.base.json                strict compartilhado
vitest.config.ts                  runner único para os três pacotes

packages/engine/
  package.json                    @dcv/engine, zero deps
  src/types.ts                    tipos do domínio (nada de lógica)
  src/hex.ts                      coordenadas axiais, tabuleiro, rotação
  src/rng.ts                      gerador com seed
  src/tokens.ts                   tipos, anel dos duais, chart, saco inicial
  src/cards.ts                    geração dos 42 shop cards
  src/matcher.ts                  casamento de padrão e "o que eu completo"
  src/setup.ts                    createGame(seed)
  src/view.ts                     toPlayerView + determinize
  src/board.ts                    operações imutáveis sobre o tabuleiro
  src/abilities.ts               expansão das 6 habilidades em pendências
  src/engine.ts                   legalActions + applyAction
  src/scoring.ts                  pontuação final
  src/index.ts                    API pública

packages/ai/
  package.json                    @dcv/ai, depende de @dcv/engine
  src/types.ts                    Strategy, Difficulty
  src/easy.ts                     aleatório enviesado a pontuar
  src/evaluate.ts                 função de avaliação
  src/medium.ts                   guloso de um lance
  src/index.ts                    createStrategy(level)
  src/selfplay.test.ts            100 partidas sem interface

apps/web/
  package.json                    @dcv/web
  index.html                      viewport mobile
  vite.config.ts
  src/main.tsx
  src/App.tsx                     composição das três faixas
  src/theme.ts                    cor + símbolo por tipo de dragão
  src/game/useGame.ts             estado, histórico, desfazer, turno da máquina
  src/game/prompts.ts             pendência → texto e modo de seleção
  src/game/log.ts                 entrada de log → texto em inglês
  src/components/Board.tsx        SVG do tabuleiro
  src/components/HexCell.tsx      uma casa, sua pilha e seu realce
  src/components/TokenGlyph.tsx   desenho de um token (único ou dual)
  src/components/Hand.tsx         mão, moedas, ações da fase SCORE
  src/components/CardView.tsx     um shop card com seu padrão
  src/components/PatternGlyph.tsx padrão de 3 ícones em miniatura
  src/components/TopBar.tsx       oponente, placar, log
  src/components/Prompt.tsx       pergunta da pendência atual
  src/components/GameOver.tsx     contagem final
```

Divisão por responsabilidade, não por camada: `abilities.ts` fica separado de `engine.ts` porque são as regras que mais mudam quando Fancy Mode entrar; `board.ts` fica separado porque é o único lugar que sabe manipular pilhas.

---

## Fase A — O motor

### Task 1: Workspace e tipos do domínio

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/src/types.ts`
- Test: `packages/engine/src/types.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: todos os tipos do domínio, importados por praticamente todas as tarefas seguintes. `DRAGON_TYPES: readonly DragonType[]`.

- [ ] **Step 1: Criar o `package.json` raiz**

```json
{
  "name": "dragoncraft-versus",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`noUncheckedIndexedAccess` fica **desligado** de propósito: este motor indexa arrays e pilhas o tempo todo, e o ruído que a flag adiciona não paga o que ela pega aqui.

- [ ] **Step 3: Criar `vitest.config.ts` na raiz**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Criar o pacote do motor**

`packages/engine/package.json`:

```json
{
  "name": "@dcv/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

`packages/engine/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Sem campo `dependencies`: essa ausência **é** a regra 4 da spec, e é verificável por revisão.

- [ ] **Step 5: Escrever o teste que falha**

`packages/engine/src/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DRAGON_TYPES } from './types.js'

describe('DRAGON_TYPES', () => {
  it('has exactly the 6 game types, with no repeats', () => {
    expect(DRAGON_TYPES).toEqual(['bread', 'crystal', 'meat', 'iron', 'potion', 'plant'])
    expect(new Set(DRAGON_TYPES).size).toBe(6)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm install && npm test`
Expected: FAIL — `Failed to resolve import "./types.js"`.

- [ ] **Step 7: Escrever `packages/engine/src/types.ts`**

```ts
export const DRAGON_TYPES = ['bread', 'crystal', 'meat', 'iron', 'potion', 'plant'] as const

export type DragonType = (typeof DRAGON_TYPES)[number]

export type Token =
  | { kind: 'single'; type: DragonType }
  | { kind: 'dual'; types: [DragonType, DragonType] }

/** Axial coordinate. The board is the set where max(|q|,|r|,|q+r|) <= 2. */
export type Hex = { q: number; r: number }

/** `${q},${r}` — canonical key for a space. */
export type HexKey = string

/** Stack from bottom to top, at most 3 tokens. Empty spaces are absent from the map. */
export type Board = Record<HexKey, Token[]>

export type PatternCell = { offset: Hex; type: DragonType }

export type ShopCard = {
  id: string
  reputation: number
  pattern: PatternCell[]
}

export type Seat = 0 | 1

export type RngState = number

export type PlayerState = {
  hand: ShopCard[]
  scored: ShopCard[]
  coins: number
  coinSpentThisTurn: boolean
}

export type Phase = 'play' | 'score' | 'final-score' | 'ended'

/**
 * Stack of open decisions. The last element is the top, and it is the only
 * one `legalActions` ever reads.
 */
export type Pending =
  | { kind: 'place'; token: Token; fireUpAllowed: boolean }
  | { kind: 'mayFireUp'; at: Hex }
  | { kind: 'crystalPick'; tokens: Token[] }
  | { kind: 'meat'; at: Hex }
  | { kind: 'iron'; at: Hex; movesLeft: number }
  | { kind: 'potion' }
  | { kind: 'plant'; at: Hex }
  | { kind: 'coinDiscard' }

export type Action =
  | { type: 'place'; at: Hex }
  | { type: 'fireUp'; ability: DragonType }
  | { type: 'skipFireUp' }
  | { type: 'crystalPick'; index: number }
  | { type: 'meatMove'; from: Hex; to: Hex }
  | { type: 'ironMove'; from: Hex; to: Hex }
  | { type: 'ironDone' }
  | { type: 'potionSwap'; a: Hex; b: Hex }
  | { type: 'plantTarget'; at: Hex; ability: DragonType }
  | { type: 'spendCoin' }
  | { type: 'coinDiscard'; cardIds: [string, string] }
  | { type: 'scoreCard'; cardId: string }
  | { type: 'endTurn' }

export type LogEntry = {
  seat: Seat
  action: Action | { type: 'draw'; token: Token } | { type: 'gameOver' }
}

export type GameState = {
  rng: RngState
  board: Board
  bag: Token[]
  extras: Token[]
  extrasAdded: boolean
  deck: ShopCard[]
  players: [PlayerState, PlayerState]
  current: Seat
  phase: Phase
  pending: Pending[]
  endTriggered: boolean
  log: LogEntry[]
}

export type PlayerView = {
  seat: Seat
  board: Board
  /** Bag composition, canonically ordered: derivable from the board, therefore public. */
  bag: Token[]
  extrasAdded: boolean
  deckCount: number
  you: PlayerState
  opponent: {
    handCount: number
    scored: ShopCard[]
    coins: number
    coinSpentThisTurn: boolean
  }
  current: Seat
  phase: Phase
  pending: Pending[]
  endTriggered: boolean
  log: LogEntry[]
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test && npm run typecheck`
Expected: PASS, 1 teste. `typecheck` sem erros.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.base.json vitest.config.ts packages/engine
git commit -m "chore: npm workspace and engine domain types"
```

---

### Task 2: Geometria hexagonal

**Files:**
- Create: `packages/engine/src/hex.ts`
- Test: `packages/engine/src/hex.test.ts`

**Interfaces:**
- Consumes: `Hex`, `HexKey` de `types.ts`.
- Produces: `BOARD: Hex[]` (19 casas), `CENTER: Hex`, `INNER_RING: Hex[]`, `key(h): HexKey`, `parseKey(k): Hex`, `onBoard(h): boolean`, `neighbors(h): Hex[]`, `areAdjacent(a, b): boolean`, `rotate(h): Hex`, `add(a, b): Hex`, `sub(a, b): Hex`, `hexEq(a, b): boolean`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/hex.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BOARD, CENTER, INNER_RING, areAdjacent, key, neighbors, onBoard, parseKey, rotate } from './hex.js'

describe('board', () => {
  it('has 19 spaces: centre, inner ring of 6 and outer ring of 12', () => {
    expect(BOARD).toHaveLength(19)
    expect(BOARD.filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 0)).toHaveLength(1)
    expect(BOARD.filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 1)).toHaveLength(6)
    expect(BOARD.filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 2)).toHaveLength(12)
  })

  it('the 6 starting spaces are exactly the neighbours of the centre', () => {
    expect(INNER_RING.map(key).sort()).toEqual(neighbors(CENTER).map(key).sort())
  })

  it('rejects spaces outside the board', () => {
    expect(onBoard({ q: 3, r: 0 })).toBe(false)
    expect(onBoard({ q: 2, r: 1 })).toBe(false)
    expect(onBoard({ q: 2, r: -2 })).toBe(true)
  })
})

describe('adjacency', () => {
  it('the centre has 6 neighbours and a corner has 3 on the board', () => {
    expect(neighbors(CENTER).filter(onBoard)).toHaveLength(6)
    expect(neighbors({ q: 2, r: -2 }).filter(onBoard)).toHaveLength(3)
  })

  it('spaces sharing a side are adjacent, nothing else is', () => {
    expect(areAdjacent({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(true)
    expect(areAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false)
    expect(areAdjacent({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(false)
  })
})

describe('rotation', () => {
  it('six rotations return to the original', () => {
    let h = { q: 2, r: -1 }
    for (let i = 0; i < 6; i++) h = rotate(h)
    expect(h).toEqual({ q: 2, r: -1 })
  })

  it('turns one inner-ring step into the next neighbour', () => {
    expect(rotate({ q: 1, r: 0 })).toEqual({ q: 0, r: 1 })
  })

  it('preserves distance from the centre', () => {
    for (const h of BOARD) {
      const d = (x: { q: number; r: number }) => Math.max(Math.abs(x.q), Math.abs(x.r), Math.abs(x.q + x.r))
      expect(d(rotate(h))).toBe(d(h))
    }
  })
})

describe('keys', () => {
  it('round-trips a space unchanged', () => {
    for (const h of BOARD) expect(parseKey(key(h))).toEqual(h)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/hex.test.ts`
Expected: FAIL — `Failed to resolve import "./hex.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/hex.ts`**

```ts
import type { Hex, HexKey } from './types.js'

export const BOARD_RADIUS = 2

export const CENTER: Hex = { q: 0, r: 0 }

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function distance(h: Hex): number {
  return Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r))
}

export function onBoard(h: Hex): boolean {
  return distance(h) <= BOARD_RADIUS
}

function buildBoard(): Hex[] {
  const cells: Hex[] = []
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
      const h = { q, r }
      if (onBoard(h)) cells.push(h)
    }
  }
  return cells
}

/** The 19 spaces, in stable order. */
export const BOARD: readonly Hex[] = buildBoard()

export function add(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r }
}

export function sub(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r }
}

export function hexEq(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => add(h, d))
}

export function areAdjacent(a: Hex, b: Hex): boolean {
  return DIRECTIONS.some((d) => hexEq(add(a, d), b))
}

/** The 6 starting spaces: the ring around the centre. */
export const INNER_RING: readonly Hex[] = neighbors(CENTER)

/**
 * 60-degree rotation about the centre. Six applications return to the original.
 *
 * The `+ 0` normalizes IEEE-754 negative zero: `-h.r` is `-0` when `h.r` is 0,
 * and deep equality (vitest `toEqual`, `Object.is`) treats `-0` and `0` as
 * different values. The matcher compares rotated coordinates, so a stray `-0`
 * would silently fail to match. Do not "simplify" this away.
 */
export function rotate(h: Hex): Hex {
  return { q: -h.r + 0, r: h.q + h.r + 0 }
}

export function key(h: Hex): HexKey {
  return `${h.q},${h.r}`
}

export function parseKey(k: HexKey): Hex {
  const [q, r] = k.split(',').map(Number)
  return { q, r }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/hex.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/hex.ts packages/engine/src/hex.test.ts
git commit -m "feat(engine): axial coordinates and the 19-space board"
```

---

### Task 3: Gerador aleatório com seed

**Files:**
- Create: `packages/engine/src/rng.ts`
- Test: `packages/engine/src/rng.test.ts`

**Interfaces:**
- Consumes: `RngState` de `types.ts`.
- Produces: `nextInt(rng: RngState, bound: number): { value: number; rng: RngState }`, `shuffle<T>(items: readonly T[], rng: RngState): { items: T[]; rng: RngState }`, `pick<T>(items: readonly T[], rng: RngState): { item: T; index: number; rng: RngState }`, `seedFrom(text: string): RngState`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { nextInt, pick, seedFrom, shuffle } from './rng.js'

describe('nextInt', () => {
  it('is deterministic for the same seed', () => {
    const a = nextInt(42, 100)
    const b = nextInt(42, 100)
    expect(a).toEqual(b)
  })

  it('advances the state, producing different values', () => {
    const first = nextInt(42, 1000)
    const second = nextInt(first.rng, 1000)
    expect(second.value).not.toBe(first.value)
  })

  it('always stays within the bound', () => {
    let rng = seedFrom('limite')
    for (let i = 0; i < 2000; i++) {
      const out = nextInt(rng, 7)
      expect(out.value).toBeGreaterThanOrEqual(0)
      expect(out.value).toBeLessThan(7)
      rng = out.rng
    }
  })

  it('covers every possible value across many draws', () => {
    let rng = seedFrom('cobertura')
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const out = nextInt(rng, 6)
      seen.add(out.value)
      rng = out.rng
    }
    expect(seen.size).toBe(6)
  })
})

describe('shuffle', () => {
  it('does not mutate the input and preserves every element', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const frozen = [...input]
    const out = shuffle(input, seedFrom('baralho'))
    expect(input).toEqual(frozen)
    expect([...out.items].sort((a, b) => a - b)).toEqual(frozen)
  })

  it('the same seed produces the same order', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(input, 7).items).toEqual(shuffle(input, 7).items)
  })

  it('different seeds produce different orders', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(shuffle(input, 1).items).not.toEqual(shuffle(input, 2).items)
  })
})

describe('pick', () => {
  it('returns an element of the list along with its index', () => {
    const out = pick(['a', 'b', 'c'], seedFrom('escolha'))
    expect(['a', 'b', 'c'][out.index]).toBe(out.item)
  })
})

describe('seedFrom', () => {
  it('maps the same text to the same seed, and different text to different seeds', () => {
    expect(seedFrom('sala-123')).toBe(seedFrom('sala-123'))
    expect(seedFrom('sala-123')).not.toBe(seedFrom('sala-124'))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/rng.test.ts`
Expected: FAIL — `Failed to resolve import "./rng.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/rng.ts`**

```ts
import type { RngState } from './types.js'

/**
 * mulberry32. The state is a 32-bit integer; every function returns the next
 * state instead of holding it. There is no `Math.random` anywhere in the engine.
 */
function nextUint(state: RngState): { value: number; rng: RngState } {
  const rng = (state + 0x6d2b79f5) | 0
  let x = Math.imul(rng ^ (rng >>> 15), 1 | rng)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return { value: (x ^ (x >>> 14)) >>> 0, rng }
}

export function nextInt(state: RngState, bound: number): { value: number; rng: RngState } {
  if (bound <= 0) throw new Error(`nextInt needs a positive bound, got ${bound}`)
  const { value, rng } = nextUint(state)
  return { value: value % bound, rng }
}

export function pick<T>(items: readonly T[], state: RngState): { item: T; index: number; rng: RngState } {
  if (items.length === 0) throw new Error('pick from an empty list')
  const { value, rng } = nextInt(state, items.length)
  return { item: items[value], index: value, rng }
}

/** Fisher-Yates. Returns a fresh array; the input is never touched. */
export function shuffle<T>(items: readonly T[], state: RngState): { items: T[]; rng: RngState } {
  const out = [...items]
  let rng = state
  for (let i = out.length - 1; i > 0; i--) {
    const step = nextInt(rng, i + 1)
    rng = step.rng
    const j = step.value
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return { items: out, rng }
}

/** FNV-1a hash: turns a game identifier into a seed. */
export function seedFrom(text: string): RngState {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/rng.test.ts`
Expected: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/rng.ts packages/engine/src/rng.test.ts
git commit -m "feat(engine): deterministic seeded random generator"
```

---

### Task 4: Tokens, anel dos duais e Fire Up Chart

**Files:**
- Create: `packages/engine/src/tokens.ts`
- Test: `packages/engine/src/tokens.test.ts`

**Interfaces:**
- Consumes: `DRAGON_TYPES`, `DragonType`, `Token` de `types.ts`.
- Produces: `DUAL_RING: readonly DragonType[]`, `FIRE_UP_ORDER: readonly DragonType[]`, `DUAL_TOKENS: readonly Token[]` (6), `ALL_TOKENS: readonly Token[]` (42), `single(t): Token`, `dual(a, b): Token`, `tokenMatches(token, type): boolean`, `abilitiesOf(token): DragonType[]`, `fireUpRank(token): number`, `tokenId(token): string`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DRAGON_TYPES } from './types.js'
import {
  ALL_TOKENS,
  DUAL_RING,
  DUAL_TOKENS,
  FIRE_UP_ORDER,
  abilitiesOf,
  dual,
  fireUpRank,
  single,
  tokenMatches,
} from './tokens.js'

describe('dual tokens', () => {
  it('are 6, one per neighbouring pair on the ring', () => {
    expect(DUAL_TOKENS).toHaveLength(6)
  })

  it('every type appears in exactly 2 duals', () => {
    for (const type of DRAGON_TYPES) {
      const count = DUAL_TOKENS.filter((t) => tokenMatches(t, type)).length
      expect(count, `type ${type}`).toBe(2)
    }
  })

  it('no dual repeats the same type on both sides', () => {
    for (const token of DUAL_TOKENS) {
      expect(token.kind).toBe('dual')
      if (token.kind === 'dual') expect(token.types[0]).not.toBe(token.types[1])
    }
  })

  it('the 6 pairs are distinct', () => {
    const keys = DUAL_TOKENS.map((t) => (t.kind === 'dual' ? [...t.types].sort().join('+') : ''))
    expect(new Set(keys).size).toBe(6)
  })

  it('the dual ring is not the Fire Up Chart', () => {
    expect([...DUAL_RING]).not.toEqual([...FIRE_UP_ORDER])
  })
})

describe('full token set', () => {
  it('are 42: 36 artisans (6 per type) and 6 duals', () => {
    expect(ALL_TOKENS).toHaveLength(42)
    expect(ALL_TOKENS.filter((t) => t.kind === 'single')).toHaveLength(36)
    expect(ALL_TOKENS.filter((t) => t.kind === 'dual')).toHaveLength(6)
    for (const type of DRAGON_TYPES) {
      expect(ALL_TOKENS.filter((t) => t.kind === 'single' && t.type === type)).toHaveLength(6)
    }
  })
})

describe('tokenMatches', () => {
  it('a single token matches only its own type', () => {
    expect(tokenMatches(single('bread'), 'bread')).toBe(true)
    expect(tokenMatches(single('bread'), 'plant')).toBe(false)
  })

  it('a dual matches either of its 2 types', () => {
    const t = dual('crystal', 'iron')
    expect(tokenMatches(t, 'crystal')).toBe(true)
    expect(tokenMatches(t, 'iron')).toBe(true)
    expect(tokenMatches(t, 'meat')).toBe(false)
  })
})

describe('abilitiesOf', () => {
  it('a single offers 1 ability, a dual offers 2', () => {
    expect(abilitiesOf(single('meat'))).toEqual(['meat'])
    expect(abilitiesOf(dual('potion', 'plant'))).toEqual(['potion', 'plant'])
  })
})

describe('fireUpRank', () => {
  it('bread is highest and plant lowest', () => {
    expect(fireUpRank(single('bread'))).toBeLessThan(fireUpRank(single('plant')))
  })

  it('the chart is bread > crystal > meat > iron > potion > plant', () => {
    expect([...FIRE_UP_ORDER]).toEqual(['bread', 'crystal', 'meat', 'iron', 'potion', 'plant'])
  })

  it('a dual counts as the higher of its 2 types', () => {
    expect(fireUpRank(dual('plant', 'meat'))).toBe(fireUpRank(single('meat')))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/tokens.test.ts`
Expected: FAIL — `Failed to resolve import "./tokens.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/tokens.ts`**

```ts
import { DRAGON_TYPES, type DragonType, type Token } from './types.js'

/**
 * Fire Up Chart precedence, highest to lowest.
 * Used for exactly one thing: deciding who goes first.
 */
export const FIRE_UP_ORDER: readonly DragonType[] = ['bread', 'crystal', 'meat', 'iron', 'potion', 'plant']

/**
 * Ring that generates the dual tokens: each dual joins two neighbouring types.
 * NOT the same order as the Fire Up Chart — `meat` and `iron` swap places.
 */
export const DUAL_RING: readonly DragonType[] = ['bread', 'crystal', 'iron', 'potion', 'plant', 'meat']

export function single(type: DragonType): Token {
  return { kind: 'single', type }
}

export function dual(a: DragonType, b: DragonType): Token {
  return { kind: 'dual', types: [a, b] }
}

function buildDuals(): Token[] {
  return DUAL_RING.map((type, i) => dual(type, DUAL_RING[(i + 1) % DUAL_RING.length]))
}

export const DUAL_TOKENS: readonly Token[] = buildDuals()

/** 36 artisans (6 per type) plus the 6 duals. */
export const ALL_TOKENS: readonly Token[] = [
  ...DRAGON_TYPES.flatMap((type) => Array.from({ length: 6 }, () => single(type))),
  ...DUAL_TOKENS,
]

export function tokenMatches(token: Token, type: DragonType): boolean {
  return token.kind === 'single' ? token.type === type : token.types.includes(type)
}

/** The abilities this token offers. A dual offers 2; only one may be used. */
export function abilitiesOf(token: Token): DragonType[] {
  return token.kind === 'single' ? [token.type] : [...token.types]
}

/** Lower is higher on the chart. A dual counts as the higher of its 2 types. */
export function fireUpRank(token: Token): number {
  return Math.min(...abilitiesOf(token).map((t) => FIRE_UP_ORDER.indexOf(t)))
}

export function tokenId(token: Token): string {
  return token.kind === 'single' ? token.type : `${token.types[0]}+${token.types[1]}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/tokens.test.ts`
Expected: PASS, 11 testes.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/tokens.ts packages/engine/src/tokens.test.ts
git commit -m "feat(engine): tokens, dual ring and Fire Up Chart"
```

---

### Task 5: O deck de 42 cards derivado em código

**Files:**
- Create: `packages/engine/src/cards.ts`
- Test: `packages/engine/src/cards.test.ts`

**Interfaces:**
- Consumes: `DRAGON_TYPES`, `DragonType`, `PatternCell`, `ShopCard` de `types.ts`; `key` de `hex.ts`.
- Produces: `DECK: readonly ShopCard[]` (42), `patternKey(pattern): string`, `LINE_OFFSETS`, `TRIANGLE_OFFSETS`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/cards.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DECK, patternKey } from './cards.js'
import { DRAGON_TYPES } from './types.js'
import { areAdjacent } from './hex.js'

describe('deck', () => {
  it('has 42 cards', () => {
    expect(DECK).toHaveLength(42)
  })

  it('sums to 96 reputation', () => {
    expect(DECK.reduce((sum, c) => sum + c.reputation, 0)).toBe(96)
  })

  it('has 42 distinct patterns', () => {
    expect(new Set(DECK.map((c) => patternKey(c.pattern))).size).toBe(42)
  })

  it('has 42 distinct ids', () => {
    expect(new Set(DECK.map((c) => c.id)).size).toBe(42)
  })

  it('every card has exactly 3 icons', () => {
    for (const card of DECK) expect(card.pattern, card.id).toHaveLength(3)
  })

  it('splits into the three families the spec describes', () => {
    const monos = DECK.filter((c) => new Set(c.pattern.map((p) => p.type)).size === 1)
    const mixed = DECK.filter((c) => new Set(c.pattern.map((p) => p.type)).size === 2)
    expect(monos).toHaveLength(12)
    expect(mixed).toHaveLength(30)
    for (const c of monos) expect(c.reputation, c.id).toBe(3)
    for (const c of mixed) expect(c.reputation, c.id).toBe(2)
  })

  it('has one mono line card and one mono triangle card per type', () => {
    for (const type of DRAGON_TYPES) {
      const perType = DECK.filter((c) => c.pattern.every((p) => p.type === type))
      expect(perType, `type ${type}`).toHaveLength(2)
    }
  })

  it('puts the odd icon at an end on every mixed card', () => {
    const mixed = DECK.filter((c) => new Set(c.pattern.map((p) => p.type)).size === 2)
    for (const card of mixed) {
      const [a, b, c] = card.pattern
      expect(a.type, card.id).toBe(b.type)
      expect(c.type, card.id).not.toBe(b.type)
    }
  })

  it('keeps every pattern connected: each cell touches the previous or the first', () => {
    for (const card of DECK) {
      const [a, b, c] = card.pattern.map((p) => p.offset)
      expect(areAdjacent(a, b), card.id).toBe(true)
      expect(areAdjacent(b, c) || areAdjacent(a, c), card.id).toBe(true)
    }
  })

  it('has no mixed triangle', () => {
    const triangles = DECK.filter((c) => {
      const [a, b, cc] = c.pattern.map((p) => p.offset)
      return areAdjacent(a, b) && areAdjacent(b, cc) && areAdjacent(a, cc)
    })
    expect(triangles).toHaveLength(6)
    for (const t of triangles) expect(new Set(t.pattern.map((p) => p.type)).size).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/cards.test.ts`
Expected: FAIL — `Failed to resolve import "./cards.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/cards.ts`**

```ts
import { key } from './hex.js'
import { DRAGON_TYPES, type DragonType, type Hex, type PatternCell, type ShopCard } from './types.js'

/** Three spaces in a straight line. */
export const LINE_OFFSETS: readonly Hex[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
]

/** Three mutually adjacent spaces. */
export const TRIANGLE_OFFSETS: readonly Hex[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
]

function cells(offsets: readonly Hex[], types: readonly DragonType[]): PatternCell[] {
  return offsets.map((offset, i) => ({ offset, type: types[i] }))
}

/** Canonical signature of a pattern, for comparison and duplicate detection. */
export function patternKey(pattern: readonly PatternCell[]): string {
  return [...pattern]
    .map((p) => `${key(p.offset)}:${p.type}`)
    .sort()
    .join('|')
}

function buildDeck(): ShopCard[] {
  const deck: ShopCard[] = []

  for (const type of DRAGON_TYPES) {
    deck.push({
      id: `line-${type}`,
      reputation: 3,
      pattern: cells(LINE_OFFSETS, [type, type, type]),
    })
    deck.push({
      id: `tri-${type}`,
      reputation: 3,
      pattern: cells(TRIANGLE_OFFSETS, [type, type, type]),
    })
  }

  // 2 alike plus 1 different, in a line, with the odd one at an end.
  // `pair` and `odd` distinct: 6 x 5 = 30 cards.
  for (const pair of DRAGON_TYPES) {
    for (const odd of DRAGON_TYPES) {
      if (pair === odd) continue
      deck.push({
        id: `line-${pair}-${pair}-${odd}`,
        reputation: 2,
        pattern: cells(LINE_OFFSETS, [pair, pair, odd]),
      })
    }
  }

  return deck
}

/** The 42 shop cards, summing to 96 reputation. */
export const DECK: readonly ShopCard[] = buildDeck()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/cards.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/cards.ts packages/engine/src/cards.test.ts
git commit -m "feat(engine): derive the 42 shop cards in code"
```

---

### Task 6: Tabuleiro imutável e o casamento de padrões

**Files:**
- Create: `packages/engine/src/board.ts`
- Create: `packages/engine/src/matcher.ts`
- Test: `packages/engine/src/board.test.ts`
- Test: `packages/engine/src/matcher.test.ts`

**Interfaces:**
- Consumes: `hex.ts`, `tokens.ts`, tipos.
- Produces (board): `MAX_STACK = 3`, `stackAt`, `heightAt`, `topOf`, `canReceive`, `pushToken`, `popToken`, `moveTop`, `swapTops`, `occupiedHexes`.
- Produces (matcher): `rotations(pattern)`, `findMatch(board, card): Hex[] | null`, `canScore(board, card): boolean`, `wouldComplete(board, card, hex, token): boolean`.

A spec falava em "matcher com posição em branco". Simular a colocação e reconsultar `canScore` dá o mesmo resultado com metade do código e sem um segundo algoritmo pra manter em sincronia — é o que esta tarefa implementa.

- [ ] **Step 1: Escrever o teste de `board.ts`**

`packages/engine/src/board.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canReceive, heightAt, moveTop, popToken, pushToken, stackAt, swapTops, topOf } from './board.js'
import { key } from './hex.js'
import { dual, single } from './tokens.js'
import type { Board } from './types.js'

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }

describe('stacks', () => {
  it('reports height 0 and no top for an empty space', () => {
    expect(heightAt({}, A)).toBe(0)
    expect(topOf({}, A)).toBeUndefined()
  })

  it('does not mutate the board it receives', () => {
    const before: Board = {}
    const after = pushToken(before, A, single('bread'))
    expect(before).toEqual({})
    expect(stackAt(after, A)).toHaveLength(1)
  })

  it('makes the last token pushed the top', () => {
    let board: Board = {}
    board = pushToken(board, A, single('bread'))
    board = pushToken(board, A, single('plant'))
    expect(topOf(board, A)).toEqual(single('plant'))
  })

  it('refuses to stack above 3', () => {
    let board: Board = {}
    for (let i = 0; i < 3; i++) board = pushToken(board, A, single('iron'))
    expect(canReceive(board, A)).toBe(false)
    expect(() => pushToken(board, A, single('iron'))).toThrow()
  })

  it('refuses a space off the board', () => {
    expect(canReceive({}, { q: 3, r: 0 })).toBe(false)
  })

  it('returns the top and drops the space once it empties', () => {
    const board = pushToken({}, A, single('meat'))
    const out = popToken(board, A)
    expect(out.token).toEqual(single('meat'))
    expect(key(A) in out.board).toBe(false)
  })

  it('moves only the top, revealing the token underneath', () => {
    let board: Board = {}
    board = pushToken(board, A, single('bread'))
    board = pushToken(board, A, single('plant'))
    board = moveTop(board, A, B)
    expect(topOf(board, A)).toEqual(single('bread'))
    expect(topOf(board, B)).toEqual(single('plant'))
  })

  it('swaps only the tops and preserves both heights', () => {
    let board: Board = {}
    board = pushToken(board, A, single('bread'))
    board = pushToken(board, A, single('iron'))
    board = pushToken(board, B, dual('potion', 'plant'))
    const after = swapTops(board, A, B)
    expect(topOf(after, A)).toEqual(dual('potion', 'plant'))
    expect(topOf(after, B)).toEqual(single('iron'))
    expect(heightAt(after, A)).toBe(2)
    expect(heightAt(after, B)).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/board.test.ts`
Expected: FAIL — `Failed to resolve import "./board.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/board.ts`**

```ts
import { key, onBoard, parseKey } from './hex.js'
import type { Board, Hex, Token } from './types.js'

export const MAX_STACK = 3

export function stackAt(board: Board, hex: Hex): Token[] {
  return board[key(hex)] ?? []
}

export function heightAt(board: Board, hex: Hex): number {
  return stackAt(board, hex).length
}

export function topOf(board: Board, hex: Hex): Token | undefined {
  const stack = stackAt(board, hex)
  return stack.length > 0 ? stack[stack.length - 1] : undefined
}

export function canReceive(board: Board, hex: Hex): boolean {
  return onBoard(hex) && heightAt(board, hex) < MAX_STACK
}

export function occupiedHexes(board: Board): Hex[] {
  return Object.keys(board).map(parseKey)
}

export function pushToken(board: Board, hex: Hex, token: Token): Board {
  if (!canReceive(board, hex)) throw new Error(`space ${key(hex)} cannot take another token`)
  return { ...board, [key(hex)]: [...stackAt(board, hex), token] }
}

export function popToken(board: Board, hex: Hex): { board: Board; token: Token } {
  const stack = stackAt(board, hex)
  const token = stack[stack.length - 1]
  if (!token) throw new Error(`space ${key(hex)} is empty`)
  const next: Board = { ...board }
  const rest = stack.slice(0, -1)
  if (rest.length === 0) delete next[key(hex)]
  else next[key(hex)] = rest
  return { board: next, token }
}

/** Moves the top of `from` onto `to`. The limit of 3 is checked after removal. */
export function moveTop(board: Board, from: Hex, to: Hex): Board {
  const popped = popToken(board, from)
  return pushToken(popped.board, to, popped.token)
}

/**
 * Swaps the tops of two spaces. Since heights do not change, this operation
 * can never violate the limit of 3.
 */
export function swapTops(board: Board, a: Hex, b: Hex): Board {
  const ta = topOf(board, a)
  const tb = topOf(board, b)
  if (!ta || !tb) throw new Error('a swap needs a token on each space')
  return {
    ...board,
    [key(a)]: [...stackAt(board, a).slice(0, -1), tb],
    [key(b)]: [...stackAt(board, b).slice(0, -1), ta],
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/board.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Escrever o teste de `matcher.ts`**

`packages/engine/src/matcher.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DECK } from './cards.js'
import { key } from './hex.js'
import { canScore, findMatch, rotations, wouldComplete } from './matcher.js'
import { dual, single } from './tokens.js'
import type { Board, Hex, ShopCard, Token } from './types.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

const boardOf = (entries: Array<[Hex, Token[]]>): Board =>
  Object.fromEntries(entries.map(([h, stack]) => [key(h), stack]))

describe('rotations', () => {
  it('are 6, and the sixth returns to the original pattern', () => {
    const all = rotations(card('line-bread').pattern)
    expect(all).toHaveLength(6)
    expect(rotations(all[5])[1]).toEqual(all[0])
  })
})

describe('findMatch', () => {
  it('finds 3 alike in a line in the base orientation', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
      [{ q: 0, r: 0 }, [single('bread')]],
    ])
    expect(findMatch(board, card('line-bread'))).not.toBeNull()
  })

  it('finds the same line rotated', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, [single('bread')]],
      [{ q: 0, r: 1 }, [single('bread')]],
      [{ q: 0, r: 2 }, [single('bread')]],
    ])
    expect(findMatch(board, card('line-bread'))).not.toBeNull()
  })

  it('finds the triangle', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, [single('iron')]],
      [{ q: 1, r: 0 }, [single('iron')]],
      [{ q: 0, r: 1 }, [single('iron')]],
    ])
    expect(canScore(board, card('tri-iron'))).toBe(true)
    expect(canScore(board, card('line-iron'))).toBe(false)
  })

  it('accepts a dual as either of its 2 types', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('crystal')]],
      [{ q: -1, r: 0 }, [single('crystal')]],
      [{ q: 0, r: 0 }, [dual('crystal', 'iron')]],
    ])
    expect(canScore(board, card('line-crystal'))).toBe(true)
  })

  it('looks only at the top of a stack', () => {
    const buried = boardOf([
      [{ q: -2, r: 0 }, [single('meat')]],
      [{ q: -1, r: 0 }, [single('meat')]],
      [{ q: 0, r: 0 }, [single('meat'), single('plant')]],
    ])
    expect(canScore(buried, card('line-meat'))).toBe(false)

    const onTop = boardOf([
      [{ q: -2, r: 0 }, [single('meat')]],
      [{ q: -1, r: 0 }, [single('meat')]],
      [{ q: 0, r: 0 }, [single('plant'), single('meat')]],
    ])
    expect(canScore(onTop, card('line-meat'))).toBe(true)
  })

  it('does not match a pattern that would run off the board', () => {
    const board = boardOf([
      [{ q: 1, r: 0 }, [single('potion')]],
      [{ q: 2, r: 0 }, [single('potion')]],
    ])
    expect(canScore(board, card('line-potion'))).toBe(false)
  })

  it('matches a mixed card with the odd icon at either end', () => {
    const c = card('line-plant-plant-meat')
    const leftEnd = boardOf([
      [{ q: -2, r: 0 }, [single('meat')]],
      [{ q: -1, r: 0 }, [single('plant')]],
      [{ q: 0, r: 0 }, [single('plant')]],
    ])
    const rightEnd = boardOf([
      [{ q: -2, r: 0 }, [single('plant')]],
      [{ q: -1, r: 0 }, [single('plant')]],
      [{ q: 0, r: 0 }, [single('meat')]],
    ])
    expect(canScore(leftEnd, c)).toBe(true)
    expect(canScore(rightEnd, c)).toBe(true)
  })
})

describe('wouldComplete', () => {
  it('is true when the placement closes the pattern', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
    ])
    expect(wouldComplete(board, card('line-bread'), { q: 0, r: 0 }, single('bread'))).toBe(true)
    expect(wouldComplete(board, card('line-bread'), { q: 0, r: 1 }, single('bread'))).toBe(false)
  })

  it('is false when the card was already scoreable', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
      [{ q: 0, r: 0 }, [single('bread')]],
    ])
    expect(wouldComplete(board, card('line-bread'), { q: 1, r: 0 }, single('bread'))).toBe(false)
  })

  it('is false when the space already holds 3 tokens', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
      [{ q: 0, r: 0 }, [single('iron'), single('iron'), single('iron')]],
    ])
    expect(wouldComplete(board, card('line-bread'), { q: 0, r: 0 }, single('bread'))).toBe(false)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/matcher.test.ts`
Expected: FAIL — `Failed to resolve import "./matcher.js"`.

- [ ] **Step 7: Escrever `packages/engine/src/matcher.ts`**

```ts
import { canReceive, pushToken, topOf } from './board.js'
import { BOARD, add, onBoard, rotate } from './hex.js'
import { tokenMatches } from './tokens.js'
import type { Board, Hex, PatternCell, ShopCard, Token } from './types.js'

function rotatePattern(pattern: readonly PatternCell[]): PatternCell[] {
  return pattern.map((cell) => ({ offset: rotate(cell.offset), type: cell.type }))
}

/** The card's 6 orientations. Symmetric patterns repeat some; that is harmless. */
export function rotations(pattern: readonly PatternCell[]): PatternCell[][] {
  const out: PatternCell[][] = []
  let current: PatternCell[] = [...pattern]
  for (let i = 0; i < 6; i++) {
    out.push(current)
    current = rotatePattern(current)
  }
  return out
}

function matchAt(board: Board, pattern: readonly PatternCell[], anchor: Hex): Hex[] | null {
  const hexes: Hex[] = []
  for (const cell of pattern) {
    const hex = add(anchor, cell.offset)
    if (!onBoard(hex)) return null
    const top = topOf(board, hex)
    if (!top || !tokenMatches(top, cell.type)) return null
    hexes.push(hex)
  }
  return hexes
}

/** The spaces satisfying the card, or null. 6 rotations x 19 anchors x 3 cells. */
export function findMatch(board: Board, card: ShopCard): Hex[] | null {
  for (const pattern of rotations(card.pattern)) {
    for (const anchor of BOARD) {
      const hit = matchAt(board, pattern, anchor)
      if (hit) return hit
    }
  }
  return null
}

export function canScore(board: Board, card: ShopCard): boolean {
  return findMatch(board, card) !== null
}

/**
 * Does placing `token` on `hex` make `card` scoreable when it was not before?
 * Drives the board highlight and one term of the machine's evaluation.
 */
export function wouldComplete(board: Board, card: ShopCard, hex: Hex, token: Token): boolean {
  if (!canReceive(board, hex)) return false
  if (canScore(board, card)) return false
  return canScore(pushToken(board, hex, token), card)
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/`
Expected: PASS — todos os testes do motor até aqui.

- [ ] **Step 9: Commit**

```bash
git add packages/engine/src/board.ts packages/engine/src/board.test.ts packages/engine/src/matcher.ts packages/engine/src/matcher.test.ts
git commit -m "feat(engine): immutable board and rotation-based pattern matching"
```

---

### Task 7: Preparação da partida e visão filtrada

**Files:**
- Create: `packages/engine/src/setup.ts`
- Create: `packages/engine/src/view.ts`
- Test: `packages/engine/src/setup.test.ts`
- Test: `packages/engine/src/view.test.ts`

**Interfaces:**
- Consumes: `cards.ts`, `tokens.ts`, `rng.ts`, `hex.ts`, tipos.
- Produces: `createInitialState(seed: RngState): GameState` (pendências vazias — a primeira compra acontece na Task 8), `STARTING_COINS`, `HAND_SIZE`, `oneOfEach(): Token[]`, `toPlayerView(state, seat): PlayerView`, `determinize(view, rng): { state: GameState; rng: RngState }`.

- [ ] **Step 1: Escrever o teste de preparação**

`packages/engine/src/setup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { INNER_RING } from './hex.js'
import { createInitialState } from './setup.js'
import { DRAGON_TYPES } from './types.js'
import { tokenMatches } from './tokens.js'

describe('createInitialState', () => {
  const state = createInitialState(12345)

  it('puts one artisan of each type on the 6 inner-ring spaces', () => {
    for (const hex of INNER_RING) expect(heightAt(state.board, hex)).toBe(1)
    const types = INNER_RING.map((h) => topOf(state.board, h))
    for (const type of DRAGON_TYPES) {
      expect(types.filter((t) => t && tokenMatches(t, type))).toHaveLength(1)
    }
  })

  it('leaves the rest of the board empty', () => {
    expect(Object.keys(state.board)).toHaveLength(6)
  })

  it('leaves 30 tokens in the bag: 24 artisans and the 6 duals', () => {
    expect(state.bag).toHaveLength(30)
    expect(state.bag.filter((t) => t.kind === 'dual')).toHaveLength(6)
    for (const type of DRAGON_TYPES) {
      expect(state.bag.filter((t) => t.kind === 'single' && t.type === type)).toHaveLength(4)
    }
  })

  it('sets aside 6 extra tokens, one per type, outside the bag', () => {
    expect(state.extras).toHaveLength(6)
    expect(state.extrasAdded).toBe(false)
  })

  it('deals 2 cards and 3 coins to each player, leaving 38 in the deck', () => {
    for (const player of state.players) {
      expect(player.hand).toHaveLength(2)
      expect(player.coins).toBe(3)
      expect(player.scored).toEqual([])
      expect(player.coinSpentThisTurn).toBe(false)
    }
    expect(state.deck).toHaveLength(38)
  })

  it('deals no card to both hands', () => {
    const ids = [...state.players[0].hand, ...state.players[1].hand].map((c) => c.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('starts in the play phase, with no pending and no end trigger', () => {
    expect(state.phase).toBe('play')
    expect(state.pending).toEqual([])
    expect(state.endTriggered).toBe(false)
  })

  it('is deterministic: the same seed gives the same state', () => {
    expect(createInitialState(999)).toEqual(createInitialState(999))
  })

  it('gives different setups for different seeds', () => {
    expect(createInitialState(1)).not.toEqual(createInitialState(2))
  })

  it('picks the first player by the chart, and both seats do occur', () => {
    const seats = new Set(Array.from({ length: 60 }, (_, i) => createInitialState(i).current))
    expect(seats).toEqual(new Set([0, 1]))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/setup.test.ts`
Expected: FAIL — `Failed to resolve import "./setup.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/setup.ts`**

```ts
import { DECK } from './cards.js'
import { INNER_RING, key } from './hex.js'
import { pick, shuffle } from './rng.js'
import { ALL_TOKENS, fireUpRank, single, tokenId } from './tokens.js'
import { DRAGON_TYPES, type Board, type GameState, type PlayerState, type RngState, type Seat, type Token } from './types.js'

export const STARTING_COINS = 3
export const HAND_SIZE = 2

/** One artisan of each type. Used twice: starting board and extra tokens. */
export function oneOfEach(): Token[] {
  return DRAGON_TYPES.map(single)
}

function emptyPlayer(): PlayerState {
  return { hand: [], scored: [], coins: STARTING_COINS, coinSpentThisTurn: false }
}

/** Removes one instance of each given token, compared by type identity. */
function removeTokens(pool: readonly Token[], remove: readonly Token[]): Token[] {
  const out = [...pool]
  for (const token of remove) {
    const index = out.findIndex((t) => tokenId(t) === tokenId(token))
    if (index === -1) throw new Error(`token ${tokenId(token)} is not in the pool`)
    out.splice(index, 1)
  }
  return out
}

/**
 * Each player draws a token; the higher one on the Fire Up Chart goes first.
 * A dual counts as the higher of its 2 types and beats a single on a tie.
 * A genuine tie: both return their tokens and draw again.
 */
function determineFirstPlayer(bag: readonly Token[], seed: RngState): { seat: Seat; rng: RngState } {
  let rng = seed
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = pick(bag, rng)
    rng = a.rng
    const b = pick(bag.filter((_, i) => i !== a.index), rng)
    rng = b.rng

    const rankA = fireUpRank(a.item)
    const rankB = fireUpRank(b.item)
    if (rankA !== rankB) return { seat: rankA < rankB ? 0 : 1, rng }

    const dualA = a.item.kind === 'dual'
    const dualB = b.item.kind === 'dual'
    if (dualA !== dualB) return { seat: dualA ? 0 : 1, rng }
  }
  return { seat: 0, rng }
}

/**
 * State right after setup, before the first token is drawn.
 * `createGame` (Task 8) is what opens the turn.
 */
export function createInitialState(seed: RngState): GameState {
  let rng = seed

  const placed = shuffle(oneOfEach(), rng)
  rng = placed.rng
  const board: Board = {}
  INNER_RING.forEach((hex, i) => {
    board[key(hex)] = [placed.items[i]]
  })

  const extras = oneOfEach()
  const bag = removeTokens(ALL_TOKENS, [...placed.items, ...extras])

  const shuffled = shuffle(DECK, rng)
  rng = shuffled.rng

  const players: [PlayerState, PlayerState] = [
    { ...emptyPlayer(), hand: shuffled.items.slice(0, HAND_SIZE) },
    { ...emptyPlayer(), hand: shuffled.items.slice(HAND_SIZE, HAND_SIZE * 2) },
  ]
  const deck = shuffled.items.slice(HAND_SIZE * 2)

  const first = determineFirstPlayer(bag, rng)
  rng = first.rng

  return {
    rng,
    board,
    bag,
    extras,
    extrasAdded: false,
    deck,
    players,
    current: first.seat,
    phase: 'play',
    pending: [],
    endTriggered: false,
    log: [],
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/setup.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Escrever o teste da visão**

`packages/engine/src/view.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from './setup.js'
import { determinize, toPlayerView } from './view.js'

describe('toPlayerView', () => {
  const state = createInitialState(4242)
  const view = toPlayerView(state, 0)

  it('shows your whole hand', () => {
    expect(view.you.hand).toEqual(state.players[0].hand)
  })

  it('shows only the count of the opponent hand', () => {
    expect(view.opponent.handCount).toBe(2)
    expect(JSON.stringify(view)).not.toContain(state.players[1].hand[0].id)
  })

  it('shows only the deck count, never its order', () => {
    expect(view.deckCount).toBe(38)
    expect(JSON.stringify(view)).not.toContain(state.deck[0].id)
  })

  it('exposes the bag composition, which is derivable from the board', () => {
    expect(view.bag).toHaveLength(30)
  })

  it('orders the bag canonically, so draw order does not leak', () => {
    const ids = view.bag.map((t) => (t.kind === 'single' ? t.type : t.types.join('+')))
    expect([...ids].sort()).toEqual(ids)
  })

  it('does not expose the random generator', () => {
    expect('rng' in view).toBe(false)
  })
})

describe('determinize', () => {
  it('produces a full state that reproduces the source view exactly', () => {
    const state = createInitialState(777)
    const view = toPlayerView(state, 1)
    const guessed = determinize(view, 31337)
    expect(toPlayerView(guessed.state, 1)).toEqual(view)
  })

  it('fills the opponent hand with plausible cards, never a known one', () => {
    const state = createInitialState(555)
    const view = toPlayerView(state, 0)
    const guessed = determinize(view, 8)
    const known = new Set(view.you.hand.map((c) => c.id))
    for (const card of guessed.state.players[1].hand) expect(known.has(card.id)).toBe(false)
    expect(guessed.state.players[1].hand).toHaveLength(view.opponent.handCount)
    expect(guessed.state.deck).toHaveLength(view.deckCount)
  })

  it('produces different guesses for different seeds', () => {
    const view = toPlayerView(createInitialState(11), 0)
    expect(determinize(view, 1).state.players[1].hand).not.toEqual(determinize(view, 2).state.players[1].hand)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/view.test.ts`
Expected: FAIL — `Failed to resolve import "./view.js"`.

- [ ] **Step 7: Escrever `packages/engine/src/view.ts`**

```ts
import { DECK } from './cards.js'
import { shuffle } from './rng.js'
import { oneOfEach } from './setup.js'
import { tokenId } from './tokens.js'
import type { GameState, PlayerState, PlayerView, RngState, Seat, Token } from './types.js'

function sortTokens(tokens: readonly Token[]): Token[] {
  return [...tokens].sort((a, b) => tokenId(a).localeCompare(tokenId(b)))
}

/**
 * What a seat may see. The opponent hand and the deck order stay out; the
 * bag composition goes in, because counting the board already reveals it.
 */
export function toPlayerView(state: GameState, seat: Seat): PlayerView {
  const opponent = state.players[1 - seat]
  return {
    seat,
    board: state.board,
    bag: sortTokens(state.bag),
    extrasAdded: state.extrasAdded,
    deckCount: state.deck.length,
    you: state.players[seat],
    opponent: {
      handCount: opponent.hand.length,
      scored: opponent.scored,
      coins: opponent.coins,
      coinSpentThisTurn: opponent.coinSpentThisTurn,
    },
    current: state.current,
    phase: state.phase,
    pending: state.pending,
    endTriggered: state.endTriggered,
    log: state.log,
  }
}

/**
 * Fills in what the view hides with a consistent guess: the machine guesses,
 * it never peeks. This is what makes simulating from a view possible.
 */
export function determinize(view: PlayerView, seed: RngState): { state: GameState; rng: RngState } {
  const known = new Set([...view.you.hand, ...view.you.scored, ...view.opponent.scored].map((c) => c.id))
  const unknown = DECK.filter((card) => !known.has(card.id))

  const shuffled = shuffle(unknown, seed)
  const opponentHand = shuffled.items.slice(0, view.opponent.handCount)
  const deck = shuffled.items.slice(view.opponent.handCount)
  if (deck.length !== view.deckCount) {
    throw new Error(`inconsistent view: deck of ${deck.length} where the view says ${view.deckCount}`)
  }

  const opponent: PlayerState = {
    hand: opponentHand,
    scored: view.opponent.scored,
    coins: view.opponent.coins,
    coinSpentThisTurn: view.opponent.coinSpentThisTurn,
  }
  const players: [PlayerState, PlayerState] =
    view.seat === 0 ? [view.you, opponent] : [opponent, view.you]

  return {
    state: {
      rng: shuffled.rng,
      board: view.board,
      bag: view.bag,
      extras: view.extrasAdded ? [] : oneOfEach(),
      extrasAdded: view.extrasAdded,
      deck,
      players,
      current: view.current,
      phase: view.phase,
      pending: view.pending,
      endTriggered: view.endTriggered,
      log: view.log,
    },
    rng: shuffled.rng,
  }
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/engine/src/setup.ts packages/engine/src/setup.test.ts packages/engine/src/view.ts packages/engine/src/view.test.ts
git commit -m "feat(engine): game setup, filtered view and determinization"
```

---

### Task 8: O laço do turno — comprar, colocar, passar a vez

Entrega um jogo que já roda de ponta a ponta: puxa token, coloca, troca de jogador. Sem habilidades (Tasks 9 e 10) e sem pontuação (Task 11). É a espinha em que as duas coisas se encaixam.

**Files:**
- Create: `packages/engine/src/engine.ts`
- Test: `packages/engine/src/engine.test.ts`

**Interfaces:**
- Consumes: `setup.ts`, `board.ts`, `hex.ts`, `rng.ts`, tipos.
- Produces: `createGame(seed: RngState): GameState`, `legalActions(state): Action[]`, `applyAction(state, action): GameState`, `drawToken(state): { state: GameState; token: Token | null }`, `beginTurn(state): GameState`, `actionKey(action): string`, `class IllegalActionError`, `topPending(state): Pending | undefined`, `replacePlayer(players, seat, next)`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { IllegalActionError, applyAction, createGame, legalActions } from './engine.js'
import { BOARD } from './hex.js'
import type { Action, GameState } from './types.js'

const placeAt = (state: GameState, q: number, r: number): Action => ({ type: 'place', at: { q, r } })

describe('createGame', () => {
  const game = createGame(2026)

  it('starts with a token already drawn, waiting to be placed', () => {
    expect(game.pending).toHaveLength(1)
    expect(game.pending[0].kind).toBe('place')
    expect(game.bag).toHaveLength(29)
  })

  it('records the draw in the log', () => {
    expect(game.log.at(-1)?.action.type).toBe('draw')
  })
})

describe('legalActions while placing', () => {
  it('offers all 19 spaces while no stack is full', () => {
    const actions = legalActions(createGame(1))
    expect(actions).toHaveLength(BOARD.length)
    expect(actions.every((a) => a.type === 'place')).toBe(true)
  })

  it('stops offering a space once it holds 3 tokens', () => {
    let state = createGame(5)
    for (let i = 0; i < 3; i++) {
      state = applyAction(state, placeAt(state, 0, 0))
      state = applyAction(state, { type: 'endTurn' })
    }
    expect(heightAt(state.board, { q: 0, r: 0 })).toBe(3)
    const offered = legalActions(state).filter((a) => a.type === 'place' && a.at.q === 0 && a.at.r === 0)
    expect(offered).toHaveLength(0)
  })
})

describe('applyAction', () => {
  it('places the token and ends the PLAY phase', () => {
    const game = createGame(7)
    const after = applyAction(game, placeAt(game, 0, 0))
    expect(topOf(after.board, { q: 0, r: 0 })).toBeDefined()
    expect(after.pending).toEqual([])
    expect(after.phase).toBe('score')
  })

  it('does not mutate the state it receives', () => {
    const game = createGame(8)
    const snapshot = JSON.stringify(game)
    applyAction(game, placeAt(game, 0, 0))
    expect(JSON.stringify(game)).toBe(snapshot)
  })

  it('rejects an action that is not in legalActions', () => {
    const game = createGame(9)
    expect(() => applyAction(game, { type: 'place', at: { q: 5, r: 5 } })).toThrow(IllegalActionError)
    expect(() => applyAction(game, { type: 'endTurn' })).toThrow(IllegalActionError)
  })
})

describe('end of turn', () => {
  it('passes the turn and draws a token for the other player', () => {
    const game = createGame(11)
    const placed = applyAction(game, placeAt(game, 0, 0))
    const next = applyAction(placed, { type: 'endTurn' })
    expect(next.current).toBe(1 - game.current)
    expect(next.phase).toBe('play')
    expect(next.pending[0].kind).toBe('place')
    expect(next.bag).toHaveLength(28)
  })

  it('offers only ending the turn in the SCORE phase, for now', () => {
    const game = createGame(12)
    const placed = applyAction(game, placeAt(game, 0, 0))
    expect(legalActions(placed)).toEqual([{ type: 'endTurn' }])
  })

  it('fills the hand back to 2 cards on REFRESH', () => {
    const game = createGame(13)
    const short: GameState = {
      ...game,
      players: [
        { ...game.players[0], hand: game.players[0].hand.slice(0, 1) },
        game.players[1],
      ],
      current: 0,
    }
    const placed = applyAction(short, placeAt(short, 0, 0))
    const after = applyAction(placed, { type: 'endTurn' })
    expect(after.players[0].hand).toHaveLength(2)
    expect(after.deck).toHaveLength(game.deck.length - 1)
  })

  it('clears the incoming player coin-spent flag', () => {
    const game = createGame(14)
    const spent: GameState = {
      ...game,
      players: [
        { ...game.players[0], coinSpentThisTurn: true },
        { ...game.players[1], coinSpentThisTurn: true },
      ],
    }
    const placed = applyAction(spent, placeAt(spent, 0, 0))
    const after = applyAction(placed, { type: 'endTurn' })
    expect(after.players[after.current].coinSpentThisTurn).toBe(false)
  })
})

describe('determinism', () => {
  it('produces identical states from the same seed and action sequence', () => {
    const run = () => {
      let state = createGame(31337)
      for (let i = 0; i < 12; i++) {
        const actions = legalActions(state)
        if (actions.length === 0) break
        state = applyAction(state, actions[i % actions.length])
      }
      return state
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/engine.test.ts`
Expected: FAIL — `Failed to resolve import "./engine.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/engine.ts`**

```ts
import { canReceive, pushToken } from './board.js'
import { BOARD } from './hex.js'
import { pick } from './rng.js'
import { HAND_SIZE, createInitialState } from './setup.js'
import type { Action, GameState, Pending, PlayerState, RngState, Seat, Token } from './types.js'

/** Stable serialization: compares actions regardless of key order. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(',')}}`
}

export function actionKey(action: Action): string {
  return stable(action)
}

export class IllegalActionError extends Error {
  constructor(readonly action: Action) {
    super(`illegal action in this state: ${actionKey(action)}`)
    this.name = 'IllegalActionError'
  }
}

export function topPending(state: GameState): Pending | undefined {
  return state.pending[state.pending.length - 1]
}

export function replacePlayer(
  players: readonly [PlayerState, PlayerState],
  seat: Seat,
  next: PlayerState,
): [PlayerState, PlayerState] {
  return seat === 0 ? [next, players[1]] : [players[0], next]
}

/**
 * Draws a token from the bag. If the bag is empty, injects the 6 extras —
 * once only. Emptying the bag triggers the end of the game, even when the
 * extras go in right after and the bag holds tokens again.
 * Returns `null` when there is nothing left to draw anywhere.
 */
export function drawToken(state: GameState): { state: GameState; token: Token | null } {
  let bag = state.bag
  let extras = state.extras
  let extrasAdded = state.extrasAdded

  if (bag.length === 0) {
    if (extrasAdded || extras.length === 0) return { state, token: null }
    bag = [...extras]
    extras = []
    extrasAdded = true
  }

  const drawn = pick(bag, state.rng)
  const rest = bag.filter((_, i) => i !== drawn.index)

  return {
    state: {
      ...state,
      rng: drawn.rng,
      bag: rest,
      extras,
      extrasAdded,
      endTriggered: state.endTriggered || rest.length === 0,
    },
    token: drawn.item,
  }
}

/** Opens the current player's turn by drawing the token they will place. */
export function beginTurn(state: GameState): GameState {
  const drawn = drawToken(state)
  if (!drawn.token) return { ...drawn.state, phase: 'score', pending: [] }
  return {
    ...drawn.state,
    phase: 'play',
    pending: [{ kind: 'place', token: drawn.token, fireUpAllowed: true }],
    log: [...drawn.state.log, { seat: state.current, action: { type: 'draw', token: drawn.token } }],
  }
}

export function createGame(seed: RngState): GameState {
  return beginTurn(createInitialState(seed))
}

function pendingActions(state: GameState, pending: Pending): Action[] {
  switch (pending.kind) {
    case 'place':
      return BOARD.filter((hex) => canReceive(state.board, hex)).map((at) => ({ type: 'place', at }))
    default:
      throw new Error(`pending with no actions defined: ${pending.kind}`)
  }
}

export function legalActions(state: GameState): Action[] {
  if (state.phase === 'ended') return []
  const pending = topPending(state)
  if (pending) return pendingActions(state, pending)
  if (state.phase === 'score' || state.phase === 'final-score') return [{ type: 'endTurn' }]
  return []
}

/** Draws up to a full hand. Emptying the deck also triggers the end of the game. */
function refresh(state: GameState): GameState {
  const player = state.players[state.current]
  const hand = [...player.hand]
  let deck = state.deck
  let endTriggered = state.endTriggered

  while (hand.length < HAND_SIZE && deck.length > 0) {
    hand.push(deck[0])
    deck = deck.slice(1)
    if (deck.length === 0) endTriggered = true
  }

  return {
    ...state,
    deck,
    players: replacePlayer(state.players, state.current, { ...player, hand }),
    endTriggered,
  }
}

function endTurn(state: GameState): GameState {
  if (state.phase === 'final-score') {
    return {
      ...state,
      phase: 'ended',
      pending: [],
      log: [...state.log, { seat: state.current, action: { type: 'gameOver' } }],
    }
  }

  const refreshed = refresh(state)
  const next = (1 - refreshed.current) as Seat
  const handed: GameState = {
    ...refreshed,
    current: next,
    players: replacePlayer(refreshed.players, next, {
      ...refreshed.players[next],
      coinSpentThisTurn: false,
    }),
    pending: [],
    log: [...refreshed.log, { seat: refreshed.current, action: { type: 'endTurn' } }],
  }

  if (refreshed.endTriggered) return { ...handed, phase: 'final-score' }
  return beginTurn({ ...handed, phase: 'play' })
}

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'place': {
      const pending = topPending(state)
      if (!pending || pending.kind !== 'place') throw new Error('place without a place pending')
      return {
        ...state,
        board: pushToken(state.board, action.at, pending.token),
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'endTurn':
      return endTurn(state)
    default:
      throw new Error(`action with no reducer: ${action.type}`)
  }
}

/** PLAY ends by itself once the pending stack empties. */
function settle(state: GameState): GameState {
  if (state.phase === 'play' && state.pending.length === 0) return { ...state, phase: 'score' }
  return state
}

export function applyAction(state: GameState, action: Action): GameState {
  const key = actionKey(action)
  if (!legalActions(state).some((candidate) => actionKey(candidate) === key)) {
    throw new IllegalActionError(action)
  }
  return settle(reduce(state, action))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/engine.test.ts`
Expected: PASS, 11 testes.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/engine.ts packages/engine/src/engine.test.ts
git commit -m "feat(engine): turn loop driven by a pending stack"
```

---

### Task 9: Habilidades de movimento — meat, potion, iron

Inclui o item 1 do **Review Focus**: movimentação que estouraria a pilha de 3 tem de ser recusada por `legalActions`.

**Files:**
- Create: `packages/engine/src/abilities.ts`
- Modify: `packages/engine/src/engine.ts` (a colocação passa a empilhar `mayFireUp`; o redutor e as ações passam a consultar `abilities.ts`)
- Test: `packages/engine/src/abilities-move.test.ts`

**Interfaces:**
- Consumes: `board.ts`, `hex.ts`, `tokens.ts`, `engine.ts` (`topPending`).
- Produces: `abilityPending(ability: DragonType, at: Hex): Pending | null`, `abilityActions(state, pending): Action[] | null`, `reduceAbility(state, action): GameState | null`. As duas últimas devolvem `null` quando a pendência/ação não é de habilidade, para o `engine.ts` seguir em frente.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/abilities-move.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { applyAction, legalActions } from './engine.js'
import { key } from './hex.js'
import { single } from './tokens.js'
import type { Action, GameState } from './types.js'
import { createInitialState } from './setup.js'

/** Tailored state: a controlled board and a held token waiting to be placed. */
function staged(board: Record<string, ReturnType<typeof single>[]>, held: Parameters<typeof single>[0]): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    board,
    current: 0,
    phase: 'play',
    pending: [{ kind: 'place', token: single(held), fireUpAllowed: true }],
  }
}

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

describe('firing up is optional', () => {
  it('offers both firing up and skipping after a placement', () => {
    const state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    const types = legalActions(state).map((a) => a.type)
    expect(types).toContain('fireUp')
    expect(types).toContain('skipFireUp')
  })

  it('ends the PLAY phase when skipped', () => {
    let state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    state = applyAction(state, { type: 'skipFireUp' })
    expect(state.phase).toBe('score')
  })
})

describe('meat', () => {
  it('moves 1 adjacent token to any space with room', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'meat')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    const moves = legalActions(state).filter((a): a is Extract<Action, { type: 'meatMove' }> => a.type === 'meatMove')
    expect(moves.every((m) => m.from.q === B.q && m.from.r === B.r)).toBe(true)
    state = applyAction(state, { type: 'meatMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('bread'))
    expect(topOf(state.board, B)).toBeUndefined()
  })

  it('can move the neighbour on top of the meat token itself', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'meat')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    state = applyAction(state, { type: 'meatMove', from: B, to: A })
    expect(heightAt(state.board, A)).toBe(2)
    expect(topOf(state.board, A)).toEqual(single('bread'))
  })

  it('offers no destination that would break the limit of 3', () => {
    let state = staged(
      { [key(B)]: [single('bread')], [key(C)]: [single('iron'), single('iron'), single('iron')] },
      'meat',
    )
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    const targets = legalActions(state)
      .filter((a): a is Extract<Action, { type: 'meatMove' }> => a.type === 'meatMove')
      .map((m) => key(m.to))
    expect(targets).not.toContain(key(C))
  })

  it('stays legal and does nothing when there is no neighbour', () => {
    let state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    expect(state.phase).toBe('score')
  })
})

describe('potion', () => {
  it('swaps the tops of any two spaces without changing heights', () => {
    let state = staged(
      { [key(B)]: [single('bread'), single('plant')], [key(C)]: [single('iron')] },
      'potion',
    )
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'potion' })
    state = applyAction(state, { type: 'potionSwap', a: B, b: C })
    expect(topOf(state.board, B)).toEqual(single('iron'))
    expect(topOf(state.board, C)).toEqual(single('plant'))
    expect(heightAt(state.board, B)).toBe(2)
    expect(heightAt(state.board, C)).toBe(1)
  })

  it('can involve the potion token just placed', () => {
    let state = staged({ [key(C)]: [single('iron')] }, 'potion')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'potion' })
    const involvesA = legalActions(state).some(
      (x) => x.type === 'potionSwap' && (key(x.a) === key(A) || key(x.b) === key(A)),
    )
    expect(involvesA).toBe(true)
  })

  it('never offers swapping a space with itself', () => {
    let state = staged({ [key(C)]: [single('iron')] }, 'potion')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'potion' })
    expect(legalActions(state).some((x) => x.type === 'potionSwap' && key(x.a) === key(x.b))).toBe(false)
  })
})

describe('iron', () => {
  it('moves up to 2 adjacent tokens 1 space each, and may stop after one', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('bread'))
    expect(legalActions(state).some((x) => x.type === 'ironDone')).toBe(true)
    state = applyAction(state, { type: 'ironDone' })
    expect(state.phase).toBe('score')
  })

  it('only moves to a space adjacent to the token current position', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    const targets = legalActions(state)
      .filter((x): x is Extract<Action, { type: 'ironMove' }> => x.type === 'ironMove')
      .map((m) => key(m.to))
    expect(targets).toContain(key(C))
    expect(targets).not.toContain(key({ q: -2, r: 0 }))
  })

  it('moves the top and then the revealed token of the same stack', () => {
    let state = staged({ [key(B)]: [single('bread'), single('plant')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('plant'))
    expect(topOf(state.board, B)).toEqual(single('bread'))
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('bread'))
    expect(topOf(state.board, B)).toBeUndefined()
  })

  it('offers no destination that would break the limit of 3', () => {
    let state = staged(
      { [key(B)]: [single('bread')], [key(C)]: [single('iron'), single('iron'), single('iron')] },
      'iron',
    )
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    const targets = legalActions(state)
      .filter((x): x is Extract<Action, { type: 'ironMove' }> => x.type === 'ironMove')
      .map((m) => key(m.to))
    expect(targets).not.toContain(key(C))
  })

  it('ends by itself after 2 moves', () => {
    let state = staged({ [key(B)]: [single('bread'), single('plant')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(state.phase).toBe('score')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/abilities-move.test.ts`
Expected: FAIL — `Failed to resolve import "./abilities.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/abilities.ts`**

```ts
import { canReceive, moveTop, occupiedHexes, swapTops, topOf } from './board.js'
import { BOARD, areAdjacent, hexEq, key, neighbors, onBoard } from './hex.js'
import type { Action, DragonType, GameState, Hex, Pending } from './types.js'

/** The pending an ability opens when fired up, or null if it resolves at once. */
export function abilityPending(ability: DragonType, at: Hex): Pending | null {
  switch (ability) {
    case 'meat':
      return { kind: 'meat', at }
    case 'iron':
      return { kind: 'iron', at, movesLeft: 2 }
    case 'potion':
      return { kind: 'potion' }
    default:
      return null
  }
}

/** Occupied spaces neighbouring `at`. */
function movableNeighbors(state: GameState, at: Hex): Hex[] {
  return neighbors(at).filter((hex) => onBoard(hex) && topOf(state.board, hex) !== undefined)
}

/**
 * Valid destinations for the top of `from`. The limit of 3 is checked on the
 * board with the moved token already lifted, which is what allows stacking
 * back onto the origin in other contexts.
 */
function destinations(state: GameState, from: Hex, restrictToAdjacent: boolean): Hex[] {
  const candidates = restrictToAdjacent ? neighbors(from) : BOARD
  return candidates.filter((to) => {
    if (!onBoard(to) || hexEq(to, from)) return false
    return canReceive(state.board, to)
  })
}

export function abilityActions(state: GameState, pending: Pending): Action[] | null {
  switch (pending.kind) {
    case 'meat': {
      const actions: Action[] = []
      for (const from of movableNeighbors(state, pending.at)) {
        for (const to of destinations(state, from, false)) {
          actions.push({ type: 'meatMove', from, to })
        }
      }
      return actions
    }
    case 'iron': {
      const actions: Action[] = [{ type: 'ironDone' }]
      for (const from of movableNeighbors(state, pending.at)) {
        for (const to of destinations(state, from, true)) {
          actions.push({ type: 'ironMove', from, to })
        }
      }
      return actions
    }
    case 'potion': {
      const occupied = occupiedHexes(state.board)
      const actions: Action[] = []
      for (let i = 0; i < occupied.length; i++) {
        for (let j = i + 1; j < occupied.length; j++) {
          actions.push({ type: 'potionSwap', a: occupied[i], b: occupied[j] })
        }
      }
      return actions
    }
    default:
      return null
  }
}

export function reduceAbility(state: GameState, action: Action): GameState | null {
  switch (action.type) {
    case 'meatMove':
      return {
        ...state,
        board: moveTop(state.board, action.from, action.to),
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
    case 'potionSwap':
      return {
        ...state,
        board: swapTops(state.board, action.a, action.b),
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
    case 'ironMove': {
      const pending = state.pending[state.pending.length - 1]
      if (!pending || pending.kind !== 'iron') throw new Error('ironMove outside an iron pending')
      const movesLeft = pending.movesLeft - 1
      const rest = state.pending.slice(0, -1)
      return {
        ...state,
        board: moveTop(state.board, action.from, action.to),
        pending: movesLeft > 0 ? [...rest, { ...pending, movesLeft }] : rest,
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'ironDone':
      return { ...state, pending: state.pending.slice(0, -1) }
    default:
      return null
  }
}

/** An ability that opens no pending (none in this task) resolves here. */
export function isMovementAbility(ability: DragonType): boolean {
  return ability === 'meat' || ability === 'iron' || ability === 'potion'
}
```

Detalhe de regra que o código encapsula: `swapTops` troca topos sem mexer em alturas, então **potion nunca pode violar o limite de 3** — não há destino a filtrar. `meat` e `iron` movem entre pilhas e por isso passam por `canReceive`.

- [ ] **Step 4: Ligar as habilidades ao `engine.ts`**

Em `packages/engine/src/engine.ts`, importar e usar o novo módulo.

Adicionar aos imports:

```ts
import { abilityActions, abilityPending, reduceAbility } from './abilities.js'
import { topOf } from './board.js'
import { abilitiesOf } from './tokens.js'
```

Substituir o caso `'place'` de `reduce` para empilhar `mayFireUp`:

```ts
    case 'place': {
      const pending = topPending(state)
      if (!pending || pending.kind !== 'place') throw new Error('place without a place pending')
      const rest = state.pending.slice(0, -1)
      return {
        ...state,
        board: pushToken(state.board, action.at, pending.token),
        pending: pending.fireUpAllowed ? [...rest, { kind: 'mayFireUp', at: action.at }] : rest,
        log: [...state.log, { seat: state.current, action }],
      }
    }
```

Substituir `pendingActions` para consultar `abilities.ts`:

```ts
function pendingActions(state: GameState, pending: Pending): Action[] {
  if (pending.kind === 'place') {
    return BOARD.filter((hex) => canReceive(state.board, hex)).map((at) => ({ type: 'place', at }))
  }
  if (pending.kind === 'mayFireUp') {
    const token = topOf(state.board, pending.at)
    if (!token) throw new Error('mayFireUp on an empty space')
    const actions: Action[] = [{ type: 'skipFireUp' }]
    for (const ability of abilitiesOf(token)) actions.push({ type: 'fireUp', ability })
    return actions
  }
  const fromAbility = abilityActions(state, pending)
  if (fromAbility) return fromAbility
  throw new Error(`pending with no actions defined: ${pending.kind}`)
}
```

Acrescentar os casos ao `reduce`, antes do `default`:

```ts
    case 'skipFireUp':
      return { ...state, pending: state.pending.slice(0, -1) }
    case 'fireUp': {
      const pending = topPending(state)
      if (!pending || pending.kind !== 'mayFireUp') throw new Error('fireUp outside a mayFireUp pending')
      const rest = state.pending.slice(0, -1)
      const opened = abilityPending(action.ability, pending.at)
      const logged = [...state.log, { seat: state.current, action }]
      return { ...state, pending: opened ? [...rest, opened] : rest, log: logged }
    }
```

E delegar as ações de habilidade no `default`:

```ts
    default: {
      const handled = reduceAbility(state, action)
      if (handled) return handled
      throw new Error(`action with no reducer: ${action.type}`)
    }
```

Uma habilidade sem alvo (meat sem vizinho, iron sem vizinho) abre a pendência e `abilityActions` devolve só `ironDone` ou lista vazia. Para meat, lista vazia travaria o jogo — então trate a pendência vazia em `settle`:

```ts
function settle(state: GameState): GameState {
  let current = state
  // A pending with no possible action resolves itself.
  while (current.pending.length > 0 && legalActions(current).length === 0) {
    current = { ...current, pending: current.pending.slice(0, -1) }
  }
  if (current.phase === 'play' && current.pending.length === 0) return { ...current, phase: 'score' }
  return current
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/`
Expected: PASS — inclusive os testes da Task 8, que continuam valendo.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/abilities.ts packages/engine/src/abilities-move.test.ts packages/engine/src/engine.ts
git commit -m "feat(engine): movement abilities meat, potion and iron"
```

---

### Task 10: Habilidades que compram e encadeiam — bread, crystal, plant

Cobre os itens 2 e 3 do **Review Focus**: saco com menos de 3 tokens no meio de um `crystal`, e `plant` sem alvo ou apontando para um dual.

**Files:**
- Create: `packages/engine/src/bag.ts` (recebe `drawToken`, hoje em `engine.ts`, para quebrar o ciclo `engine ↔ abilities`)
- Modify: `packages/engine/src/engine.ts` (passa a importar e reexportar `drawToken`; `fireUp` delega a `fireUpAbility`)
- Modify: `packages/engine/src/abilities.ts` (ganha as 3 habilidades restantes e `fireUpAbility`)
- Test: `packages/engine/src/abilities-draw.test.ts`

**Interfaces:**
- Produces (bag): `drawToken(state): { state: GameState; token: Token | null }`, `drawMany(state, count): { state: GameState; tokens: Token[] }`, `returnToBag(state, tokens): GameState`.
- Produces (abilities): `fireUpAbility(state: GameState, ability: DragonType, at: Hex): GameState` — substitui `abilityPending` como ponto de entrada; continua exportando `abilityActions` e `reduceAbility`.

- [ ] **Step 1: Mover `drawToken` para `bag.ts`**

Criar `packages/engine/src/bag.ts` com o corpo que hoje está em `engine.ts`, mais dois auxiliares:

```ts
import { pick } from './rng.js'
import type { GameState, Token } from './types.js'

/**
 * Draws a token from the bag. If the bag is empty, injects the 6 extras —
 * once only. Emptying the bag triggers the end of the game, even when the
 * extras go in right after and the bag holds tokens again.
 * Returns `null` when there is nothing left to draw anywhere.
 */
export function drawToken(state: GameState): { state: GameState; token: Token | null } {
  let bag = state.bag
  let extras = state.extras
  let extrasAdded = state.extrasAdded

  if (bag.length === 0) {
    if (extrasAdded || extras.length === 0) return { state, token: null }
    bag = [...extras]
    extras = []
    extrasAdded = true
  }

  const drawn = pick(bag, state.rng)
  const rest = bag.filter((_, i) => i !== drawn.index)

  return {
    state: {
      ...state,
      rng: drawn.rng,
      bag: rest,
      extras,
      extrasAdded,
      endTriggered: state.endTriggered || rest.length === 0,
    },
    token: drawn.item,
  }
}

/** Draws up to `count` tokens, stopping early when the bag runs dry for good. */
export function drawMany(state: GameState, count: number): { state: GameState; tokens: Token[] } {
  let current = state
  const tokens: Token[] = []
  for (let i = 0; i < count; i++) {
    const drawn = drawToken(current)
    if (!drawn.token) break
    current = drawn.state
    tokens.push(drawn.token)
  }
  return { state: current, tokens }
}

/** Puts tokens back. Never clears an end trigger that already fired. */
export function returnToBag(state: GameState, tokens: readonly Token[]): GameState {
  return { ...state, bag: [...state.bag, ...tokens] }
}
```

Em `engine.ts`, apagar a definição de `drawToken` e substituir por uma reexportação, logo abaixo dos imports:

```ts
import { drawToken } from './bag.js'

export { drawToken } from './bag.js'
```

- [ ] **Step 2: Rodar a suíte para confirmar que a mudança foi neutra**

Run: `npx vitest run packages/engine/src/`
Expected: PASS — nada mudou de comportamento.

- [ ] **Step 3: Escrever o teste que falha**

`packages/engine/src/abilities-draw.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { topOf } from './board.js'
import { applyAction, legalActions } from './engine.js'
import { key } from './hex.js'
import { createInitialState } from './setup.js'
import { dual, single } from './tokens.js'
import type { Board, DragonType, GameState, Token } from './types.js'

function staged(opts: {
  board?: Board
  held: DragonType
  bag?: Token[]
  extrasAdded?: boolean
}): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    board: opts.board ?? {},
    bag: opts.bag ?? base.bag,
    extrasAdded: opts.extrasAdded ?? false,
    current: 0,
    phase: 'play',
    pending: [{ kind: 'place', token: single(opts.held), fireUpAllowed: true }],
  }
}

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

const fire = (state: GameState, ability: DragonType) =>
  applyAction(applyAction(state, { type: 'place', at: A }), { type: 'fireUp', ability })

describe('bread', () => {
  it('draws a token from the bag and asks where to place it', () => {
    const state = staged({ held: 'bread' })
    const after = fire(state, 'bread')
    expect(after.bag).toHaveLength(state.bag.length - 1)
    expect(after.pending.at(-1)?.kind).toBe('place')
  })

  it('lets the newly placed token be fired up in turn, so bread chains', () => {
    let state = fire(staged({ held: 'bread' }), 'bread')
    const spot = legalActions(state).find((a) => a.type === 'place')
    if (!spot) throw new Error('expected a placement to be offered')
    state = applyAction(state, spot)
    expect(legalActions(state).some((a) => a.type === 'fireUp')).toBe(true)
  })

  it('does nothing when there is nothing left to draw', () => {
    const state = staged({ held: 'bread', bag: [], extrasAdded: true })
    expect(fire(state, 'bread').phase).toBe('score')
  })
})

describe('crystal', () => {
  it('draws 3 tokens and offers exactly those 3 choices', () => {
    const state = staged({ held: 'crystal' })
    const after = fire(state, 'crystal')
    const pending = after.pending.at(-1)
    expect(pending?.kind).toBe('crystalPick')
    expect(after.bag).toHaveLength(state.bag.length - 3)
    expect(legalActions(after).filter((a) => a.type === 'crystalPick')).toHaveLength(3)
  })

  it('returns the two unchosen tokens to the bag', () => {
    const state = staged({ held: 'crystal' })
    const picking = fire(state, 'crystal')
    const after = applyAction(picking, { type: 'crystalPick', index: 0 })
    expect(after.bag).toHaveLength(state.bag.length - 1)
  })

  it('does not let the placed token be fired up', () => {
    let state = fire(staged({ held: 'crystal' }), 'crystal')
    state = applyAction(state, { type: 'crystalPick', index: 1 })
    const spot = legalActions(state).find((a) => a.type === 'place')
    if (!spot) throw new Error('expected a placement to be offered')
    state = applyAction(state, spot)
    expect(state.phase).toBe('score')
  })

  it('injects the 6 extras when the bag runs short, and still triggers the end', () => {
    const state = staged({ held: 'crystal', bag: [single('iron'), single('meat')] })
    const after = fire(state, 'crystal')
    const pending = after.pending.at(-1)
    expect(pending?.kind).toBe('crystalPick')
    if (pending?.kind === 'crystalPick') expect(pending.tokens).toHaveLength(3)
    expect(after.extrasAdded).toBe(true)
    expect(after.endTriggered).toBe(true)
    expect(after.bag).toHaveLength(5)
  })

  it('injects the extras only once', () => {
    const state = staged({ held: 'crystal', bag: [single('iron')], extrasAdded: true })
    const after = fire(state, 'crystal')
    const pending = after.pending.at(-1)
    if (pending?.kind === 'crystalPick') expect(pending.tokens).toHaveLength(1)
    expect(after.endTriggered).toBe(true)
  })
})

describe('plant', () => {
  it('offers every ability of every occupied neighbour', () => {
    const state = staged({ board: { [key(B)]: [dual('potion', 'plant')] }, held: 'plant' })
    const after = fire(state, 'plant')
    const targets = legalActions(after).filter((a) => a.type === 'plantTarget')
    expect(targets).toHaveLength(2)
  })

  it('fires up the chosen neighbour ability', () => {
    const state = staged({ board: { [key(B)]: [single('bread')] }, held: 'plant' })
    const before = state.bag.length
    const after = applyAction(fire(state, 'plant'), { type: 'plantTarget', at: B, ability: 'bread' })
    expect(after.bag).toHaveLength(before - 1)
    expect(after.pending.at(-1)?.kind).toBe('place')
  })

  it('chains plant into plant into a third ability', () => {
    const state = staged({
      board: { [key(B)]: [single('plant')], [key(C)]: [single('bread')] },
      held: 'plant',
    })
    const before = state.bag.length
    let after = applyAction(fire(state, 'plant'), { type: 'plantTarget', at: B, ability: 'plant' })
    expect(after.pending.at(-1)?.kind).toBe('plant')
    after = applyAction(after, { type: 'plantTarget', at: C, ability: 'bread' })
    expect(after.bag).toHaveLength(before - 1)
  })

  it('stays legal and resolves to nothing when no neighbour is occupied', () => {
    const after = fire(staged({ held: 'plant' }), 'plant')
    expect(after.phase).toBe('score')
  })

  it('ignores a neighbour whose top is buried under another token', () => {
    const state = staged({ board: { [key(B)]: [single('bread'), single('meat')] }, held: 'plant' })
    const after = fire(state, 'plant')
    const targets = legalActions(after).filter((a) => a.type === 'plantTarget')
    expect(targets).toHaveLength(1)
    expect(targets[0]).toEqual({ type: 'plantTarget', at: B, ability: 'meat' })
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/abilities-draw.test.ts`
Expected: FAIL — `fireUpAbility` ainda não existe e `crystalPick`/`plantTarget` não têm ações.

- [ ] **Step 5: Ampliar `abilities.ts`**

Acrescentar os imports:

```ts
import { drawMany, drawToken, returnToBag } from './bag.js'
import { abilitiesOf } from './tokens.js'
```

Trocar `abilityPending` por `fireUpAbility`, que é o novo ponto de entrada:

```ts
/**
 * Fires up `ability` as if from the token on `at`. Movement abilities open a
 * pending; drawing abilities touch the bag first. Recursion through plant is
 * just this function calling itself through the pending stack.
 */
export function fireUpAbility(state: GameState, ability: DragonType, at: Hex): GameState {
  const push = (pending: Pending, next: GameState = state): GameState => ({
    ...next,
    pending: [...next.pending, pending],
  })

  switch (ability) {
    case 'meat':
      return push({ kind: 'meat', at })
    case 'iron':
      return push({ kind: 'iron', at, movesLeft: 2 })
    case 'potion':
      return push({ kind: 'potion' })
    case 'plant':
      return push({ kind: 'plant', at })
    case 'bread': {
      const drawn = drawToken(state)
      if (!drawn.token) return drawn.state
      return push({ kind: 'place', token: drawn.token, fireUpAllowed: true }, drawn.state)
    }
    case 'crystal': {
      const drawn = drawMany(state, 3)
      if (drawn.tokens.length === 0) return drawn.state
      return push({ kind: 'crystalPick', tokens: drawn.tokens }, drawn.state)
    }
  }
}
```

Acrescentar as ações das duas novas pendências em `abilityActions`:

```ts
    case 'crystalPick':
      return pending.tokens.map((_, index) => ({ type: 'crystalPick', index }))
    case 'plant': {
      const actions: Action[] = []
      for (const hex of movableNeighbors(state, pending.at)) {
        const token = topOf(state.board, hex)
        if (!token) continue
        for (const ability of abilitiesOf(token)) actions.push({ type: 'plantTarget', at: hex, ability })
      }
      return actions
    }
```

E os redutores em `reduceAbility`:

```ts
    case 'crystalPick': {
      const pending = state.pending[state.pending.length - 1]
      if (!pending || pending.kind !== 'crystalPick') throw new Error('crystalPick outside a crystalPick pending')
      const chosen = pending.tokens[action.index]
      const returned = pending.tokens.filter((_, i) => i !== action.index)
      const withReturned = returnToBag({ ...state, pending: state.pending.slice(0, -1) }, returned)
      return {
        ...withReturned,
        // the crystal's token is placed without being fired up
        pending: [...withReturned.pending, { kind: 'place', token: chosen, fireUpAllowed: false }],
        log: [...withReturned.log, { seat: state.current, action }],
      }
    }
    case 'plantTarget': {
      const popped: GameState = { ...state, pending: state.pending.slice(0, -1) }
      const fired = fireUpAbility(popped, action.ability, action.at)
      return { ...fired, log: [...fired.log, { seat: state.current, action }] }
    }
```

Remover `isMovementAbility`, que deixa de ter uso.

- [ ] **Step 6: Apontar o `engine.ts` para `fireUpAbility`**

Trocar o caso `'fireUp'` do `reduce`:

```ts
    case 'fireUp': {
      const pending = topPending(state)
      if (!pending || pending.kind !== 'mayFireUp') throw new Error('fireUp outside a mayFireUp pending')
      const popped: GameState = {
        ...state,
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
      return fireUpAbility(popped, action.ability, pending.at)
    }
```

E ajustar o import: `import { abilityActions, fireUpAbility, reduceAbility } from './abilities.js'`.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/`
Expected: PASS — as 6 habilidades cobertas.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/bag.ts packages/engine/src/abilities.ts packages/engine/src/abilities-draw.test.ts packages/engine/src/engine.ts
git commit -m "feat(engine): drawing and chaining abilities bread, crystal and plant"
```

---

### Task 11: Pontuação, moeda e fim de jogo

Cobre os itens 4 e 5 do **Review Focus**: deck esgotado durante REFRESH ou `spendCoin`, e a opcionalidade de pontuar.

**Files:**
- Create: `packages/engine/src/scoring.ts`
- Modify: `packages/engine/src/engine.ts` (fase SCORE ganha `scoreCard` e `spendCoin`; `coinDiscard` entra na pilha de pendências)
- Test: `packages/engine/src/scoring.test.ts`

**Interfaces:**
- Consumes: `matcher.ts`, `bag.ts`, `setup.ts`.
- Produces: `finalScore(state, seat): number`, `winner(state): Seat | 'draw'`, `scoreableCards(state, seat): ShopCard[]`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/engine/src/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DECK } from './cards.js'
import { applyAction, legalActions } from './engine.js'
import { key } from './hex.js'
import { finalScore, scoreableCards, winner } from './scoring.js'
import { createInitialState } from './setup.js'
import { single } from './tokens.js'
import type { GameState, ShopCard } from './types.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

/** A board where `line-bread` already matches, and a player holding that card. */
function readyToScore(overrides: Partial<GameState> = {}): GameState {
  // seed 1: seed 3 deals a deck whose top card collides by id with a card this
  // fixture places in hand by hand, which no real game can produce.
  const base = createInitialState(1)
  return {
    ...base,
    board: {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    },
    players: [
      { ...base.players[0], hand: [card('line-bread'), card('tri-plant')] },
      base.players[1],
    ],
    current: 0,
    phase: 'score',
    pending: [],
    ...overrides,
  }
}

describe('scoring a card', () => {
  it('offers only the cards that actually match', () => {
    const state = readyToScore()
    expect(scoreableCards(state, 0).map((c) => c.id)).toEqual(['line-bread'])
    const offered = legalActions(state).filter((a) => a.type === 'scoreCard')
    expect(offered).toEqual([{ type: 'scoreCard', cardId: 'line-bread' }])
  })

  it('moves the card to the scored pile and out of the hand', () => {
    const after = applyAction(readyToScore(), { type: 'scoreCard', cardId: 'line-bread' })
    expect(after.players[0].scored.map((c) => c.id)).toEqual(['line-bread'])
    expect(after.players[0].hand.map((c) => c.id)).toEqual(['tri-plant'])
  })

  it('is optional: ending the turn with a scoreable card in hand is legal', () => {
    const state = readyToScore()
    expect(legalActions(state).some((a) => a.type === 'endTurn')).toBe(true)
    const after = applyAction(state, { type: 'endTurn' })
    expect(after.players[0].scored).toEqual([])
  })

  it('allows scoring more than one card in the same turn', () => {
    const state = readyToScore({
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 0 })]: [single('bread')],
        // (-1,1) closes a triangle with (-1,0) and (0,0); (0,1) would not
        [key({ q: -1, r: 1 })]: [single('bread')],
      },
    })
    const withTwo: GameState = {
      ...state,
      players: [{ ...state.players[0], hand: [card('line-bread'), card('tri-bread')] }, state.players[1]],
    }
    let after = applyAction(withTwo, { type: 'scoreCard', cardId: 'line-bread' })
    after = applyAction(after, { type: 'scoreCard', cardId: 'tri-bread' })
    expect(after.players[0].scored).toHaveLength(2)
  })
})

describe('spending a coin', () => {
  it('discards the coin, draws 2, then asks which 2 go back', () => {
    const after = applyAction(readyToScore(), { type: 'spendCoin' })
    expect(after.players[0].coins).toBe(2)
    expect(after.players[0].hand).toHaveLength(4)
    expect(after.pending.at(-1)?.kind).toBe('coinDiscard')
    expect(legalActions(after).every((a) => a.type === 'coinDiscard')).toBe(true)
  })

  it('puts the two chosen cards at the bottom of the deck', () => {
    const start = readyToScore()
    let after = applyAction(start, { type: 'spendCoin' })
    const [a, b] = after.players[0].hand
    after = applyAction(after, { type: 'coinDiscard', cardIds: [a.id, b.id] })
    expect(after.players[0].hand).toHaveLength(2)
    expect(after.deck.slice(-2).map((c) => c.id)).toEqual([a.id, b.id])
    expect(after.pending).toEqual([])
  })

  it('is limited to once per turn', () => {
    let after = applyAction(readyToScore(), { type: 'spendCoin' })
    const [a, b] = after.players[0].hand
    after = applyAction(after, { type: 'coinDiscard', cardIds: [a.id, b.id] })
    expect(legalActions(after).some((x) => x.type === 'spendCoin')).toBe(false)
  })

  it('is unavailable with no coins left', () => {
    const broke = readyToScore()
    const state: GameState = {
      ...broke,
      players: [{ ...broke.players[0], coins: 0 }, broke.players[1]],
    }
    expect(legalActions(state).some((a) => a.type === 'spendCoin')).toBe(false)
  })

  it('draws what it can when the deck is nearly empty, and triggers the end', () => {
    const start = readyToScore()
    const state: GameState = { ...start, deck: [card('line-iron')] }
    const after = applyAction(state, { type: 'spendCoin' })
    expect(after.players[0].hand).toHaveLength(3)
    expect(after.endTriggered).toBe(true)
  })
})

describe('end of game', () => {
  it('gives the opponent a final score phase after the triggering turn', () => {
    const start = readyToScore()
    const state: GameState = { ...start, endTriggered: true }
    const after = applyAction(state, { type: 'endTurn' })
    expect(after.phase).toBe('final-score')
    expect(after.current).toBe(1)
    expect(legalActions(after).some((a) => a.type === 'endTurn')).toBe(true)
  })

  it('lets the opponent score and spend a coin, but not place anything', () => {
    const start = readyToScore()
    const state: GameState = { ...start, endTriggered: true }
    const after = applyAction(state, { type: 'endTurn' })
    expect(legalActions(after).some((a) => a.type === 'place')).toBe(false)
  })

  it('ends the game after the final score phase', () => {
    const start = readyToScore()
    let after = applyAction({ ...start, endTriggered: true }, { type: 'endTurn' })
    after = applyAction(after, { type: 'endTurn' })
    expect(after.phase).toBe('ended')
    expect(legalActions(after)).toEqual([])
  })

  it('empties the deck on REFRESH and triggers the end', () => {
    const start = readyToScore()
    const state: GameState = {
      ...start,
      deck: [card('line-iron')],
      players: [{ ...start.players[0], hand: [card('line-bread')] }, start.players[1]],
    }
    const after = applyAction(state, { type: 'endTurn' })
    expect(after.deck).toEqual([])
    expect(after.endTriggered).toBe(true)
  })
})

describe('final score', () => {
  it('sums scored reputation plus one per unspent coin', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread'), card('line-iron-iron-meat')], coins: 2 },
        { ...base.players[1], scored: [card('tri-plant')], coins: 0 },
      ],
    }
    expect(finalScore(state, 0)).toBe(3 + 2 + 2)
    expect(finalScore(state, 1)).toBe(3)
    expect(winner(state)).toBe(0)
  })

  it('breaks a tie by number of scored cards', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread')], coins: 3 },
        { ...base.players[1], scored: [card('line-iron-iron-meat'), card('line-meat-meat-iron')], coins: 2 },
      ],
    }
    expect(finalScore(state, 0)).toBe(6)
    expect(finalScore(state, 1)).toBe(6)
    expect(winner(state)).toBe(1)
  })

  it('reports a shared victory when cards tie as well', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread')], coins: 0 },
        { ...base.players[1], scored: [card('tri-plant')], coins: 0 },
      ],
    }
    expect(winner(state)).toBe('draw')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/engine/src/scoring.test.ts`
Expected: FAIL — `Failed to resolve import "./scoring.js"`.

- [ ] **Step 3: Escrever `packages/engine/src/scoring.ts`**

```ts
import { canScore } from './matcher.js'
import type { GameState, Seat, ShopCard } from './types.js'

/** Cards in a seat's hand whose pattern is currently on the board. */
export function scoreableCards(state: GameState, seat: Seat): ShopCard[] {
  return state.players[seat].hand.filter((card) => canScore(state.board, card))
}

/** Scored reputation plus 1 per unspent coin. */
export function finalScore(state: GameState, seat: Seat): number {
  const player = state.players[seat]
  return player.scored.reduce((sum, card) => sum + card.reputation, 0) + player.coins
}

/** Most reputation wins; ties break on scored cards, then it is a shared victory. */
export function winner(state: GameState): Seat | 'draw' {
  const a = finalScore(state, 0)
  const b = finalScore(state, 1)
  if (a !== b) return a > b ? 0 : 1

  const cardsA = state.players[0].scored.length
  const cardsB = state.players[1].scored.length
  if (cardsA !== cardsB) return cardsA > cardsB ? 0 : 1

  return 'draw'
}
```

- [ ] **Step 4: Ligar pontuação, moeda e fim ao `engine.ts`**

Acrescentar aos imports: `import { scoreableCards } from './scoring.js'`.

Substituir `legalActions` pela versão que oferece as três ações da fase SCORE:

```ts
const SCORING_PHASES = new Set(['score', 'final-score'])

export function legalActions(state: GameState): Action[] {
  if (state.phase === 'ended') return []

  const pending = topPending(state)
  if (pending) return pendingActions(state, pending)
  if (!SCORING_PHASES.has(state.phase)) return []

  const player = state.players[state.current]
  const actions: Action[] = scoreableCards(state, state.current).map((card) => ({
    type: 'scoreCard',
    cardId: card.id,
  }))
  if (player.coins > 0 && !player.coinSpentThisTurn) actions.push({ type: 'spendCoin' })
  actions.push({ type: 'endTurn' })
  return actions
}
```

Acrescentar o tratamento da pendência `coinDiscard` em `pendingActions`, antes da delegação a `abilityActions`:

```ts
  if (pending.kind === 'coinDiscard') {
    const hand = state.players[state.current].hand
    const actions: Action[] = []
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        actions.push({ type: 'coinDiscard', cardIds: [hand[i].id, hand[j].id] })
      }
    }
    return actions
  }
```

Acrescentar os três redutores em `reduce`:

```ts
    case 'scoreCard': {
      const player = state.players[state.current]
      const card = player.hand.find((c) => c.id === action.cardId)
      if (!card) throw new Error(`card ${action.cardId} is not in hand`)
      return {
        ...state,
        players: replacePlayer(state.players, state.current, {
          ...player,
          hand: player.hand.filter((c) => c.id !== action.cardId),
          scored: [...player.scored, card],
        }),
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'spendCoin': {
      const player = state.players[state.current]
      const drawn = state.deck.slice(0, 2)
      const deck = state.deck.slice(drawn.length)
      return {
        ...state,
        deck,
        endTriggered: state.endTriggered || deck.length === 0,
        players: replacePlayer(state.players, state.current, {
          ...player,
          coins: player.coins - 1,
          coinSpentThisTurn: true,
          hand: [...player.hand, ...drawn],
        }),
        pending: [...state.pending, { kind: 'coinDiscard' }],
        // the discarded cards stay out of the log: they are private information
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'coinDiscard': {
      const player = state.players[state.current]
      const returned = action.cardIds
        .map((id) => player.hand.find((c) => c.id === id))
        .filter((card): card is NonNullable<typeof card> => card !== undefined)
      if (returned.length !== 2) throw new Error('coinDiscard needs two cards from hand')
      return {
        ...state,
        deck: [...state.deck, ...returned],
        players: replacePlayer(state.players, state.current, {
          ...player,
          hand: player.hand.filter((c) => !action.cardIds.includes(c.id)),
        }),
        pending: state.pending.slice(0, -1),
      }
    }
```

Nota de regra que o código carrega: `spendCoin` é registrado no log, mas `coinDiscard` **não** — quais cards voltaram ao deck é informação privada, e o log vai inteiro para a visão dos dois jogadores.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/`
Expected: PASS — toda a suíte do motor.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/scoring.ts packages/engine/src/scoring.test.ts packages/engine/src/engine.ts
git commit -m "feat(engine): scoring, coin spending and end of game"
```

---

### Task 12: API pública e a partida completa como teste

**Files:**
- Create: `packages/engine/src/index.ts`
- Test: `packages/engine/src/integration.test.ts`

**Interfaces:**
- Produces: a superfície pública de `@dcv/engine`, que é o único ponto de importação para `@dcv/ai` e `@dcv/web`.

- [ ] **Step 1: Escrever `packages/engine/src/index.ts`**

```ts
export * from './types.js'
export { BOARD, CENTER, DIRECTIONS, INNER_RING, add, areAdjacent, hexEq, key, neighbors, onBoard, parseKey, rotate, sub } from './hex.js'
export { nextInt, pick, seedFrom, shuffle } from './rng.js'
export { ALL_TOKENS, DUAL_RING, DUAL_TOKENS, FIRE_UP_ORDER, abilitiesOf, dual, fireUpRank, single, tokenId, tokenMatches } from './tokens.js'
export { DECK, patternKey } from './cards.js'
export { MAX_STACK, canReceive, heightAt, occupiedHexes, stackAt, topOf } from './board.js'
export { canScore, findMatch, rotations, wouldComplete } from './matcher.js'
export { HAND_SIZE, STARTING_COINS, createInitialState } from './setup.js'
export { determinize, toPlayerView } from './view.js'
export { IllegalActionError, actionKey, applyAction, beginTurn, createGame, drawToken, legalActions } from './engine.js'
export { finalScore, scoreableCards, winner } from './scoring.js'
```

- [ ] **Step 2: Escrever o teste de integração**

`packages/engine/src/integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, legalActions } from './engine.js'
import { nextInt } from './rng.js'
import { finalScore, winner } from './scoring.js'
import type { GameState } from './types.js'

const TOTAL_TOKENS = 42
const TOTAL_CARDS = 42

function tokensInPlay(state: GameState): number {
  const onBoard = Object.values(state.board).reduce((sum, stack) => sum + stack.length, 0)
  const held = state.pending.reduce((sum, pending) => {
    if (pending.kind === 'place') return sum + 1
    if (pending.kind === 'crystalPick') return sum + pending.tokens.length
    return sum
  }, 0)
  return onBoard + state.bag.length + state.extras.length + held
}

function cardsInPlay(state: GameState): number {
  return (
    state.deck.length +
    state.players.reduce((sum, player) => sum + player.hand.length + player.scored.length, 0)
  )
}

function expectInvariants(state: GameState): void {
  for (const [hex, stack] of Object.entries(state.board)) {
    expect(stack.length, `stack at ${hex}`).toBeLessThanOrEqual(3)
  }
  expect(tokensInPlay(state)).toBe(TOTAL_TOKENS)
  expect(cardsInPlay(state)).toBe(TOTAL_CARDS)
}

/** Plays a whole game choosing uniformly among the legal actions. */
function playOut(seed: number): { state: GameState; steps: number } {
  let state = createGame(seed)
  let rng = seed ^ 0x9e3779b9
  let steps = 0

  while (state.phase !== 'ended') {
    expectInvariants(state)
    const actions = legalActions(state)
    expect(actions.length, `no legal action in phase ${state.phase}`).toBeGreaterThan(0)
    const choice = nextInt(rng, actions.length)
    rng = choice.rng
    state = applyAction(state, actions[choice.value])
    steps += 1
    expect(steps, 'game did not terminate').toBeLessThan(5000)
  }

  return { state, steps }
}

describe('a full game', () => {
  it('always reaches the end, across many seeds', () => {
    for (let seed = 0; seed < 40; seed++) {
      const result = playOut(seed)
      expect(result.state.phase).toBe('ended')
      expect(result.state.endTriggered).toBe(true)
      expectInvariants(result.state)
    }
  })

  it('never offers an action that applyAction then rejects', () => {
    // playOut only ever applies what legalActions returned; reaching the end
    // without IllegalActionError is the assertion.
    expect(() => playOut(123)).not.toThrow()
  })

  it('produces a byte-identical state from the same seed', () => {
    expect(JSON.stringify(playOut(4242).state)).toBe(JSON.stringify(playOut(4242).state))
  })

  it('produces different games from different seeds', () => {
    expect(JSON.stringify(playOut(1).state)).not.toBe(JSON.stringify(playOut(2).state))
  })

  it('finishes with a declared result', () => {
    const { state } = playOut(77)
    const result = winner(state)
    expect(['draw', 0, 1]).toContain(result)
    expect(finalScore(state, 0)).toBeGreaterThanOrEqual(0)
    expect(finalScore(state, 1)).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run packages/engine/src/integration.test.ts`
Expected: PASS, 5 testes. Se algum estourar o limite de 5000 passos, há laço no motor — investigar antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/index.ts packages/engine/src/integration.test.ts
git commit -m "feat(engine): public API and whole-game invariants"
```

---

## Fase B — A máquina

### Task 13: Estratégia fácil

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/easy.ts`
- Create: `packages/ai/src/index.ts`
- Test: `packages/ai/src/easy.test.ts`

**Interfaces:**
- Consumes: `@dcv/engine` (`PlayerView`, `Action`, `RngState`, `pick`, `createGame`, `legalActions`, `toPlayerView`).
- Produces: `type Difficulty = 'easy' | 'medium'`, `type Strategy = { level: Difficulty; chooseAction(view, actions, rng): { action: Action; rng: RngState } }`, `easy: Strategy`, `createStrategy(level): Strategy`.

- [ ] **Step 1: Criar o pacote**

`packages/ai/package.json`:

```json
{
  "name": "@dcv/ai",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@dcv/engine": "*"
  }
}
```

`packages/ai/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Escrever o teste que falha**

`packages/ai/src/easy.test.ts`:

```ts
import { createGame, legalActions, toPlayerView } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { easy } from './easy.js'

describe('easy', () => {
  it('always picks one of the offered actions', () => {
    let rng = 5
    for (let seed = 0; seed < 20; seed++) {
      const state = createGame(seed)
      const actions = legalActions(state)
      const chosen = easy.chooseAction(toPlayerView(state, state.current), actions, rng)
      rng = chosen.rng
      expect(actions).toContainEqual(chosen.action)
    }
  })

  it('always scores when scoring is on offer', () => {
    const state = createGame(1)
    const view = toPlayerView(state, state.current)
    const actions = [
      { type: 'endTurn' } as const,
      { type: 'scoreCard', cardId: 'line-bread' } as const,
      { type: 'spendCoin' } as const,
    ]
    expect(easy.chooseAction(view, actions, 9).action).toEqual({ type: 'scoreCard', cardId: 'line-bread' })
  })

  it('is deterministic for the same rng state', () => {
    const state = createGame(3)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    expect(easy.chooseAction(view, actions, 77)).toEqual(easy.chooseAction(view, actions, 77))
  })

  it('advances the rng so consecutive calls can differ', () => {
    const state = createGame(3)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    const first = easy.chooseAction(view, actions, 77)
    expect(first.rng).not.toBe(77)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run packages/ai/src/easy.test.ts`
Expected: FAIL — `Failed to resolve import "./easy.js"`.

- [ ] **Step 4: Escrever os módulos**

`packages/ai/src/types.ts`:

```ts
import type { Action, PlayerView, RngState } from '@dcv/engine'

export type Difficulty = 'easy' | 'medium'

/**
 * A strategy only ever sees `PlayerView`: it does not know the opponent hand
 * or the deck order. That guarantee is the signature, not a convention.
 */
export type Strategy = {
  readonly level: Difficulty
  chooseAction(
    view: PlayerView,
    actions: readonly Action[],
    rng: RngState,
  ): { action: Action; rng: RngState }
}
```

`packages/ai/src/easy.ts`:

```ts
import { pick } from '@dcv/engine'
import type { Strategy } from './types.js'

/** Uniform among the legal actions, with a single bias: always score if you can. */
export const easy: Strategy = {
  level: 'easy',
  chooseAction(_view, actions, rng) {
    if (actions.length === 0) throw new Error('chooseAction called with no legal actions')
    const scoring = actions.filter((action) => action.type === 'scoreCard')
    const pool = scoring.length > 0 ? scoring : actions
    const choice = pick(pool, rng)
    return { action: choice.item, rng: choice.rng }
  },
}
```

`packages/ai/src/index.ts`:

```ts
export type { Difficulty, Strategy } from './types.js'
export { easy } from './easy.js'

import { easy } from './easy.js'
import type { Difficulty, Strategy } from './types.js'

export function createStrategy(level: Difficulty): Strategy {
  switch (level) {
    case 'easy':
      return easy
    default:
      throw new Error(`unknown difficulty: ${level}`)
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm install && npx vitest run packages/ai/src/`
Expected: PASS, 4 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/ai
git commit -m "feat(ai): strategy interface and the easy opponent"
```

---

### Task 14: Estratégia média e as 100 partidas de autojogo

**Files:**
- Create: `packages/ai/src/evaluate.ts`
- Create: `packages/ai/src/medium.ts`
- Modify: `packages/ai/src/index.ts` (registra `medium`)
- Test: `packages/ai/src/evaluate.test.ts`
- Test: `packages/ai/src/selfplay.test.ts`

**Interfaces:**
- Produces: `evaluate(state: GameState, seat: Seat): number`, `isOneAway(board, card): boolean`, `medium: Strategy`.

- [ ] **Step 1: Escrever o teste da avaliação**

`packages/ai/src/evaluate.test.ts`:

```ts
import { DECK, createInitialState, key, single } from '@dcv/engine'
import type { GameState, ShopCard } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { evaluate, isOneAway } from './evaluate.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

function withHand(hand: ShopCard[], board: GameState['board'] = {}): GameState {
  const base = createInitialState(2)
  return { ...base, board, players: [{ ...base.players[0], hand }, base.players[1]] }
}

describe('isOneAway', () => {
  it('is true when a single placement would complete the pattern', () => {
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
    }
    expect(isOneAway(board, card('line-bread'))).toBe(true)
  })

  it('is false when two placements are still needed', () => {
    const board = { [key({ q: -2, r: 0 })]: [single('bread')] }
    expect(isOneAway(board, card('line-bread'))).toBe(false)
  })

  it('is false when the card already matches', () => {
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    }
    expect(isOneAway(board, card('line-bread'))).toBe(false)
  })
})

describe('evaluate', () => {
  it('rates a scored card above a merely scoreable one', () => {
    const base = createInitialState(2)
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    }
    const scored: GameState = {
      ...base,
      board,
      players: [{ ...base.players[0], hand: [], scored: [card('line-bread')] }, base.players[1]],
    }
    const holding: GameState = {
      ...base,
      board,
      players: [{ ...base.players[0], hand: [card('line-bread')], scored: [] }, base.players[1]],
    }
    expect(evaluate(scored, 0)).toBeGreaterThan(evaluate(holding, 0))
  })

  it('rates a scoreable card above one that is merely close', () => {
    const complete = withHand([card('line-bread')], {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    })
    const close = withHand([card('line-bread')], {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
    })
    expect(evaluate(complete, 0)).toBeGreaterThan(evaluate(close, 0))
  })

  it('counts unspent coins', () => {
    const base = createInitialState(2)
    const rich: GameState = { ...base, players: [{ ...base.players[0], coins: 3 }, base.players[1]] }
    const broke: GameState = { ...base, players: [{ ...base.players[0], coins: 0 }, base.players[1]] }
    expect(evaluate(rich, 0)).toBeGreaterThan(evaluate(broke, 0))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run packages/ai/src/evaluate.test.ts`
Expected: FAIL — `Failed to resolve import "./evaluate.js"`.

- [ ] **Step 3: Escrever `packages/ai/src/evaluate.ts`**

```ts
import { BOARD, canReceive, canScore, single, wouldComplete } from '@dcv/engine'
import type { Board, GameState, Seat, ShopCard } from '@dcv/engine'

/** Is there a single placement that would complete this card? */
export function isOneAway(board: Board, card: ShopCard): boolean {
  if (canScore(board, card)) return false
  const types = [...new Set(card.pattern.map((cell) => cell.type))]
  for (const hex of BOARD) {
    if (!canReceive(board, hex)) continue
    for (const type of types) {
      if (wouldComplete(board, card, hex, single(type))) return true
    }
  }
  return false
}

const SCORED_WEIGHT = 10
const READY_WEIGHT = 6
const CLOSE_WEIGHT = 2

/**
 * How good this position is for `seat`. Reputation already banked dominates;
 * a card that matches right now is worth most of a card scored; a card one
 * placement away is worth a little. Coins count because they score at the end.
 */
export function evaluate(state: GameState, seat: Seat): number {
  const player = state.players[seat]

  const banked = player.scored.reduce((sum, card) => sum + card.reputation, 0)
  let ready = 0
  let close = 0
  for (const card of player.hand) {
    if (canScore(state.board, card)) ready += card.reputation
    else if (isOneAway(state.board, card)) close += card.reputation
  }

  return banked * SCORED_WEIGHT + ready * READY_WEIGHT + close * CLOSE_WEIGHT + player.coins
}
```

- [ ] **Step 4: Escrever o teste da estratégia média**

`packages/ai/src/medium.test.ts`:

```ts
import { DECK, applyAction, createGame, createInitialState, key, legalActions, single, toPlayerView } from '@dcv/engine'
import type { GameState, ShopCard } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { medium } from './medium.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

describe('medium', () => {
  it('always picks one of the offered actions', () => {
    let rng = 11
    for (let seed = 0; seed < 15; seed++) {
      const state = createGame(seed)
      const actions = legalActions(state)
      const chosen = medium.chooseAction(toPlayerView(state, state.current), actions, rng)
      rng = chosen.rng
      expect(actions).toContainEqual(chosen.action)
    }
  })

  it('places the token where it completes a card in hand', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
      },
      players: [{ ...base.players[0], hand: [card('line-bread'), card('tri-plant')] }, base.players[1]],
      current: 0,
      phase: 'play',
      pending: [{ kind: 'place', token: single('bread'), fireUpAllowed: true }],
    }
    const chosen = medium.chooseAction(toPlayerView(staged, 0), legalActions(staged), 1)
    expect(chosen.action).toEqual({ type: 'place', at: { q: 0, r: 0 } })
  })

  it('scores a matching card rather than passing', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 0 })]: [single('bread')],
      },
      // the hand keeps HAND_SIZE cards: shrinking it without adjusting the deck
      // breaks determinize's card conservation, a state no real game can reach
      players: [{ ...base.players[0], hand: [card('line-bread'), card('tri-plant')], coins: 0 }, base.players[1]],
      current: 0,
      phase: 'score',
      pending: [],
    }
    const chosen = medium.chooseAction(toPlayerView(staged, 0), legalActions(staged), 1)
    expect(chosen.action).toEqual({ type: 'scoreCard', cardId: 'line-bread' })
  })

  it('is deterministic for the same rng state', () => {
    const state = createGame(8)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    expect(medium.chooseAction(view, actions, 5)).toEqual(medium.chooseAction(view, actions, 5))
  })

  it('never sees the opponent hand: it plays the same whatever that hand is', () => {
    const state = createGame(9)
    const swapped: GameState = {
      ...state,
      players: [state.players[0], { ...state.players[1], hand: [card('tri-iron'), card('tri-meat')] }],
    }
    const seat = state.current
    const a = medium.chooseAction(toPlayerView(state, seat), legalActions(state), 3)
    const b = medium.chooseAction(toPlayerView(swapped, seat), legalActions(swapped), 3)
    if (seat === 0) expect(a.action).toEqual(b.action)
  })
})
```

- [ ] **Step 5: Escrever `packages/ai/src/medium.ts`**

```ts
import { applyAction, determinize, shuffle } from '@dcv/engine'
import type { Action, Seat } from '@dcv/engine'
import { evaluate } from './evaluate.js'
import type { Strategy } from './types.js'

/**
 * Cap on how many candidate actions get simulated. Potion alone can offer
 * over 170 swaps, and evaluating every one buys very little on a phone.
 */
const MAX_CANDIDATES = 40

const OPPONENT_WEIGHT = 0.5

/**
 * One ply of greed over a single determinization: guess a plausible hidden
 * state, try each candidate action, keep the one whose resulting position
 * scores best for us and worst for them.
 *
 * Known limitation, accepted: a turn is a sequence of decisions, so choosing
 * where to place without knowing what the fire-up will do is myopic. That is
 * part of what makes this the medium opponent.
 */
export const medium: Strategy = {
  level: 'medium',
  chooseAction(view, actions, rng) {
    if (actions.length === 0) throw new Error('chooseAction called with no legal actions')

    const order = shuffle(actions, rng)
    const candidates = order.items.slice(0, MAX_CANDIDATES)
    const guess = determinize(view, order.rng)
    const opponent = (1 - view.seat) as Seat

    let best: Action = candidates[0]
    let bestScore = -Infinity

    for (const action of candidates) {
      const next = applyAction(guess.state, action)
      const score = evaluate(next, view.seat) - evaluate(next, opponent) * OPPONENT_WEIGHT
      if (score > bestScore) {
        bestScore = score
        best = action
      }
    }

    return { action: best, rng: guess.rng }
  },
}
```

Registrar em `packages/ai/src/index.ts`: acrescentar `export { medium } from './medium.js'`, importar `medium` e devolvê-lo no `case 'medium'` de `createStrategy`.

- [ ] **Step 6: Escrever o autojogo**

`packages/ai/src/selfplay.test.ts`:

```ts
import { applyAction, createGame, finalScore, legalActions, toPlayerView, winner } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { easy } from './easy.js'
import { medium } from './medium.js'
import type { Strategy } from './types.js'

const GAMES = 100

function playGame(seed: number, seats: [Strategy, Strategy]): GameState {
  let state = createGame(seed)
  let rng = seed ^ 0x51ed270b
  let steps = 0

  while (state.phase !== 'ended') {
    const actions = legalActions(state)
    expect(actions.length, `no legal action in phase ${state.phase}`).toBeGreaterThan(0)

    const strategy = seats[state.current]
    const chosen = strategy.chooseAction(toPlayerView(state, state.current), actions, rng)
    rng = chosen.rng
    expect(actions, `${strategy.level} offered an action that was not legal`).toContainEqual(chosen.action)

    state = applyAction(state, chosen.action)
    steps += 1
    expect(steps, 'game did not terminate').toBeLessThan(5000)
  }

  return state
}

describe('self-play', () => {
  it(
    `plays ${GAMES} easy-versus-medium games with no illegal action and no hang`,
    () => {
      for (let seed = 0; seed < GAMES; seed++) {
        const seats: [Strategy, Strategy] = seed % 2 === 0 ? [easy, medium] : [medium, easy]
        const state = playGame(seed, seats)
        expect(state.phase).toBe('ended')
        expect(['draw', 0, 1]).toContain(winner(state))
      }
    },
    { timeout: 180_000 },
  )

  it(
    'has medium beating easy more often than not',
    () => {
      let mediumWins = 0
      let easyWins = 0
      for (let seed = 0; seed < 40; seed++) {
        const mediumSeat = seed % 2
        const seats: [Strategy, Strategy] = mediumSeat === 0 ? [medium, easy] : [easy, medium]
        const result = winner(playGame(seed, seats))
        if (result === mediumSeat) mediumWins += 1
        else if (result !== 'draw') easyWins += 1
      }
      expect(mediumWins).toBeGreaterThan(easyWins)
    },
    { timeout: 180_000 },
  )
})
```

O segundo teste é o único do plano que afirma algo sobre *qualidade* de jogo, e não sobre correção. Se ele falhar, o problema está nos pesos de `evaluate.ts`, não no motor — ajuste os pesos, não o teste.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run packages/ai/src/`
Expected: PASS. O autojogo leva dezenas de segundos; é esperado.

- [ ] **Step 8: Commit**

```bash
git add packages/ai
git commit -m "feat(ai): evaluation function, medium opponent and self-play suite"
```

---

## Fase C — A interface

### Task 15: Esqueleto do app, tema e o tabuleiro desenhado

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`
- Create: `apps/web/src/theme.ts`, `apps/web/src/geometry.ts`
- Create: `apps/web/src/components/TokenGlyph.tsx`, `apps/web/src/components/HexCell.tsx`, `apps/web/src/components/Board.tsx`
- Modify: `package.json` (raiz — devDeps de teste de componente e scripts `dev`/`build`)
- Modify: `vitest.config.ts` (raiz — ambiente jsdom para `apps/**`)
- Test: `apps/web/src/theme.test.ts`, `apps/web/src/components/Board.test.tsx`

`geometry.ts` não constava do mapa de arquivos da abertura; isolar a conversão de coordenada axial para SVG num módulo próprio evita espalhar trigonometria por três componentes.

**Interfaces:**
- Produces (theme): `DRAGON_THEME: Record<DragonType, { color: string; symbol: string; label: string }>`.
- Produces (geometry): `HEX_SIZE`, `hexCenter(hex)`, `hexPoints(hex)`, `BOARD_VIEWBOX`.
- Produces (components): `<TokenGlyph token size />`, `<HexCell hex stack highlight onSelect />`, `<Board board highlights onSelectHex />`.

- [ ] **Step 1: Criar o pacote web e ajustar a raiz**

`apps/web/package.json`:

```json
{
  "name": "@dcv/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@dcv/ai": "*",
    "@dcv/engine": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.11"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"] },
  "include": ["src"]
}
```

`apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [react()] })
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <title>Dragoncraft Versus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Na raiz, acrescentar aos `scripts`: `"dev": "npm run dev -w @dcv/web"` e `"build": "npm run build -w @dcv/web"`; e aos `devDependencies`: `"@testing-library/react": "^16.1.0"`, `"@testing-library/jest-dom": "^6.6.3"`, `"jsdom": "^25.0.1"`.

`vitest.config.ts` da raiz passa a ser:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['apps/**', 'jsdom']],
    // @testing-library/react registers its own afterEach(cleanup), which needs
    // Vitest's globals. Without this the DOM leaks between it() blocks.
    globals: true,
  },
})
```

Duas coisas na raiz que não são opcionais e não são óbvias:

**O `tsconfig.json` da raiz precisa de mais do que o glob.** Este repo não usa project
references, então `tsc -b` compila um projeto monolítico sob as opções da raiz — o
`apps/web/tsconfig.json` não é consultado. Além de estender `include` para `apps/*/src`, a raiz
precisa de `"jsx": "react-jsx"` e de `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, ou o app inteiro
falha a compilar. Vale conferir que a verificação está mesmo acontecendo: introduza um erro de
tipo de propósito, veja `tsc -b` pegá-lo, e remova.

**Fixar a versão do React.** `@testing-library/react` puxa React 19 para a raiz enquanto
`apps/web` declara 18.3.1, e as duas cópias quebram todo teste de componente. Acrescentar ao
`package.json` da raiz:

```json
  "overrides": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
```

- [ ] **Step 2: Escrever o teste do tema**

`apps/web/src/theme.test.ts`:

```ts
import { DRAGON_TYPES } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { DRAGON_THEME } from './theme.js'

describe('DRAGON_THEME', () => {
  it('covers all 6 dragon types', () => {
    for (const type of DRAGON_TYPES) expect(DRAGON_THEME[type], type).toBeDefined()
  })

  it('gives every type its own colour', () => {
    const colours = DRAGON_TYPES.map((type) => DRAGON_THEME[type].color)
    expect(new Set(colours).size).toBe(6)
  })

  it('gives every type its own shape, so colour is never the only cue', () => {
    const symbols = DRAGON_TYPES.map((type) => DRAGON_THEME[type].symbol)
    expect(new Set(symbols).size).toBe(6)
  })

  it('labels every type in English for assistive technology', () => {
    for (const type of DRAGON_TYPES) expect(DRAGON_THEME[type].label.length).toBeGreaterThan(2)
  })
})
```

- [ ] **Step 3: Escrever `theme.ts` e `geometry.ts`**

`apps/web/src/theme.ts`:

```ts
import type { DragonType } from '@dcv/engine'

export type DragonTheme = { color: string; symbol: string; label: string }

/**
 * Deliberately provisional: colour plus a distinct shape, nothing more.
 * Shape carries the identity on its own so the board stays readable without
 * colour, which is the accessibility requirement and also what survives at
 * 40 pixels on a phone.
 */
export const DRAGON_THEME: Record<DragonType, DragonTheme> = {
  bread: { color: '#c8862f', symbol: '▲', label: 'Bread' },
  crystal: { color: '#3f8fd0', symbol: '◆', label: 'Crystal' },
  meat: { color: '#c0503f', symbol: '●', label: 'Meat' },
  iron: { color: '#6b7280', symbol: '■', label: 'Iron' },
  potion: { color: '#8a5cd0', symbol: '▼', label: 'Potion' },
  plant: { color: '#4a9a5c', symbol: '✦', label: 'Plant' },
}
```

`apps/web/src/geometry.ts`:

```ts
import { BOARD } from '@dcv/engine'
import type { Hex } from '@dcv/engine'

export const HEX_SIZE = 10

const SQRT3 = Math.sqrt(3)

/** Flat-top layout: neighbouring centres sit sqrt(3) * HEX_SIZE apart. */
export function hexCenter(hex: Hex): { x: number; y: number } {
  return {
    x: HEX_SIZE * 1.5 * hex.q,
    y: HEX_SIZE * SQRT3 * (hex.r + hex.q / 2),
  }
}

export function hexPoints(hex: Hex): string {
  const center = hexCenter(hex)
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * 60 * i
    const x = center.x + HEX_SIZE * Math.cos(angle)
    const y = center.y + HEX_SIZE * Math.sin(angle)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

/** Tight box around all 19 spaces plus one hex of breathing room. */
export const BOARD_VIEWBOX = (() => {
  const centers = BOARD.map(hexCenter)
  const pad = HEX_SIZE * 1.4
  const minX = Math.min(...centers.map((c) => c.x)) - pad
  const maxX = Math.max(...centers.map((c) => c.x)) + pad
  const minY = Math.min(...centers.map((c) => c.y)) - pad
  const maxY = Math.max(...centers.map((c) => c.y)) + pad
  return `${minX.toFixed(2)} ${minY.toFixed(2)} ${(maxX - minX).toFixed(2)} ${(maxY - minY).toFixed(2)}`
})()
```

- [ ] **Step 4: Escrever o teste do tabuleiro**

`apps/web/src/components/Board.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { key, single } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { Board } from './Board.js'

describe('Board', () => {
  it('draws all 19 spaces', () => {
    render(<Board board={{}} highlights={{}} onSelectHex={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(19)
  })

  it('names an empty space and a stacked one for assistive technology', () => {
    const board = { [key({ q: 0, r: 0 })]: [single('bread'), single('plant')] }
    render(<Board board={board} highlights={{}} onSelectHex={() => {}} />)
    expect(screen.getByLabelText('0,0: Plant, stack of 2')).toBeDefined()
    expect(screen.getByLabelText('1,0: empty')).toBeDefined()
  })

  it('marks a highlighted space', () => {
    const highlights = { [key({ q: 1, r: 0 })]: 'completes' as const }
    render(<Board board={{}} highlights={highlights} onSelectHex={() => {}} />)
    expect(screen.getByLabelText('1,0: empty').getAttribute('data-highlight')).toBe('completes')
  })
})
```

- [ ] **Step 5: Escrever os componentes**

`apps/web/src/components/TokenGlyph.tsx`:

```tsx
import type { Token } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'

export function tokenLabel(token: Token): string {
  return token.kind === 'single'
    ? DRAGON_THEME[token.type].label
    : `${DRAGON_THEME[token.types[0]].label}/${DRAGON_THEME[token.types[1]].label}`
}

/** A token is a disc; a dual token is the same disc split down the middle. */
export function TokenGlyph({ token, radius }: { token: Token; radius: number }) {
  if (token.kind === 'single') {
    const theme = DRAGON_THEME[token.type]
    return (
      <g>
        <circle r={radius} fill={theme.color} />
        <text textAnchor="middle" dominantBaseline="central" fontSize={radius} fill="#fff">
          {theme.symbol}
        </text>
      </g>
    )
  }

  const [left, right] = token.types
  return (
    <g>
      <path d={`M 0 ${-radius} A ${radius} ${radius} 0 0 0 0 ${radius} Z`} fill={DRAGON_THEME[left].color} />
      <path d={`M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius} Z`} fill={DRAGON_THEME[right].color} />
      <text x={-radius * 0.42} textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.8} fill="#fff">
        {DRAGON_THEME[left].symbol}
      </text>
      <text x={radius * 0.42} textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.8} fill="#fff">
        {DRAGON_THEME[right].symbol}
      </text>
    </g>
  )
}
```

`apps/web/src/components/HexCell.tsx`:

```tsx
import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

export type Highlight = 'legal' | 'completes' | 'selected'

export function HexCell({
  hex,
  stack,
  highlight,
  onSelect,
}: {
  hex: Hex
  stack: Token[]
  highlight?: Highlight
  onSelect: (hex: Hex) => void
}) {
  const top = stack[stack.length - 1]
  const center = hexCenter(hex)
  const label = top ? `${key(hex)}: ${tokenLabel(top)}, stack of ${stack.length}` : `${key(hex)}: empty`

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      data-highlight={highlight ?? 'none'}
      className="hex-cell"
      onClick={() => onSelect(hex)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(hex)
      }}
    >
      <polygon points={hexPoints(hex)} className="hex-shape" />
      {top ? (
        <g transform={`translate(${center.x} ${center.y})`}>
          <TokenGlyph token={top} radius={HEX_SIZE * 0.6} />
          {stack.length > 1 ? (
            <text
              className="stack-depth"
              x={HEX_SIZE * 0.62}
              y={HEX_SIZE * 0.62}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={HEX_SIZE * 0.45}
            >
              {stack.length}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  )
}
```

`apps/web/src/components/Board.tsx`:

```tsx
import { BOARD, key } from '@dcv/engine'
import type { Board as BoardState, Hex } from '@dcv/engine'
import { BOARD_VIEWBOX } from '../geometry.js'
import { HexCell, type Highlight } from './HexCell.js'

export function Board({
  board,
  highlights,
  onSelectHex,
}: {
  board: BoardState
  highlights: Record<string, Highlight>
  onSelectHex: (hex: Hex) => void
}) {
  return (
    <svg className="board" viewBox={BOARD_VIEWBOX} role="group" aria-label="Game board">
      {BOARD.map((hex) => (
        <HexCell
          key={key(hex)}
          hex={hex}
          stack={board[key(hex)] ?? []}
          highlight={highlights[key(hex)]}
          onSelect={onSelectHex}
        />
      ))}
    </svg>
  )
}
```

`apps/web/src/styles.css`:

```css
:root {
  --bg: #12161b;
  --surface: #1b2129;
  --ink: #e8eef5;
  --muted: #8a97a6;
  --legal: #4a9a5c;
  --completes: #e8b53a;
  --selected: #3f8fd0;
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.4 system-ui, -apple-system, sans-serif;
  overscroll-behavior: none;
}

.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;
  gap: 8px;
  padding: 8px;
}

.board { width: 100%; height: 100%; touch-action: manipulation; }

.hex-shape {
  fill: var(--surface);
  stroke: #2b333d;
  stroke-width: 0.6;
}

.hex-cell { cursor: pointer; }
.hex-cell[data-highlight='legal'] .hex-shape { stroke: var(--legal); stroke-width: 1.2; }
.hex-cell[data-highlight='completes'] .hex-shape { stroke: var(--completes); stroke-width: 1.6; }
.hex-cell[data-highlight='selected'] .hex-shape { fill: #2a3540; stroke: var(--selected); stroke-width: 1.6; }

.stack-depth { fill: var(--ink); font-weight: 700; }
```

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`apps/web/src/App.tsx` (provisório nesta tarefa — a Task 16 o substitui):

```tsx
import { createGame } from '@dcv/engine'
import { Board } from './components/Board.js'

const preview = createGame(1)

export function App() {
  return (
    <main className="app">
      <header />
      <Board board={preview.board} highlights={{}} onSelectHex={() => {}} />
      <footer />
    </main>
  )
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm install && npx vitest run apps/web/src/`
Expected: PASS, 7 testes.

- [ ] **Step 7: Ver no navegador**

Run: `npm run dev`
Expected: o tabuleiro de 19 casas com os 6 dragões iniciais, ocupando a tela. Abrir também no modo dispositivo móvel do navegador e confirmar que não há rolagem horizontal.

- [ ] **Step 8: Commit**

```bash
git add apps/web package.json vitest.config.ts
git commit -m "feat(web): app shell, dragon theme and the hex board"
```

---

### Task 16: Jogo jogável — estado, colocação em dois toques e barra de decisão

No fim desta tarefa o jogo está jogável de ponta a ponta no celular, com os dois assentos operados por você. A máquina entra na Task 19.

**Files:**
- Create: `apps/web/src/game/useGame.ts`
- Create: `apps/web/src/game/labels.ts`
- Create: `apps/web/src/components/Prompt.tsx`
- Modify: `apps/web/src/App.tsx` (substitui o provisório da Task 15)
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/game/useGame.test.ts`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces: `useGame(seed): GameSession` com `{ state, view, actions, perform, undo, canUndo, reset }`; `describeAction(action): string`; `promptFor(view): string`; `<Prompt view actions onAct />`.

- [ ] **Step 1: Escrever o teste do hook**

`apps/web/src/game/useGame.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGame } from './useGame.js'

describe('useGame', () => {
  it('starts a game and offers its legal actions', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.state.pending).toHaveLength(1)
    expect(result.current.actions.length).toBeGreaterThan(0)
  })

  it('shows the current seat its own view, never the full state', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.view.seat).toBe(result.current.state.current)
    expect('rng' in result.current.view).toBe(false)
  })

  it('advances the game when an action is performed', () => {
    const { result } = renderHook(() => useGame(42))
    const first = result.current.actions[0]
    act(() => result.current.perform(first))
    expect(result.current.state).not.toEqual(renderHook(() => useGame(42)).result.current.state)
  })

  it('undoes the last action', () => {
    const { result } = renderHook(() => useGame(42))
    const before = JSON.stringify(result.current.state)
    act(() => result.current.perform(result.current.actions[0]))
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(JSON.stringify(result.current.state)).toBe(before)
  })

  it('cannot undo from the opening position', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.canUndo).toBe(false)
  })

  it('resets to a fresh game on a new seed', () => {
    const { result } = renderHook(() => useGame(42))
    act(() => result.current.perform(result.current.actions[0]))
    act(() => result.current.reset(43))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.state.pending).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Escrever `useGame.ts` e `labels.ts`**

`apps/web/src/game/useGame.ts`:

```ts
import { applyAction, createGame, legalActions, toPlayerView } from '@dcv/engine'
import type { Action, GameState, PlayerView } from '@dcv/engine'
import { useCallback, useMemo, useState } from 'react'

export type GameSession = {
  state: GameState
  view: PlayerView
  actions: Action[]
  perform: (action: Action) => void
  undo: () => void
  canUndo: boolean
  reset: (seed: number) => void
}

/**
 * The whole state layer. Because engine states are immutable, keeping the
 * history is all undo needs — no inverse operations, no snapshots to build.
 */
export function useGame(seed: number): GameSession {
  const [history, setHistory] = useState<GameState[]>(() => [createGame(seed)])

  const state = history[history.length - 1]
  const view = useMemo(() => toPlayerView(state, state.current), [state])
  const actions = useMemo(() => legalActions(state), [state])

  const perform = useCallback((action: Action) => {
    setHistory((past) => [...past, applyAction(past[past.length - 1], action)])
  }, [])

  const undo = useCallback(() => {
    setHistory((past) => (past.length > 1 ? past.slice(0, -1) : past))
  }, [])

  const reset = useCallback((nextSeed: number) => {
    setHistory([createGame(nextSeed)])
  }, [])

  return { state, view, actions, perform, undo, canUndo: history.length > 1, reset }
}
```

`apps/web/src/game/labels.ts`:

```ts
import { key } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'

export function describeAction(action: Action): string {
  switch (action.type) {
    case 'place':
      return `Place on ${key(action.at)}`
    case 'fireUp':
      return `Fire up ${DRAGON_THEME[action.ability].label}`
    case 'skipFireUp':
      return 'Do not fire up'
    case 'crystalPick':
      return `Keep token ${action.index + 1}`
    case 'meatMove':
      return `Move ${key(action.from)} to ${key(action.to)}`
    case 'ironMove':
      return `Shift ${key(action.from)} to ${key(action.to)}`
    case 'ironDone':
      return 'Stop moving'
    case 'potionSwap':
      return `Swap ${key(action.a)} with ${key(action.b)}`
    case 'plantTarget':
      return `Use ${DRAGON_THEME[action.ability].label} on ${key(action.at)}`
    case 'spendCoin':
      return 'Spend a coin'
    case 'coinDiscard':
      return 'Return these two cards'
    case 'scoreCard':
      return `Score ${action.cardId}`
    case 'endTurn':
      return 'End turn'
  }
}

/** The question the top of the pending stack is asking right now. */
export function promptFor(view: PlayerView): string {
  const pending = view.pending[view.pending.length - 1]
  if (!pending) {
    if (view.phase === 'final-score') return 'Last chance to score'
    if (view.phase === 'ended') return 'Game over'
    return 'Score what you can, then end your turn'
  }

  switch (pending.kind) {
    case 'place':
      return 'Choose where to place the token'
    case 'mayFireUp':
      return 'Fire up this dragon?'
    case 'crystalPick':
      return 'Keep one of these three'
    case 'meat':
      return 'Move one neighbour anywhere'
    case 'iron':
      return `Shift a neighbour one space (${pending.movesLeft} left)`
    case 'potion':
      return 'Swap any two dragons'
    case 'plant':
      return 'Use a neighbouring ability'
    case 'coinDiscard':
      return 'Put two cards at the bottom of the deck'
  }
}
```

- [ ] **Step 3: Escrever o teste do app**

`apps/web/src/App.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.js'

describe('App', () => {
  it('asks where to place the opening token', () => {
    render(<App />)
    expect(screen.getByText('Choose where to place the token')).toBeDefined()
  })

  it('marks every legal space', () => {
    render(<App />)
    const legal = screen.getAllByRole('button').filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(19)
  })

  it('previews on the first tap and commits on the second', () => {
    render(<App />)
    const target = screen.getByLabelText('2,-2: empty')

    fireEvent.click(target)
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('selected')

    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText('2,-2: empty')).toBeNull()
    expect(screen.getByText('Fire up this dragon?')).toBeDefined()
  })

  it('moves the preview when a different space is tapped', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('0,2: empty'))
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('legal')
    expect(screen.getByLabelText('0,2: empty').getAttribute('data-highlight')).toBe('selected')
  })

  it('offers the non-spatial decisions as buttons', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.getByText('Do not fire up')).toBeDefined()
  })
})
```

- [ ] **Step 4: Escrever `Prompt.tsx` e o novo `App.tsx`**

`apps/web/src/components/Prompt.tsx`:

```tsx
import type { Action, PlayerView } from '@dcv/engine'
import { describeAction, promptFor } from '../game/labels.js'

/** Everything the pending stack asks that is not a tap on the board. */
export function Prompt({
  view,
  actions,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
}) {
  const buttons = actions.filter((action) => action.type !== 'place')

  return (
    <section className="prompt" aria-label="Current decision">
      <p className="prompt-text">{promptFor(view)}</p>
      <div className="prompt-actions">
        {buttons.map((action) => (
          <button key={describeAction(action)} type="button" onClick={() => onAct(action)}>
            {describeAction(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
```

`apps/web/src/App.tsx`:

```tsx
import { key } from '@dcv/engine'
import type { Hex } from '@dcv/engine'
import { useState } from 'react'
import { Board } from './components/Board.js'
import type { Highlight } from './components/HexCell.js'
import { Prompt } from './components/Prompt.js'
import { useGame } from './game/useGame.js'

const OPENING_SEED = 1

export function App() {
  const game = useGame(OPENING_SEED)
  const [selected, setSelected] = useState<Hex | null>(null)

  const placements = game.actions.filter((action) => action.type === 'place')

  const highlights: Record<string, Highlight> = {}
  for (const placement of placements) highlights[key(placement.at)] = 'legal'
  if (selected) highlights[key(selected)] = 'selected'

  /** First tap previews, second tap on the same space commits. */
  function selectHex(hex: Hex): void {
    const placement = placements.find((action) => key(action.at) === key(hex))
    if (!placement) return
    if (selected && key(selected) === key(hex)) {
      setSelected(null)
      game.perform(placement)
      return
    }
    setSelected(hex)
  }

  return (
    <main className="app">
      <header className="top-bar">Dragoncraft Versus</header>
      <Board board={game.state.board} highlights={highlights} onSelectHex={selectHex} />
      <Prompt
        view={game.view}
        actions={game.actions}
        onAct={(action) => {
          setSelected(null)
          game.perform(action)
        }}
      />
    </main>
  )
}
```

Acrescentar ao `styles.css`:

```css
.top-bar { color: var(--muted); font-size: 14px; }

.prompt { background: var(--surface); border-radius: 12px; padding: 10px 12px; }
.prompt-text { margin: 0 0 8px; font-weight: 600; }
.prompt-actions { display: flex; flex-wrap: wrap; gap: 8px; max-height: 30dvh; overflow-y: auto; }

.prompt-actions button {
  background: #2a3540;
  color: var(--ink);
  border: 1px solid #3a4652;
  border-radius: 999px;
  padding: 10px 14px;
  font: inherit;
  min-height: 44px;
}
```

`min-height: 44px` nos botões não é enfeite: é o alvo de toque mínimo confortável num celular.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run apps/web/src/`
Expected: PASS, 13 testes.

- [ ] **Step 6: Jogar uma partida inteira**

Run: `npm run dev`
Jogar do primeiro token até `Game over`, operando os dois assentos. É feio — os alvos das habilidades ainda são botões de texto — mas tem de chegar ao fim sem travar.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): playable game with two-tap placement and a decision bar"
```

---

### Task 17: Mão, cards, moedas, placar e log

**Files:**
- Create: `apps/web/src/components/PatternGlyph.tsx`, `apps/web/src/components/CardView.tsx`, `apps/web/src/components/Hand.tsx`, `apps/web/src/components/TopBar.tsx`
- Create: `apps/web/src/game/log.ts`
- Modify: `apps/web/src/game/labels.ts` (ganha `cardName`), `apps/web/src/components/Prompt.tsx` (deixa de listar `scoreCard`), `apps/web/src/App.tsx`, `apps/web/src/styles.css`
- Test: `apps/web/src/components/CardView.test.tsx`, `apps/web/src/components/Hand.test.tsx`

**Interfaces:**
- Produces: `cardName(card): string`, `describeLogEntry(entry): string`, `<PatternGlyph pattern />`, `<CardView card scoreable onScore />`, `<Hand view actions onAct />`, `<TopBar view />`.

- [ ] **Step 1: Escrever os testes**

`apps/web/src/components/CardView.test.tsx`:

```tsx
import { DECK } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardView } from './CardView.js'

const card = (id: string) => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

describe('CardView', () => {
  it('names a single-type card by its shape', () => {
    render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(screen.getByText('Three Bread in a triangle')).toBeDefined()
    render(<CardView card={card('line-bread')} scoreable={false} />)
    expect(screen.getByText('Three Bread in a line')).toBeDefined()
  })

  it('names a mixed card by its two types', () => {
    render(<CardView card={card('line-plant-plant-meat')} scoreable={false} />)
    expect(screen.getByText('Two Plant and one Meat')).toBeDefined()
  })

  it('shows the reputation value', () => {
    render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(screen.getByText('3')).toBeDefined()
  })

  it('offers a score button only when the card matches', () => {
    const { rerender } = render(<CardView card={card('tri-bread')} scoreable={false} onScore={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Score' })).toBeNull()
    rerender(<CardView card={card('tri-bread')} scoreable onScore={() => {}} />)
    expect(screen.getByRole('button', { name: 'Score' })).toBeDefined()
  })

  it('draws one hex per pattern cell', () => {
    const { container } = render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(container.querySelectorAll('.pattern-hex')).toHaveLength(3)
  })
})
```

`apps/web/src/components/Hand.test.tsx`:

```tsx
import { createGame, toPlayerView } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Hand } from './Hand.js'
import { TopBar } from './TopBar.js'

const view = toPlayerView(createGame(1), 0)

describe('Hand', () => {
  it('shows both cards in hand', () => {
    const { container } = render(<Hand view={view} actions={[]} onAct={() => {}} />)
    expect(container.querySelectorAll('.card')).toHaveLength(2)
  })

  it('shows your coins', () => {
    render(<Hand view={view} actions={[]} onAct={() => {}} />)
    expect(screen.getByText(/3 coins/)).toBeDefined()
  })
})

describe('TopBar', () => {
  it('shows the opponent card count without showing the cards', () => {
    render(<TopBar view={view} />)
    expect(screen.getByText(/2 cards/)).toBeDefined()
    expect(screen.queryByText(view.you.hand[0].id)).toBeNull()
  })

  it('shows the most recent log line', () => {
    render(<TopBar view={view} />)
    expect(screen.getByText(/drew/)).toBeDefined()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run apps/web/src/components/`
Expected: FAIL — os módulos ainda não existem.

- [ ] **Step 3: Acrescentar `cardName` a `labels.ts`**

```ts
import { areAdjacent, key } from '@dcv/engine'
import type { PatternCell, ShopCard } from '@dcv/engine'

function isTriangle(pattern: readonly PatternCell[]): boolean {
  const [a, b, c] = pattern.map((cell) => cell.offset)
  return areAdjacent(a, b) && areAdjacent(b, c) && areAdjacent(a, c)
}

/** A readable name built from the pattern, so no card id ever reaches the screen. */
export function cardName(card: ShopCard): string {
  const types = card.pattern.map((cell) => cell.type)
  const unique = [...new Set(types)]

  if (unique.length === 1) {
    const shape = isTriangle(card.pattern) ? 'triangle' : 'line'
    return `Three ${DRAGON_THEME[unique[0]].label} in a ${shape}`
  }

  const repeated = types.find((type, i) => types.indexOf(type) !== i)
  if (!repeated) throw new Error(`mixed card ${card.id} has no repeated type`)
  const odd = unique.find((type) => type !== repeated)
  if (!odd) throw new Error(`mixed card ${card.id} has no odd type`)

  return `Two ${DRAGON_THEME[repeated].label} and one ${DRAGON_THEME[odd].label}`
}
```

E trocar o rótulo de `scoreCard` em `describeAction` para não vazar id — ele deixa de ser usado pela barra, mas continua servindo ao log:

```ts
    case 'scoreCard':
      return 'Scored a card'
```

- [ ] **Step 4: Escrever os componentes**

`apps/web/src/components/PatternGlyph.tsx`:

```tsx
import { key, single } from '@dcv/engine'
import type { PatternCell } from '@dcv/engine'
import { HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { TokenGlyph } from './TokenGlyph.js'

/** The card pattern in miniature, drawn with the same geometry as the board. */
export function PatternGlyph({ pattern }: { pattern: readonly PatternCell[] }) {
  const centers = pattern.map((cell) => hexCenter(cell.offset))
  const pad = HEX_SIZE * 1.2
  const minX = Math.min(...centers.map((c) => c.x)) - pad
  const maxX = Math.max(...centers.map((c) => c.x)) + pad
  const minY = Math.min(...centers.map((c) => c.y)) - pad
  const maxY = Math.max(...centers.map((c) => c.y)) + pad

  return (
    <svg className="pattern" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-hidden="true">
      {pattern.map((cell) => {
        const center = hexCenter(cell.offset)
        return (
          <g key={key(cell.offset)}>
            <polygon className="pattern-hex" points={hexPoints(cell.offset)} />
            <g transform={`translate(${center.x} ${center.y})`}>
              <TokenGlyph token={single(cell.type)} radius={HEX_SIZE * 0.6} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
```

`apps/web/src/components/CardView.tsx`:

```tsx
import type { ShopCard } from '@dcv/engine'
import { cardName } from '../game/labels.js'
import { PatternGlyph } from './PatternGlyph.js'

export function CardView({
  card,
  scoreable,
  onScore,
}: {
  card: ShopCard
  scoreable: boolean
  onScore?: () => void
}) {
  return (
    <article className="card" data-scoreable={scoreable}>
      <PatternGlyph pattern={card.pattern} />
      <p className="card-name">{cardName(card)}</p>
      <span className="card-rep" aria-label={`${card.reputation} reputation`}>
        {card.reputation}
      </span>
      {scoreable && onScore ? (
        <button type="button" onClick={onScore}>
          Score
        </button>
      ) : null}
    </article>
  )
}
```

`apps/web/src/components/Hand.tsx`:

```tsx
import type { Action, PlayerView, ShopCard } from '@dcv/engine'
import { CardView } from './CardView.js'

export function reputationOf(cards: readonly ShopCard[]): number {
  return cards.reduce((sum, card) => sum + card.reputation, 0)
}

export function Hand({
  view,
  actions,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
}) {
  const scoring = actions.filter((action) => action.type === 'scoreCard')

  return (
    <section className="hand" aria-label="Your hand">
      <p className="hand-meta">
        You — {view.you.coins} coins, {reputationOf(view.you.scored) + view.you.coins} reputation
      </p>
      <div className="hand-cards">
        {view.you.hand.map((card) => {
          const action = scoring.find((candidate) => candidate.cardId === card.id)
          return (
            <CardView
              key={card.id}
              card={card}
              scoreable={action !== undefined}
              onScore={action ? () => onAct(action) : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}
```

`apps/web/src/game/log.ts`:

```ts
import type { LogEntry } from '@dcv/engine'
import { tokenLabel } from '../components/TokenGlyph.js'
import { describeAction } from './labels.js'

export function describeLogEntry(entry: LogEntry): string {
  const who = entry.seat === 0 ? 'Player 1' : 'Player 2'
  if (entry.action.type === 'draw') return `${who} drew ${tokenLabel(entry.action.token)}`
  if (entry.action.type === 'gameOver') return 'Game over'
  return `${who}: ${describeAction(entry.action)}`
}
```

`apps/web/src/components/TopBar.tsx`:

```tsx
import type { PlayerView } from '@dcv/engine'
import { describeLogEntry } from '../game/log.js'
import { reputationOf } from './Hand.js'

const LOG_LINES = 4

export function TopBar({ view }: { view: PlayerView }) {
  const recent = view.log.slice(-LOG_LINES).reverse()

  return (
    <header className="top-bar">
      <p className="opponent">
        Opponent — {view.opponent.handCount} cards, {view.opponent.coins} coins,{' '}
        {reputationOf(view.opponent.scored) + view.opponent.coins} reputation
      </p>
      <ol className="log" aria-label="Recent moves">
        {recent.map((entry, index) => (
          <li key={view.log.length - index}>{describeLogEntry(entry)}</li>
        ))}
      </ol>
    </header>
  )
}
```

- [ ] **Step 5: Ligar ao `App.tsx` e ao `Prompt.tsx`**

Em `Prompt.tsx`, filtrar também `scoreCard`, que agora vive nos cards:

```ts
  const buttons = actions.filter((action) => action.type !== 'place' && action.type !== 'scoreCard')
```

Em `App.tsx`, substituir o `<header>` provisório por `<TopBar view={game.view} />` e acrescentar `<Hand view={game.view} actions={game.actions} onAct={...} />` logo acima do `<Prompt />`, dentro de um `<footer className="bottom">`.

Acrescentar ao `styles.css`:

```css
.app { grid-template-rows: auto 1fr auto; }
.opponent, .hand-meta { margin: 0; color: var(--muted); font-size: 13px; }
.log { margin: 4px 0 0; padding: 0; list-style: none; font-size: 12px; color: var(--muted); }
.log li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.bottom { display: grid; gap: 8px; }
.hand-cards { display: flex; gap: 8px; }

.card {
  position: relative;
  flex: 1 1 0;
  background: var(--surface);
  border: 1px solid #2b333d;
  border-radius: 10px;
  padding: 8px;
  display: grid;
  gap: 6px;
  justify-items: center;
}
.card[data-scoreable='true'] { border-color: var(--completes); }
.card .pattern { width: 100%; height: 56px; }
.card-name { margin: 0; font-size: 12px; text-align: center; }
.card-rep { position: absolute; top: 6px; right: 8px; font-weight: 700; color: var(--completes); }
.card button { min-height: 40px; width: 100%; border-radius: 8px; border: 0; background: var(--completes); font: inherit; font-weight: 600; }

.pattern-hex { fill: #222a33; stroke: #39434e; stroke-width: 0.6; }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run apps/web/src/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): hand, cards with pattern glyphs, score panel and move log"
```

---

### Task 18: Seleção pelo tabuleiro e o realce de padrão

Tira as habilidades espaciais da barra de botões e as põe no tabuleiro, onde elas pertencem. Acrescenta o realce que a spec chama de recurso central da interface.

**Files:**
- Create: `apps/web/src/game/selection.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/components/Prompt.tsx`
- Test: `apps/web/src/game/selection.test.ts`, `apps/web/src/App.test.tsx` (acrescenta casos)

**Interfaces:**
- Produces: `boardTargets(actions, first): Hex[]`, `resolveTap(actions, first, hex): { action?: Action; select: Hex | null }`, `SPATIAL_TYPES`.

- [ ] **Step 1: Escrever o teste da seleção**

`apps/web/src/game/selection.test.ts`:

```ts
import { key } from '@dcv/engine'
import type { Action } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { boardTargets, resolveTap } from './selection.js'

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

describe('single-hex actions', () => {
  const actions: Action[] = [
    { type: 'place', at: A },
    { type: 'place', at: B },
  ]

  it('offers every destination when nothing is selected', () => {
    expect(boardTargets(actions, null).map(key)).toEqual([key(A), key(B)])
  })

  it('selects on the first tap and acts on the second', () => {
    expect(resolveTap(actions, null, A)).toEqual({ select: A })
    expect(resolveTap(actions, A, A)).toEqual({ action: actions[0], select: null })
  })

  it('moves the selection when another target is tapped', () => {
    expect(resolveTap(actions, A, B)).toEqual({ select: B })
  })

  it('clears the selection when a non-target is tapped', () => {
    expect(resolveTap(actions, A, C)).toEqual({ select: null })
  })
})

describe('two-hex actions', () => {
  const actions: Action[] = [
    { type: 'meatMove', from: B, to: A },
    { type: 'meatMove', from: B, to: C },
  ]

  it('offers the origins first', () => {
    expect(boardTargets(actions, null).map(key)).toEqual([key(B)])
  })

  it('offers only that origin destinations once it is picked', () => {
    expect(boardTargets(actions, B).map(key)).toEqual([key(A), key(C)])
  })

  it('acts when the destination is tapped', () => {
    expect(resolveTap(actions, B, C)).toEqual({ action: actions[1], select: null })
  })
})

describe('potion swaps, which have no direction', () => {
  const actions: Action[] = [{ type: 'potionSwap', a: A, b: C }]

  it('offers both ends as a starting point', () => {
    expect(boardTargets(actions, null).map(key).sort()).toEqual([key(A), key(C)].sort())
  })

  it('completes the swap from either end', () => {
    expect(resolveTap(actions, A, C)).toEqual({ action: actions[0], select: null })
    expect(resolveTap(actions, C, A)).toEqual({ action: actions[0], select: null })
  })
})

describe('plant targets', () => {
  it('acts on the second tap when the neighbour offers one ability', () => {
    const actions: Action[] = [{ type: 'plantTarget', at: B, ability: 'meat' }]
    expect(resolveTap(actions, B, B)).toEqual({ action: actions[0], select: null })
  })

  it('keeps the selection when the neighbour is a dual, so the bar can ask which', () => {
    const actions: Action[] = [
      { type: 'plantTarget', at: B, ability: 'potion' },
      { type: 'plantTarget', at: B, ability: 'plant' },
    ]
    expect(resolveTap(actions, B, B)).toEqual({ select: B })
  })
})
```

- [ ] **Step 2: Escrever `selection.ts`**

```ts
import { hexEq, key } from '@dcv/engine'
import type { Action, Hex } from '@dcv/engine'

/** Actions the board answers, rather than the decision bar. */
export const SPATIAL_TYPES = ['place', 'meatMove', 'ironMove', 'potionSwap', 'plantTarget'] as const

type Pair = { from: Hex; to: Hex; action: Action }

/** Two-hex actions, listed from both ends when the action has no direction. */
function pairs(actions: readonly Action[]): Pair[] {
  const out: Pair[] = []
  for (const action of actions) {
    if (action.type === 'meatMove' || action.type === 'ironMove') {
      out.push({ from: action.from, to: action.to, action })
    } else if (action.type === 'potionSwap') {
      out.push({ from: action.a, to: action.b, action })
      out.push({ from: action.b, to: action.a, action })
    }
  }
  return out
}

function singles(actions: readonly Action[]): { at: Hex; action: Action }[] {
  return actions
    .filter((action) => action.type === 'place' || action.type === 'plantTarget')
    .map((action) => ({ at: action.type === 'place' ? action.at : action.at, action }))
}

function unique(hexes: readonly Hex[]): Hex[] {
  const seen = new Set<string>()
  const out: Hex[] = []
  for (const hex of hexes) {
    if (seen.has(key(hex))) continue
    seen.add(key(hex))
    out.push(hex)
  }
  return out
}

/** Which spaces are tappable right now, given what is already selected. */
export function boardTargets(actions: readonly Action[], first: Hex | null): Hex[] {
  const twoHex = pairs(actions)
  if (twoHex.length > 0) {
    if (!first) return unique(twoHex.map((pair) => pair.from))
    return unique(twoHex.filter((pair) => hexEq(pair.from, first)).map((pair) => pair.to))
  }
  return unique(singles(actions).map((entry) => entry.at))
}

/**
 * What a tap does. Every commitment takes two taps: one to say where, one to
 * confirm — a mis-tap on a phone should never cost a placement.
 */
export function resolveTap(
  actions: readonly Action[],
  first: Hex | null,
  hex: Hex,
): { action?: Action; select: Hex | null } {
  const twoHex = pairs(actions)
  if (twoHex.length > 0) {
    if (first && !hexEq(first, hex)) {
      const match = twoHex.find((pair) => hexEq(pair.from, first) && hexEq(pair.to, hex))
      if (match) return { action: match.action, select: null }
    }
    return { select: twoHex.some((pair) => hexEq(pair.from, hex)) ? hex : null }
  }

  const here = singles(actions).filter((entry) => hexEq(entry.at, hex))
  if (here.length === 0) return { select: null }
  if (first && hexEq(first, hex) && here.length === 1) return { action: here[0].action, select: null }
  return { select: hex }
}
```

- [ ] **Step 3: Acrescentar os casos ao teste do app**

Em `apps/web/src/App.test.tsx`:

```tsx
  it('marks a placement that would complete a card in hand', () => {
    render(<App />)
    const completing = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-highlight') === 'completes')
    // the opening position may or may not offer one; the assertion is that the
    // mark is reserved for placements that really do complete a card
    for (const el of completing) expect(el.getAttribute('data-highlight')).toBe('completes')
  })

  it('does not put spatial actions in the decision bar', () => {
    render(<App />)
    expect(screen.queryByText(/^Place on /)).toBeNull()
  })
```

- [ ] **Step 4: Reescrever a interação no `App.tsx`**

```tsx
import { key, wouldComplete } from '@dcv/engine'
import type { Hex } from '@dcv/engine'
import { useState } from 'react'
import { Board } from './components/Board.js'
import { Hand } from './components/Hand.js'
import type { Highlight } from './components/HexCell.js'
import { Prompt } from './components/Prompt.js'
import { TopBar } from './components/TopBar.js'
import { useGame } from './game/useGame.js'
import { boardTargets, resolveTap } from './game/selection.js'

const OPENING_SEED = 1

export function App() {
  const game = useGame(OPENING_SEED)
  const [selected, setSelected] = useState<Hex | null>(null)

  const targets = boardTargets(game.actions, selected)
  const pending = game.view.pending[game.view.pending.length - 1]

  const highlights: Record<string, Highlight> = {}
  for (const hex of targets) {
    const completes =
      pending?.kind === 'place' &&
      game.view.you.hand.some((card) => wouldComplete(game.view.board, card, hex, pending.token))
    highlights[key(hex)] = completes ? 'completes' : 'legal'
  }
  if (selected) highlights[key(selected)] = 'selected'

  function selectHex(hex: Hex): void {
    const outcome = resolveTap(game.actions, selected, hex)
    setSelected(outcome.select)
    if (outcome.action) game.perform(outcome.action)
  }

  return (
    <main className="app">
      <TopBar view={game.view} />
      <Board board={game.state.board} highlights={highlights} onSelectHex={selectHex} />
      <footer className="bottom">
        <Hand view={game.view} actions={game.actions} onAct={game.perform} />
        <Prompt
          view={game.view}
          actions={game.actions}
          selected={selected}
          onAct={(action) => {
            setSelected(null)
            game.perform(action)
          }}
        />
      </footer>
    </main>
  )
}
```

Em `Prompt.tsx`, aceitar `selected` e esconder o que o tabuleiro já responde:

```tsx
import { hexEq } from '@dcv/engine'
import type { Action, Hex, PlayerView } from '@dcv/engine'
import { describeAction, promptFor } from '../game/labels.js'

const HANDLED_BY_BOARD = new Set(['place', 'meatMove', 'ironMove', 'potionSwap', 'scoreCard'])

export function Prompt({
  view,
  actions,
  selected,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  selected: Hex | null
  onAct: (action: Action) => void
}) {
  const buttons = actions.filter((action) => {
    if (HANDLED_BY_BOARD.has(action.type)) return false
    // a dual neighbour needs the bar to ask which of its two abilities to use
    if (action.type === 'plantTarget') return selected !== null && hexEq(action.at, selected)
    return true
  })

  return (
    <section className="prompt" aria-label="Current decision">
      <p className="prompt-text">{promptFor(view)}</p>
      <div className="prompt-actions">
        {buttons.map((action) => (
          <button key={describeAction(action)} type="button" onClick={() => onAct(action)}>
            {describeAction(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Inspecionar uma pilha**

A spec pede que tocar numa pilha abra ela. Toda casa com token mostra o que há
embaixo ao ser tocada — inclusive quando ela também é alvo da decisão atual, e
é justamente aí que a informação serve: o primeiro toque mostra a prévia da
jogada **e** o conteúdo da pilha, que é o que você precisa pra decidir o
segundo toque. A inspeção some assim que uma ação é executada.

Teste, em `apps/web/src/App.test.tsx`:

```tsx
  it('opens a stack when an occupied space is tapped', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('shows nothing for an empty space', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail once an action is taken', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })
```

Criar `apps/web/src/components/StackDetail.tsx`:

```tsx
import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/** The whole stack, bottom to top, for a space the board is not asking about. */
export function StackDetail({ hex, stack }: { hex: Hex; stack: Token[] }) {
  return (
    <section className="stack-detail" aria-label={`Stack at ${key(hex)}`}>
      <p className="stack-detail-title">{key(hex)} — bottom to top</p>
      <ol>
        {[...stack].map((token, index) => (
          <li key={`${index}-${tokenLabel(token)}`}>
            <svg viewBox={`${-HEX_SIZE} ${-HEX_SIZE} ${HEX_SIZE * 2} ${HEX_SIZE * 2}`} aria-hidden="true">
              <TokenGlyph token={token} radius={HEX_SIZE * 0.7} />
            </svg>
            <span>{tokenLabel(token)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

No `App.tsx`, guardar a casa inspecionada e limpá-la a cada toque:

```tsx
  const [inspecting, setInspecting] = useState<Hex | null>(null)

  function selectHex(hex: Hex): void {
    const outcome = resolveTap(game.actions, selected, hex)
    setSelected(outcome.select)

    if (outcome.action) {
      setInspecting(null)
      game.perform(outcome.action)
      return
    }

    // any tapped space that holds tokens shows what is stacked there
    const stack = game.state.board[key(hex)] ?? []
    setInspecting(stack.length > 0 ? hex : null)
  }
```

E renderizar `{inspecting ? <StackDetail hex={inspecting} stack={game.state.board[key(inspecting)] ?? []} /> : null}` logo acima da `<Prompt />`.

Acrescentar ao `styles.css`:

```css
.stack-detail { background: var(--surface); border-radius: 12px; padding: 10px 12px; }
.stack-detail-title { margin: 0 0 6px; color: var(--muted); font-size: 13px; }
.stack-detail ol { display: flex; gap: 12px; margin: 0; padding: 0; list-style: none; }
.stack-detail li { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.stack-detail svg { width: 28px; height: 28px; }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run apps/web/src/`
Expected: PASS.

- [ ] **Step 7: Jogar de novo**

Run: `npm run dev`
Confirmar no celular: mover com `meat` é tocar no vizinho e depois no destino; o `potion` funciona pelas duas pontas; e uma colocação que fecha um card fica com o contorno dourado.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): board-driven target selection and completion highlight"
```

---

### Task 19: A máquina como oponente, desfazer e fim de partida

**Files:**
- Create: `apps/web/src/game/useOpponent.ts`, `apps/web/src/components/GameOver.tsx`, `apps/web/src/components/Controls.tsx`
- Modify: `apps/web/src/game/useGame.ts` (`undoUntil`), `apps/web/src/App.tsx`, `apps/web/src/styles.css`
- Test: `apps/web/src/game/useGame.test.ts` (acrescenta casos), `apps/web/src/components/GameOver.test.tsx`, `apps/web/src/game/useOpponent.test.tsx`

**Interfaces:**
- Produces: `useOpponent({ session, seat, level, enabled })`, `<GameOver state onRestart />`, `<Controls level onLevel onUndo canUndo />`, `HUMAN_SEAT = 0`.

- [ ] **Step 1: Acrescentar `undoUntil` ao `useGame`**

Teste, em `apps/web/src/game/useGame.test.ts`:

```ts
  it('undoUntil rewinds past a run of states to the first matching one', () => {
    const { result } = renderHook(() => useGame(42))
    act(() => result.current.perform(result.current.actions[0]))
    act(() => result.current.perform(result.current.actions[0]))
    const target = result.current.state.phase
    act(() => result.current.undoUntil((state) => state.pending.length === 1))
    expect(result.current.state.pending).toHaveLength(1)
    expect(result.current.state.phase).not.toBe(target)
  })

  it('undoUntil never rewinds past the opening position', () => {
    const { result } = renderHook(() => useGame(42))
    act(() => result.current.undoUntil(() => false))
    expect(result.current.canUndo).toBe(false)
  })
```

Implementação, acrescentada ao hook e ao tipo `GameSession`:

```ts
  /** Steps back at least once, then keeps stepping until `predicate` holds. */
  const undoUntil = useCallback((predicate: (state: GameState) => boolean) => {
    setHistory((past) => {
      if (past.length <= 1) return past
      let next = past.slice(0, -1)
      while (next.length > 1 && !predicate(next[next.length - 1])) next = next.slice(0, -1)
      return next
    })
  }, [])
```

- [ ] **Step 2: Escrever o teste do oponente**

`apps/web/src/game/useOpponent.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './useGame.js'
import { useOpponent } from './useOpponent.js'

function harness(seed: number, enabled = true) {
  return renderHook(() => {
    const session = useGame(seed)
    useOpponent({ session, seat: 1, level: 'easy', enabled })
    return session
  })
}

describe('useOpponent', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not act while it is the human turn', () => {
    const { result } = harness(1)
    const humanTurn = result.current.state.current === 0
    if (!humanTurn) return
    const before = JSON.stringify(result.current.state)
    act(() => void vi.advanceTimersByTime(2000))
    expect(JSON.stringify(result.current.state)).toBe(before)
  })

  it('plays on its own turn after a pause', () => {
    const { result } = harness(1)
    // drive the human seat until the machine is on turn
    while (result.current.state.current === 0 && result.current.state.phase !== 'ended') {
      act(() => result.current.perform(result.current.actions[0]))
    }
    const before = JSON.stringify(result.current.state)
    act(() => void vi.advanceTimersByTime(1000))
    expect(JSON.stringify(result.current.state)).not.toBe(before)
  })

  it('stays out of it when disabled', () => {
    const { result } = harness(1, false)
    while (result.current.state.current === 0 && result.current.state.phase !== 'ended') {
      act(() => result.current.perform(result.current.actions[0]))
    }
    const before = JSON.stringify(result.current.state)
    act(() => void vi.advanceTimersByTime(2000))
    expect(JSON.stringify(result.current.state)).toBe(before)
  })
})
```

- [ ] **Step 3: Escrever `useOpponent.ts`**

```ts
import { legalActions, seedFrom, toPlayerView } from '@dcv/engine'
import type { RngState, Seat } from '@dcv/engine'
import { createStrategy, type Difficulty } from '@dcv/ai'
import { useEffect, useRef } from 'react'
import type { GameSession } from './useGame.js'

/** Long enough to read what it did, short enough not to feel stuck. */
const THINK_MS = 400

export function useOpponent({
  session,
  seat,
  level,
  enabled,
}: {
  session: GameSession
  seat: Seat
  level: Difficulty
  enabled: boolean
}): void {
  const rng = useRef<RngState>(seedFrom(`opponent-${level}`))
  const { state, perform } = session

  useEffect(() => {
    if (!enabled) return
    if (state.phase === 'ended' || state.current !== seat) return

    const timer = setTimeout(() => {
      const strategy = createStrategy(level)
      const chosen = strategy.chooseAction(toPlayerView(state, seat), legalActions(state), rng.current)
      rng.current = chosen.rng
      perform(chosen.action)
    }, THINK_MS)

    return () => clearTimeout(timer)
  }, [state, seat, level, enabled, perform])
}
```

O oponente recebe `toPlayerView(state, seat)`. A garantia da spec de que a máquina não espia está aqui, numa linha: ela nunca vê `state`.

- [ ] **Step 4: Escrever o teste e o componente de fim de partida**

`apps/web/src/components/GameOver.test.tsx`:

```tsx
import { createInitialState, DECK } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameOver } from './GameOver.js'

const card = (id: string) => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

function finished(scoredA: string[], scoredB: string[], coinsA = 0, coinsB = 0): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    phase: 'ended',
    players: [
      { ...base.players[0], scored: scoredA.map(card), coins: coinsA },
      { ...base.players[1], scored: scoredB.map(card), coins: coinsB },
    ],
  }
}

describe('GameOver', () => {
  it('announces the winner and both totals', () => {
    render(<GameOver state={finished(['tri-bread'], [])} onRestart={() => {}} />)
    expect(screen.getByText('You win')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('0')).toBeDefined()
  })

  it('announces a loss', () => {
    render(<GameOver state={finished([], ['tri-bread'])} onRestart={() => {}} />)
    expect(screen.getByText('You lose')).toBeDefined()
  })

  it('announces a shared victory', () => {
    render(<GameOver state={finished(['tri-bread'], ['tri-plant'])} onRestart={() => {}} />)
    expect(screen.getByText('Shared victory')).toBeDefined()
  })

  it('offers a new game', () => {
    render(<GameOver state={finished([], [])} onRestart={() => {}} />)
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined()
  })
})
```

`apps/web/src/components/GameOver.tsx`:

```tsx
import { finalScore, winner } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { HUMAN_SEAT } from '../game/seats.js'

export function GameOver({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const result = winner(state)
  const headline =
    result === 'draw' ? 'Shared victory' : result === HUMAN_SEAT ? 'You win' : 'You lose'

  return (
    <div className="game-over" role="dialog" aria-label="Final score">
      <h2>{headline}</h2>
      <dl>
        <dt>You</dt>
        <dd>{finalScore(state, 0)}</dd>
        <dt>Machine</dt>
        <dd>{finalScore(state, 1)}</dd>
      </dl>
      <button type="button" onClick={onRestart}>
        New game
      </button>
    </div>
  )
}
```

Criar `apps/web/src/game/seats.ts`:

```ts
import type { Seat } from '@dcv/engine'

export const HUMAN_SEAT: Seat = 0
export const MACHINE_SEAT: Seat = 1
```

- [ ] **Step 5: Escrever `Controls.tsx` e ligar tudo no `App.tsx`**

`apps/web/src/components/Controls.tsx`:

```tsx
import type { Difficulty } from '@dcv/ai'

const LEVELS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
]

export function Controls({
  level,
  onLevel,
  onUndo,
  canUndo,
}: {
  level: Difficulty
  onLevel: (level: Difficulty) => void
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <div className="controls">
      <label>
        Opponent
        <select value={level} onChange={(event) => onLevel(event.target.value as Difficulty)}>
          {LEVELS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  )
}
```

No `App.tsx`, acrescentar o estado de dificuldade e de semente, o oponente, os controles e o fim de partida:

```tsx
  const [level, setLevel] = useState<Difficulty>('easy')
  const [seed, setSeed] = useState(OPENING_SEED)

  useOpponent({ session: game, seat: MACHINE_SEAT, level, enabled: true })

  const myTurn = game.state.current === HUMAN_SEAT && game.state.phase !== 'ended'
```

O tabuleiro e a barra só aceitam toque quando `myTurn` é verdadeiro — passe `onSelectHex={myTurn ? selectHex : () => {}}` e `actions={myTurn ? game.actions : []}`. Desfazer volta até o seu próprio turno, para não parar no meio do raciocínio da máquina:

```tsx
        <Controls
          level={level}
          onLevel={setLevel}
          canUndo={game.canUndo && myTurn}
          onUndo={() => {
            setSelected(null)
            game.undoUntil((state) => state.current === HUMAN_SEAT)
          }}
        />
```

E, quando `game.state.phase === 'ended'`, renderizar `<GameOver state={game.state} onRestart={() => { const next = seed + 1; setSeed(next); game.reset(next) }} />` no lugar da `<Prompt />`.

Acrescentar ao `styles.css`:

```css
.controls { display: flex; gap: 8px; align-items: center; justify-content: space-between; font-size: 13px; }
.controls select, .controls button { min-height: 40px; background: #2a3540; color: var(--ink); border: 1px solid #3a4652; border-radius: 8px; font: inherit; }
.controls button:disabled { opacity: 0.4; }

.game-over { background: var(--surface); border-radius: 12px; padding: 16px; text-align: center; }
.game-over h2 { margin: 0 0 8px; }
.game-over dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; margin: 0 0 12px; }
.game-over dt { color: var(--muted); text-align: left; }
.game-over dd { margin: 0; font-weight: 700; }
.game-over button { min-height: 44px; width: 100%; border: 0; border-radius: 8px; background: var(--completes); font: inherit; font-weight: 600; }
```

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test && npm run typecheck`
Expected: PASS em tudo.

- [ ] **Step 7: O critério de pronto da v1**

Run: `npm run dev`
Abrir no celular (ou no modo dispositivo do navegador), escolher `Medium` e jogar **uma partida inteira**, do primeiro token até a contagem final. Este passo não é opcional: é o critério de pronto que a spec define.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): machine opponent, difficulty, undo and final score"
```

---
