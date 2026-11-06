# Dragoncraft Versus v2 — Plano de Implementação do Online

**Goal:** Dois amigos jogam uma partida pela internet a partir de um link, sem cadastro, com o servidor como autoridade das regras. O jogo contra a máquina continua exatamente como está.

**Architecture:** O motor (`packages/engine`) não muda de papel: roda inalterado dentro de um processo Node que guarda o `GameState` verdadeiro de cada sala, valida cada ação recebida contra `legalActions`, aplica com `applyAction` e devolve a cada cadeira a sua `PlayerView`. O cliente web nunca recebe o estado completo nem a seed. Na interface, a única mudança estrutural é uma porta: um `Table` que entrega `view`, `actions` e `perform`, com duas implementações — `useLocalTable` (motor no navegador, máquina como oponente, desfazer) e `useRemoteTable` (WebSocket). Os componentes consomem a porta e não sabem qual implementação está por trás.

**Tech Stack:** O que já existe (TypeScript 5 strict, npm workspaces, Vite 5, React 18, Vitest 2) mais, só no servidor, `ws` como dependência de runtime e `esbuild` para empacotar os pacotes do workspace num único arquivo que o Node executa. Hospedagem: o site continua no GitHub Pages; o servidor vai para um host de WebSocket separado (Fly.io), com a URL injetada no build por `VITE_SERVER_URL`.

**Spec:** `docs/specs/2026-09-25-dragoncraft-versus-design.md`, seção 11, com uma alteração: dois deploys em vez de um processo único servindo site e socket. A decisão é não perder o deploy no Pages que já funciona.

## Decisões tomadas antes de começar

- **Servidor autoritativo, não peer-to-peer.** O jogo tem informação oculta (mão, ordem do deck, sorteio do saco). Em P2P um dos navegadores teria o estado inteiro e poderia trapacear; e WebRTC em rede móvel é instável. O servidor é pequeno porque a regra já existe: ele é um `Map` de salas em volta de `applyAction`.
- **Quem começa é a seed.** `createGame(seed)` já sorteia o primeiro jogador (`determineFirstPlayer`). O criador da sala senta na cadeira 0 e o convidado na 1, e o motor decide quem abre. Nada novo a construir.
- **Visão inteira a cada atualização, não diff.** Uma `PlayerView` tem poucos KB. Mandar sempre a visão inteira faz reconexão e jogo normal usarem o mesmo caminho de código, e o cliente nunca acumula estado que possa divergir do servidor.
- **Sem espectadores nesta etapa.** O protocolo nasce com `role: 'player'` na resposta de `join` para que `'spectator'` caiba depois sem quebrar cliente; o servidor recusa o terceiro com `room-full`.
- **Sem persistência.** Sala vive na memória. Servidor reinicia, partida acaba. Explicitamente aceito na spec.
- **Sem desfazer online.** O `Table` remoto expõe `canUndo: false` e a interface já esconde o botão quando não pode.
- **Escolha de oponente num único lugar.** O modal "Choose your opponent" ganha uma quarta opção, "A friend online", ao lado de Easy/Medium/Hard. Nenhum fluxo novo antes dele, e os testes de interface que clicam em "Easy" continuam válidos.

## Global Constraints

Todas as da v1 continuam valendo. Novas:

- **O servidor nunca envia `GameState`, `seed` ou `rng`.** Tudo que sai passa por `toPlayerView`. Teste no servidor serializa cada mensagem e afirma que a mão do oponente e o deck não aparecem.
- **O servidor não confia no cliente.** Toda ação recebida é comparada por `actionKey` com `legalActions(state)`. Ação fora da lista, ou de quem não é o jogador da vez, é recusada com `error` e o estado não muda. Payload malformado não derruba o processo.
- **`packages/protocol` tem zero dependências de runtime**, como o motor. Só tipos e funções puras de validação de mensagem.
- **O servidor isola transporte de regra.** `room.ts` não importa `ws`; recebe mensagens e devolve mensagens endereçadas. Os testes do servidor rodam sem abrir porta.
- **`apps/web` continua funcionando sem servidor.** `VITE_SERVER_URL` ausente esconde a opção online e nada mais muda. O jogo contra a máquina não toca em nenhum código de rede.
- **Identidade por token, não por link.** Cada cadeira recebe um token aleatório gerado pelo servidor (`crypto.randomUUID`), guardado no `localStorage` do cliente. Reconectar exige o token. O link só diz qual sala.
- **Aleatório no servidor é permitido** (seed da sala, ids, tokens) — ele está fora do motor. Dentro do motor as regras da v1 seguem absolutas.
- **Todo o código em inglês.** Este plano segue em português.

## Review Focus

Entradas que a arquitetura implica e que só acontecem com rede de verdade. Cada uma tem teste na tarefa dona do código.

1. **Ação do jogador que não é o da vez** — recusada, estado intacto, o outro não recebe nada. *Task 3.*
2. **Ação legal em forma mas ilegal no estado** (`place` numa pilha cheia) — recusada por `actionKey` não casar com `legalActions`; `applyAction` nunca é chamado com ela. *Task 3.*
3. **Terceiro cliente com o link** — `room-full`, e os dois jogadores não percebem nada. *Task 3.*
4. **Reconexão com token certo substitui o socket antigo** — a cadeira volta a ser do novo socket; o antigo, se ainda aberto, é fechado. Token errado ou de outra sala é recusado. *Task 3.*
5. **Sala sem ninguém conectado por 30 minutos** — removida da memória; tentar entrar depois dá `room-not-found`. Relógio injetado para o teste não esperar. *Task 3.*
6. **Socket cai no meio do turno do oponente** — o cliente volta sozinho, manda `join` com o token e recebe a visão atual; a interface mostra "Reconnecting…" enquanto isso e nunca oferece ações com socket fechado. *Task 6.*
7. **`VITE_SERVER_URL` ausente** — a opção online não aparece e a suíte da interface passa igual. *Task 5.*

## Estrutura de arquivos

```
packages/protocol/
  package.json                    @dcv/protocol, depende só de @dcv/engine (tipos)
  tsconfig.json
  src/messages.ts                 ClientMessage, ServerMessage, códigos de erro
  src/parse.ts                    parseClientMessage(text): ClientMessage | null
  src/parse.test.ts
  src/index.ts

apps/server/
  package.json                    @dcv/server; ws em runtime, esbuild e @types/ws em dev
  tsconfig.json
  Dockerfile
  fly.toml
  src/ids.ts                      roomId curto e legível, token por cadeira
  src/room.ts                     Room: cadeiras, estado, handle(message) → mensagens
  src/room.test.ts                partida inteira por dois clientes falsos + os 5 casos do Review Focus
  src/rooms.ts                    Rooms: Map de salas, criação, busca, expiração com relógio injetado
  src/rooms.test.ts
  src/server.ts                   ws: origem, sockets ↔ salas, ping/pong, porta
  src/main.ts                     lê env, sobe

apps/web/
  src/game/table.ts               tipo Table (a porta) e TableStatus
  src/game/useLocalTable.ts       useGame + useOpponent atrás da porta
  src/game/useLocalTable.test.tsx
  src/game/useRemoteTable.ts      WebSocket, reconexão, token no localStorage
  src/game/useRemoteTable.test.tsx  socket falso injetado
  src/game/roomStorage.ts         token/cadeira por sala no localStorage
  src/game/route.ts               hash → { kind: 'home' } | { kind: 'room', id } | debug
  src/game/route.test.ts
  src/game/serverUrl.ts           VITE_SERVER_URL → ws(s)://, ou null
  src/components/OpponentSetup.tsx   antigo DifficultySetup + "A friend online"
  src/components/RoomLobby.tsx    link para compartilhar, copiar, "waiting for opponent"
  src/components/Connection.tsx   faixa "Reconnecting…" / "Opponent disconnected"
  src/App.tsx                     escolhe o Table pela rota e pela escolha de oponente

.github/workflows/deploy.yml      VITE_SERVER_URL vindo de vars.SERVER_URL
.github/workflows/deploy-server.yml  flyctl deploy quando apps/server, packages/* mudam
```

## Protocolo

Mensagens JSON em texto. Tipos vivem em `packages/protocol`, importados por servidor e cliente.

```ts
// cliente → servidor
type ClientMessage =
  | { type: 'create' }                                   // nova sala; o criador senta na cadeira 0
  | { type: 'join'; room: string; token?: string }        // sem token: pede a cadeira 1; com token: reconecta
  | { type: 'action'; action: Action }

// servidor → cliente
type ServerMessage =
  | { type: 'seated'; room: string; seat: Seat; token: string; role: 'player' }
  | { type: 'waiting' }                                   // sentado, sem oponente ainda
  | { type: 'view'; view: PlayerView; actions: Action[]; opponentConnected: boolean }
  | { type: 'presence'; opponentConnected: boolean }
  | { type: 'error'; code: ErrorCode; message: string }

type ErrorCode =
  | 'bad-message' | 'room-not-found' | 'room-full' | 'bad-token'
  | 'not-seated' | 'not-your-turn' | 'illegal-action' | 'not-started'
  | 'replaced' | 'busy'
```

`actions` são as jogadas legais **para aquela cadeira, agora** — vazia fora da
sua vez. O cliente não recalcula nada: `legalActions` precisa do `GameState`,
que ele não tem, e a lista é pequena. É também o que impede a interface de
oferecer algo que o servidor recusaria.

Sequência normal: A manda `create` → recebe `seated` + `waiting`. B abre o link, manda `join` sem token → recebe `seated`; o servidor cria o jogo e manda `view` aos dois. Cada `action` aceita gera `view` para os dois. Queda e volta: `join` com token → `seated` + `view` atual; o oponente recebe `presence`.

O estado da sala tem três fases: `waiting` (uma cadeira), `playing` (duas cadeiras, `GameState` existe), e o fim é `view.phase === 'ended'`, que o cliente já sabe ler.

## Fase A — Protocolo e servidor

### Task 1: Pacote de protocolo

**Files:**
- Create: `packages/protocol/package.json`, `tsconfig.json`, `src/messages.ts`, `src/parse.ts`, `src/index.ts`
- Test: `packages/protocol/src/parse.test.ts`
- Modify: `package.json` raiz (`typecheck` inclui o pacote)

**Interfaces:**
- Consumes: `Action`, `PlayerView`, `Seat` do motor.
- Produces: `ClientMessage`, `ServerMessage`, `ErrorCode`, `parseClientMessage(text: string): ClientMessage | null`.

- [ ] **Step 1:** `messages.ts` com os tipos acima.
- [ ] **Step 2:** `parseClientMessage` faz `JSON.parse` em `try`, confere que é objeto com `type` string conhecido e os campos obrigatórios com o tipo certo (`room` string, `token` string opcional, `action` objeto com `type` string). Não valida a ação por dentro: isso é trabalho de `legalActions`.
- [ ] **Step 3:** Testes: cada tipo válido passa; texto que não é JSON, JSON sem `type`, `type` desconhecido, `join` sem `room` e `action` sem objeto devolvem `null`.
- [ ] **Step 4:** Adicionar `tsc -p packages/protocol/tsconfig.json` ao `typecheck`. `npm install` para o workspace enxergar o pacote.
- [ ] **Commit:** `feat(protocol): the messages a client and the server exchange`

### Task 2: Pontuação legível pela visão

A tela final online só tem a `PlayerView`. Hoje `finalScore(state, seat)` exige `GameState`.

**Files:**
- Modify: `packages/engine/src/scoring.ts`, `scoring.test.ts`
- Modify: `apps/web/src/components/GameOver.tsx` (só assinatura; o uso pela interface muda na Task 5)

- [ ] **Step 1:** `finalScore(player: { scored: readonly ShopCard[]; coins: number }): number`, no mesmo espírito de `bankedReputation`. `winner(state)` continua, chamando `finalScore(state.players[seat])`. Adicionar `winnerOfView(view: PlayerView): Seat | 'draw'` com a mesma regra de desempate sobre `view.you` e `view.opponent`, e um teste que confirma que ela concorda com `winner(state)` para o mesmo estado nas duas cadeiras.
- [ ] **Step 2:** Ajustar chamadas existentes.
- [ ] **Commit:** `refactor(engine): final score from what a view can see`

### Task 3: Sala — a regra do servidor sem rede

**Files:**
- Create: `apps/server/package.json`, `tsconfig.json`, `src/ids.ts`, `src/room.ts`, `src/rooms.ts`
- Test: `apps/server/src/room.test.ts`, `apps/server/src/rooms.test.ts`
- Modify: `vitest.config.ts` (jsdom só para `apps/web/**`), `package.json` raiz (`typecheck`)

**Interfaces:**
- `Room` recebe `(clientId, ClientMessage)` e devolve `Outbound[]`, onde `Outbound = { to: clientId; message: ServerMessage }`. Também expõe `disconnect(clientId): Outbound[]` (gera `presence` para o outro) e `connectedCount()`.
- `Rooms` cria (`create(): Room` com id e seed novos), busca por id, e `sweep(now)` remove salas com `connectedCount() === 0` por mais de `IDLE_MS` (30 min) e salas em `waiting` mais velhas que `WAITING_MS` (2 h). O relógio é parâmetro para teste.

- [ ] **Step 1:** `ids.ts` — `roomId()` com 6 caracteres de um alfabeto sem ambiguidade (sem 0/O, 1/l/I), `seatToken()` com `crypto.randomUUID()`.
- [ ] **Step 2:** `room.ts`:
  - `seats: [SeatRecord | null, SeatRecord | null]`, `SeatRecord = { token: string; client: string | null }`.
  - `create` por quem ainda não está sentado: cadeira 0, devolve `seated` e `waiting`.
  - `join` sem token: se a cadeira 1 está livre, senta, cria `state = createGame(seed)`, devolve `seated` para ele e `view` para os dois. Se não, `room-full`.
  - `join` com token: acha a cadeira pelo token (`bad-token` se não achar). Se a cadeira ainda tem um cliente ligado, ele recebe `error replaced` e o servidor fecha o socket dele. O novo cliente recebe `seated` e `view` (ou `waiting`); o oponente recebe `presence`.
  - `action`: cliente não sentado → `not-seated`; sala em `waiting` → `not-started`; `state.current !== seat` → `not-your-turn`; `actionKey` não está em `legalActions(state).map(actionKey)` → `illegal-action`. Senão `applyAction` e `view` aos dois. `actionKey` pode lançar sobre objeto estranho: capturar e tratar como `illegal-action`.
  - `disconnect(client)`: limpa `client` na cadeira, devolve `presence` para o outro.
- [ ] **Step 3:** `room.test.ts`:
  - Dois clientes jogam uma partida inteira escolhendo ao acaso **só entre as `actions` que receberam na última `view`**, sem olhar o estado do servidor. Se alguma for recusada, o teste falha: é a prova de que o que o servidor manda basta para jogar.
  - Em cada `view` serializada: `JSON.stringify` não contém a mão do oponente (checar que as `id`s das cartas da mão de A não aparecem na visão de B) nem as chaves `rng`, `deck`, `extras`.
  - Os cinco casos do Review Focus (1–5).
- [ ] **Step 4:** `rooms.ts` + teste de expiração com relógio falso; `create` quando há `MAX_ROOMS` (500) salas devolve `null` (o servidor responde `error` com código `'busy'`).
- [ ] **Step 5:** `vitest.config.ts`: `environmentMatchGlobs: [['apps/web/**', 'jsdom']]`.
- [ ] **Commit:** `feat(server): a room that holds the real game and deals each seat its view`

### Task 4: Transporte WebSocket, build e deploy do servidor

**Files:**
- Create: `apps/server/src/server.ts`, `src/main.ts`, `Dockerfile`, `fly.toml`, `.dockerignore`
- Create: `.github/workflows/deploy-server.yml`
- Modify: `apps/server/package.json` (scripts `dev`, `build`, `start`)

- [ ] **Step 1:** `server.ts` exporta `startServer({ port, allowedOrigins, rooms })`. `WebSocketServer` com `verifyClient` conferindo `Origin` contra a lista (vazia em dev aceita tudo). Cada socket ganha um `clientId`; mensagens passam por `parseClientMessage`, `null` → `error bad-message`. `create` pede uma sala ao `Rooms`; `join` busca por id → `room-not-found`. O socket fica associado à sala após `seated`. `close` → `room.disconnect`. Ping a cada 30 s, fecha quem não respondeu ao anterior. `setInterval` de 60 s para `rooms.sweep(Date.now())`. Rota HTTP `GET /health` → `200 ok` para o host.
- [ ] **Step 2:** `main.ts` lê `PORT` (default 8080) e `ALLOWED_ORIGINS` (separado por vírgula).
- [ ] **Step 3:** Scripts: `build` = `esbuild src/main.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/main.js`; `start` = `node dist/main.js`; `dev` = build em `--watch` + `node --watch dist/main.js`. O bundle resolve os imports `.js` → `.ts` do workspace, que o Node sozinho não resolve.
- [ ] **Step 4:** `Dockerfile` multi-stage: copia o monorepo, `npm ci`, `npm run build -w @dcv/server`, imagem final só com `dist/` e `node_modules/ws`. `fly.toml` com `internal_port = 8080`, `auto_stop_machines = "off"` (uma sala em memória não pode ser desligada por ociosidade da máquina — ou aceitar `"stop"` e documentar que partidas morrem; decisão: `off`, uma máquina pequena).
- [ ] **Step 5:** `deploy-server.yml`: em push para `main` com mudanças em `apps/server/**`, `packages/**`, roda a suíte e `flyctl deploy --remote-only`, com `FLY_API_TOKEN` em secret. Sem o secret, o job pula.
- [ ] **Step 6:** Teste de fumaça manual: `npm run dev -w @dcv/server`, `wscat`/script Node mandando `create` e lendo `seated`.
- [ ] **Commit:** `feat(server): WebSocket transport, container and Fly deploy`

## Fase B — A interface

### Task 5: A porta `Table` e o jogo local atrás dela

Refatoração sem mudança de comportamento. A suíte atual tem de passar igual.

**Files:**
- Create: `apps/web/src/game/table.ts`, `useLocalTable.ts`
- Test: `apps/web/src/game/useLocalTable.test.tsx`
- Modify: `App.tsx`, `components/GameOver.tsx`, `components/Board.tsx` (se receber `state`), `components/DifficultySetup.tsx` → `OpponentSetup.tsx`
- Modify: `useGame.ts` (renomear o tipo atual `GameSession` → `LocalGame`, para `Table` ser o nome da porta)

**Interfaces:**
```ts
type TableStatus =
  | { kind: 'playing' }                 // inclui 'ended' via view.phase
  | { kind: 'waiting' }                 // online: sem oponente ainda
  | { kind: 'connecting' }              // online: socket caindo/voltando
  | { kind: 'closed'; reason: string }  // online: sala sumiu, token recusado, substituído

type Table = {
  view: PlayerView | null   // null enquanto waiting/connecting sem visão
  actions: Action[]         // legais para mim agora; [] fora da minha vez
  perform: (action: Action) => void
  undo: () => void
  canUndo: boolean
  status: TableStatus
  opponentConnected: boolean
  opponentLabel: string     // 'Machine' | 'Opponent'
}
```

- [ ] **Step 1:** `useLocalTable({ seed, level, enabled })` compõe `useGame` + `useOpponent` e devolve `Table` com `view = toPlayerView(state, HUMAN_SEAT)`, `actions` vazias fora da vez, `status: 'playing'`, `opponentConnected: true`. Mantém `reset`/`load` numa extensão `LocalTable` usada só pelos botões de debug e restart.
- [ ] **Step 2:** `App.tsx` passa a ler tudo de `table.view` (`view.board`, `view.phase`, `view.current`, `view.seat`). `GameOver` recebe `view` e `opponentLabel`, usa `winnerOfView` e `finalScore(view.you)` / `finalScore(view.opponent)`. Nenhum componente importa `GameState` ou `HUMAN_SEAT` depois disto; `seats.ts` fica usado só por `useLocalTable` e `debug.ts`.
- [ ] **Step 3:** `OpponentSetup`: os três níveis mais um botão "A friend online" (blurb: "Share a link; the first to open it sits across from you"), renderizado só se `serverUrl() !== null`. `onChoose(choice: Difficulty | 'online')`.
- [ ] **Step 4:** `npm test` igual ao de antes, mais um teste de `useLocalTable` afirmando que `actions` é vazio durante a vez da máquina e que a máquina joga.
- [ ] **Commit:** `refactor(web): the game behind a Table, so a remote one can take its place`

### Task 6: `useRemoteTable` — socket, reconexão e token

**Files:**
- Create: `apps/web/src/game/serverUrl.ts`, `roomStorage.ts`, `useRemoteTable.ts`
- Test: `apps/web/src/game/useRemoteTable.test.tsx`

**Interfaces:**
- `useRemoteTable({ url, room, connect })` onde `connect: (url) => SocketLike` é injetável; `SocketLike` é o subconjunto de `WebSocket` usado (`send`, `close`, `onopen`, `onmessage`, `onclose`). `room: string | null` — `null` significa "crie uma"; depois de `seated` o hook devolve `roomId` para a interface atualizar o hash e o link.

- [ ] **Step 1:** `serverUrl()` lê `import.meta.env.VITE_SERVER_URL`; `http(s)` → `ws(s)`; ausente → `null`.
- [ ] **Step 2:** `roomStorage`: `remember(roomId, { token, seat })`, `recall(roomId)`, chave `dcv:room:<id>`.
- [ ] **Step 3:** O hook: ao abrir o socket manda `create` ou `join` (com token se houver em storage). `seated` → guarda token, `status` continua `connecting` até `waiting` ou `view`. `view` → `status playing`, `actions` vindas da mensagem. `perform` manda `action` e esvazia `actions` até a próxima `view` (evita duplo toque enviar duas vezes). `error` com `not-your-turn`/`illegal-action` apenas mantém a última visão (o servidor remanda `view` junto para ressincronizar). `close` do socket → `status connecting`, reconexão com backoff 1 s, 2 s, 4 s… até 30 s, sempre com o token. `error` `room-not-found`/`bad-token`/`room-full`/`replaced` → `status closed` com motivo, sem reconectar.
- [ ] **Step 4:** Testes com socket falso: cria sala e expõe o id; `view` preenche `actions`; `perform` envia e zera `actions`; queda → `connecting` e novo `join` com o token guardado; `room-full` → `closed`.
- [ ] **Commit:** `feat(web): a Table that lives on the server`

### Task 7: Rota, lobby, presença e o fio todo

**Files:**
- Create: `apps/web/src/game/route.ts` + teste, `components/RoomLobby.tsx`, `components/Connection.tsx`
- Modify: `App.tsx`, `styles.css`, `components/GameOver.tsx` (botão "Back to menu" quando online)

- [ ] **Step 1:** `route.ts`: `parseRoute(hash)` → `{ kind: 'home', debug }` | `{ kind: 'room', id, debug }`. `#/room/ABC123`. `App` escuta `hashchange`.
- [ ] **Step 2:** `App`: estado `mode: 'choosing' | 'local' | 'online'`. Rota `room` entra direto em `online`. Escolher "A friend online" entra em `online` com `room: null`; quando o hook devolve `roomId`, `location.hash = #/room/<id>`.
- [ ] **Step 3:** `RoomLobby` (status `waiting`): o link completo, botão "Copy link" (`navigator.clipboard`, com fallback mostrando o link selecionável), "Waiting for your friend…". `Connection` (faixa no topo): "Reconnecting…" em `connecting`, "Your friend disconnected" quando `!opponentConnected` em `playing`. `closed` → modal com o motivo e "Back to menu".
- [ ] **Step 4:** Online: `Controls` não mostra seed (o cliente não a tem) e sim o código da sala; o desfazer some (`canUndo: false` já basta). `GameOver` online: "Back to menu" em vez de "New game".
- [ ] **Step 5:** Teste de `App` com socket falso injetado por prop: abrir `#/room/X` manda `join`, receber `view` desenha o tabuleiro com as ações daquela cadeira; o teste de partida inteira pela DOM contra a máquina continua passando sem alteração.
- [ ] **Step 6:** `deploy.yml`: `env: VITE_SERVER_URL: ${{ vars.SERVER_URL }}` no passo de build. Sem a variável, o site publica sem a opção online — mesmo comportamento de hoje.
- [ ] **Commit:** `feat(web): play a friend from a link`

### Task 8: Partida de ponta a ponta e documentação

- [ ] **Step 1:** Teste em `apps/server`: sobe `startServer` numa porta efêmera e dois `WebSocket` reais (do próprio Node) jogam uma partida inteira — o único teste que atravessa o transporte.
- [ ] **Step 2:** Jogar uma partida real: servidor em Fly, site no Pages, dois celulares em redes diferentes, com uma tela apagando no meio para exercitar a reconexão.
- [ ] **Step 3:** README: seção "Online" (como rodar o servidor local, variáveis, deploy) e atualizar "Scope".
- [ ] **Commit:** `docs: how the online game is wired`

## Critério de pronto da v2

A suíte passa, o jogo contra a máquina está idêntico ao de antes, e uma partida inteira é jogada entre dois celulares em redes diferentes, a partir de um link, com pelo menos uma reconexão no meio e sem que nenhum dos dois veja a mão do outro.
