# Tutorial — design e roteiro

Data: 2026-11-21 · Status: rascunho para aprovação

## Por quê

Amigos que testaram o jogo não entenderam nada de cara: o jogo não diz
absolutamente nada. Tu começa com uma peça na mão, seis no tabuleiro e um
sonho. O botão `?` (HelpDialog) existe, mas é corrido demais pra ser
entendido. O tutorial ensina uma coisa por vez, com o jogador fazendo cada
coisa com a própria mão.

**Sucesso:** alguém que nunca jogou termina o tutorial e joga uma partida no
Easy sabendo o que cada token faz, como se marca uma carta e quando o jogo
acaba — sem abrir o `?`.

## Objetivos, não-objetivos, anti-objetivos

**Objetivos**

- Botão "Tutorial" na tela inicial (ModeSetup, passo `mode`).
- Um professor dragão de jaleco, **Professor Maple** (trocadilho com o
  Professor Oak, e combina com o jardim botânico), falando numa faixa no
  mesmo verde floresta com borda dourada do banner "Your Turn".
- Overlay bem escuro com spotlight, mostrando uma coisa por vez.
- Cobrir: objetivo e vitória, HUD (botões, settings e o give up, plaquinhas,
  saco, baralho, cartas), End turn e Undo, os seis tokens um por um, tokens
  duplos, pilha de 3, marcar carta colocando um token, marcar carta
  movendo um token, moedas, fim de jogo pelo saco e pelo baralho.
- No fim, o Maple convida pra uma partida de aquecimento — essa sim uma
  partida real, no Easy.

**Não-objetivos**

- i18n. Tudo em inglês até o i18n existir; as falas abaixo já estão em
  inglês.
- Substituir o `?`. Ele continua como referência rápida.
- Ensinar estratégia (quando gastar moeda, como jogar contra o Hard).

**Anti-objetivos** (se acontecer, falhou mesmo funcionando)

- Qualquer aleatoriedade dentro do tutorial. **Tudo é controlado**: a peça
  que sai do saco, a carta na mão, onde o professor joga.
- Regras do tutorial que divergem das do jogo. O Maple nunca pode "mentir"
  porque uma regra mudou no motor e a cena não.
- Paredes de texto. Cada fala cabe na faixa em no máximo ~2 linhas no
  celular; se não cabe, vira duas falas.
- Prender o jogador: o Skip está sempre visível.

## Abordagens consideradas

| | Abordagem | Troca | |
|---|---|---|---|
| **A** | **Cada cena descreve o próprio `GameState`** (tabuleiro, saco, baralho, mãos, decisão pendente). O tutorial filtra `legalActions` pra só o alvo da fala ser tocável. Ações do professor são ações roteirizadas passadas pro `applyAction`. | Precisa de um construtor de cenário e um modo tutorial na GameScreen. Ganha regras e animações reais, de graça. | **Escolhida** |
| B | Procurar seeds que comecem com cada peça | Tabuleiro sempre com 6 peças (a cena "um token sozinho" não existe), ainda precisa filtrar jogadas, e qualquer mudança no rng quebra as seeds. | Descartada |
| C | Cenas "de mentira", só animação desenhada à mão | Controle total, mas o resultado de cada habilidade teria que ser escrito à mão — isso é duplicar as regras. Se a Carne mudar no motor, a animação continua mostrando a regra antiga. | Descartada |

### "Blocos ou animação?" — não precisa escolher

Com A, o tutorial **é** uma sequência de passos, uma tela depois da outra —
exatamente como tu imaginou. A diferença é quem calcula o resultado de cada
passo: o motor, não a gente. A camada de apresentação que já existe
(draw → place → fire-up → move → score) anima a mudança como numa partida.

- **Bloco (lição):** um estado inicial montado à mão + uma lista de passos.
  Cada lição começa do zero com o próprio tabuleiro. Isso permite a cena
  "um token sozinho" e deixa cada lição independente (mexer numa não
  quebra a próxima).
- **Passo:** um de três tipos:
  - `say` — o Maple fala; toque pra continuar. Pode ter spotlight num
    elemento.
  - `do` — o Maple pede uma ação; só a ação esperada fica disponível
    (spotlight no alvo, o resto não responde).
  - `play` — o Maple faz uma ação roteirizada no turno dele (ex.: põe a
    Poção em `0,1`). Passa pelo `applyAction` e é animado como o oponente.
- Turnos do professor dentro de um bloco são só passos `play`: a peça dele
  vem de um saco montado pra cena e ele joga sempre no mesmo lugar. A
  próxima peça do jogador também vem do saco montado.

## Layout

### Dois atos

- **Ato 1 — A aula.** O Maple aparece grande no centro da tela, com o
  overlay escuro atrás. Ele explica objetivo e vitória, e apresenta a HUD
  com spotlight em cada elemento enquanto fala do centro.
- **Ato 2 — As lições.** O Maple "vai sentar" na plaquinha do oponente:
  encolhe e voa até o avatar do oponente; a plaquinha passa a dizer
  *Professor Maple*. Ele fica lá até o fim, como se tu estivesse jogando
  contra ele. A faixa sai de baixo da plaquinha dele, por cima do topo do
  tabuleiro. As cenas montam os tokens no centro e na metade de baixo do
  tabuleiro, pra faixa nunca cobrir a jogada.

```
 Ato 1                          Ato 2
┌──────────────────────┐      ┌──────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│      │[🐉🥼 Prof. Maple] 📜?⚙│
│▓▓▓▓▓▓▓  🐉🥼  ▓▓▓▓▓▓▓│      │╔══════════════════╗ │
│▓▓▓▓▓▓▓ (grande)▓▓▓▓▓▓│      │║ "Now fire it up."║ │
│ ╔══════════════════╗ │      │╚══════ Skip ▸ ═══╝ │
│ ║"Welcome to the   ║ │      │▓▓▓▓▓  ⬡ ⬡  ▓▓▓▓▓▓▓ │
│ ║ greenhouse!"     ║ │      │▓▓▓▓  ⬡(🌱)⬡ ▓▓▓▓▓▓ │
│ ╚═══════ Skip ▸ ══╝ │      │▓▓▓▓▓  ⬡ ⬡  ▓▓▓▓▓▓▓ │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│▓▓▓▓[ você · End ]▓▓▓▓│      │ [você · ↶ · End turn]│
└──────────────────────┘      └──────────────────────┘
```

### A faixa

- Verde floresta com borda dourada, igual ao `.turn-banner` do lado "you".
- Texto da fala + um `▸` quando é toque-pra-continuar. Em passos `do` não
  tem `▸`: a fala só avança quando a ação é feita.
- **Skip** mora dentro da faixa, como um link discreto "Skip tutorial" no
  canto de baixo. Anda junto com quem fala, nunca cobre a HUD, nunca fica
  sob o spotlight. (Alternativa descartada: no lugar do `?` no topo — aí o
  `?` some justo quando o Maple quer explicar ele.)
- Tocar Skip pede confirmação leve na própria faixa ("Leave the lesson?
  Yes / Keep going") — sem dialog do navegador.

### O spotlight

- Overlay quase preto (~85%) com um recorte em volta do alvo (botão, casa,
  carta, plaquinha). O Maple e a faixa ficam sempre acesos.
- Em `say`, tocar em qualquer lugar avança. Em `do`, só o recorte responde.
- O recorte acompanha o alvo se o layout mudar (rotação, teclado).

## Roteiro

Notação: **[say]** fala com toque pra continuar · **[do]** o jogador faz ·
**[play]** o Maple faz · 🔦 = spotlight em. Casas em coordenada axial
(`0,0` é o centro); as casas exatas são sugestão, o que importa é o
"porquê" de cada cena.

---

### Ato 1 — A aula (Maple no centro)

**Cena 1.1 — Boas-vindas.** Tabuleiro na posição inicial (6 tokens no anel
interno), tudo escuro.

1. [say] "Ah, a new apprentice! I'm Professor Maple, and this is my
   greenhouse."
2. [say] "Dragons are picky eaters. Our job is to serve each one its
   favourite dishes — in just the right arrangement."
3. [say] "Let's get to the root of it. It'll only take a few minutes."

**Cena 1.2 — Como se ganha.**

1. [say] 🔦 a sua mão (as duas cartas) — "These are your shop cards. Each
   one shows three tokens in a shape."
2. [say] 🔦 uma carta — "Make that shape on the board — any rotation will
   do — and the card is yours. That's reputation."
3. [say] 🔦 a estrela na sua plaquinha — "Reputation lives here. Most
   reputation at the end wins."
4. [say] "That's the whole game: draw a token, place it, make the shapes
   on your cards."

**Cena 1.3 — O tabuleiro.**

1. [say] 🔦 o tabuleiro inteiro — "Nineteen spaces. Every turn you draw one
   token and put it anywhere there's room."
2. [say] 🔦 um token do anel — "Tokens can stack up to three high. Only
   the top one counts." (A pilha é ensinada de verdade na lição 2.9.)

**Cena 1.4 — A sua plaquinha.**

1. [say] 🔦 sua plaquinha — "This is you."
2. [say] 🔦 ícone de cartas — "How many cards you're holding. Always two at
   the start of your turn."
3. [say] 🔦 ícone de moeda — "Coins. You start with three. I'll show you
   what they buy later."
4. [say] 🔦 estrela — "And your reputation, as promised."

**Cena 1.5 — A plaquinha do oponente.**

1. [say] 🔦 plaquinha de cima — "Your opponent sits up here, with the same
   three numbers: cards, coins, reputation."
2. [say] 🔦 a estrela dele — "Some tables hide their reputation until the
   end. You can choose that in the settings."

**Cena 1.6 — O saco e o baralho.**

1. [say] 🔦 saco — "The bag. Every token you draw comes out of here. The
   number is how many are left."
2. [say] 🔦 contador do baralho — "And the deck, where new cards come from."
3. [say] 🔦 os dois — "Remember these two. When either one runs out, the
   game is nearly over."

**Cena 1.7 — Os botões de cima.**

1. [say] 🔦 botão do log — "Everything that happened, move by move, is in
   the log."
2. [say] 🔦 botão `?` — "Forgot what a token does? The rules are behind
   this one."
3. [do] 🔦 engrenagem — "Now tap the gear." → abre o SettingsDialog.
4. [say] 🔦 as opções — "How the table looks: hints on your cards, the
   opponent's reputation, what's left in the bag."
5. [say] 🔦 "Hold to give up" — "And if a game goes badly wrong, you can
   give up here. You have to hold it, so you never do it by accident."
6. [do] 🔦 o X — "Close it, and let's play."

**Cena 1.8 — Undo e End turn.**

1. [say] 🔦 Undo — "Changed your mind? Undo takes back your last move, as
   long as it's still your turn."
2. [say] 🔦 End turn com cadeado — "End turn. It stays locked until your
   token is on the board."
3. [say] "It glows gold when you can end, and green when there's nothing
   left worth doing."

**Transição.** [say] "Enough talk. I'll take the other side of the table —
let's learn by playing." → o Maple encolhe e voa até a plaquinha do
oponente. A plaquinha passa a dizer *Professor Maple*.

---

### Ato 2 — As lições (Maple na plaquinha de cima)

Cada lição começa do zero com o próprio estado. "Saco: X" quer dizer que o
saco da cena contém exatamente aquilo, na ordem em que vai sair.

**Lição 2.1 — O primeiro turno.**
Estado: tabuleiro inicial; sua mão sem nenhuma carta marcável; saco:
Pão (seu), Ferro (do Maple).

1. Banner "Your Turn". O Pão é sacado e aparece pra você.
2. [say] 🔦 token na mão — "You drew a Bread. Every turn starts like this."
3. [do] 🔦 casa `0,1` — "Put it here."
4. [say] 🔦 "Fire up?" — "Each token you place may fire up its ability,
   once. We'll try that soon — for now, skip it."
5. [do] 🔦 End turn (dourado) — "Tapping End turn skips it and ends your
   turn."
6. Banner "Opponent's turn". [play] o Maple saca o Ferro e põe em `-1,1`,
   sem fire up.
7. [say] "See? Same thing, my side. Draw, place, maybe fire up, end."

**Lição 2.2 — Marcando uma carta colocando um token.**
Estado: mesa limpa com duas Plantas em linha (`-1,1`, `0,1`); sua mão:
uma carta Planta–Planta–Planta em linha (vale 3) e uma qualquer; saco:
Planta.

1. [say] 🔦 a carta — "Three Plants in a row. Look at the board…"
2. [do] 🔦 casa `1,1` — "Finish the row."
3. A carta sobe com a aba "Score". [say] "When a card's shape is on the
   board, it rises. Tap Score to claim it."
4. [do] 🔦 aba Score → a carta voa, a estrela conta.
5. [say] 🔦 estrela — "Three of a kind is worth 3. A mix of tokens is
   worth 2."
6. [say] 🔦 ícone de cartas — "When your turn ends, your hand fills back
   up to two."
7. [do] End turn → a mão volta a ter 2 cartas (do baralho montado).

**Lição 2.3 — Pão.**
Estado: poucos tokens no centro; saco: Pão, Poção.

1. [say] 🔦 Pão na mão — "Bread: when you fire it up, you draw another
   token and place it."
2. [do] coloque o Pão em `0,0`.
3. [do] 🔦 "Fire up" — "Fire it up!" → sai a Poção.
4. [say] "A second token, same turn. And that one could fire up too!"
5. [do] coloque a Poção onde o spotlight indica; [say] "Let's keep it
   simple and skip this one." → [do] End turn.

**Lição 2.4 — Cristal.**
Estado: poucos tokens; saco: Cristal, depois Carne, Ferro, Planta.

1. [say] "Crystal: draw three, keep the one you like best, place it."
2. [do] coloque o Cristal; [do] fire up → abre o arco de três tokens.
3. [say] 🔦 o arco — "Pick one. The other two go back in the bag."
4. [do] 🔦 a Carne → coloque onde o spotlight indica.
5. [say] "The token you keep doesn't fire up. Crystals are generous, not
   that generous."

**Lição 2.5 — Carne (mover pra qualquer lugar).** *A cena que tu
descreveu.*
Dois tempos, cada um com o próprio estado.

*Tempo A — o token sozinho.* Estado: tabuleiro com **um único token**, uma
Planta em `0,0`; saco: Carne.

1. [say] 🔦 a Planta sozinha — "One lonely Plant. Let's give it a ride."
2. [say] 🔦 Carne na mão — "Meat: fire it up and you move one neighbour —
   anywhere on the board."
3. [do] 🔦 casas vizinhas da Planta — "Put the Meat right next to the
   Plant."
4. [do] fire up → 🔦 a Planta — "Pick it up…"
5. [do] 🔦 uma casa da borda, do outro lado — "…and drop it all the way
   over here."
6. [say] "Anywhere at all. It only has to start next to the Meat."

*Tempo B — mover pra fechar carta.* Estado: Planta em `0,0`, dois Ferros
em `2,-1` e `2,0`; sua mão: uma carta Planta–Ferro–Ferro nesse formato;
saco: Carne.

1. [say] 🔦 a carta e depois os Ferros — "Your card wants that Plant over
   there, between the Irons."
2. [do] Carne ao lado da Planta → fire up → 🔦 a Planta → 🔦 `1,0`.
3. [say] "Moving a token can finish a card just as well as placing one."
   → [do] Score → [do] End turn.

**Lição 2.6 — Ferro (dois passos curtos).**
Estado: Ferro sacado; dois tokens vizinhos do lugar onde ele vai, cada um a
uma casa de fechar um padrão; saco: Ferro.

1. [say] "Iron: move up to two of its neighbours, one space each."
2. [do] coloque o Ferro; fire up.
3. [do] 🔦 primeiro vizinho → uma casa.
4. [do] 🔦 segundo vizinho → uma casa.
5. [say] "Two different tokens, one step each. Small moves, big
   difference."
6. [play] (turno do Maple) ele saca uma Carne, põe e move um token seu
   pra longe. [say] "Ha! Your opponent can move your tokens too. Keep an eye
   on me."

**Lição 2.7 — Poção (trocar quaisquer dois).**
Estado: dois tokens longe um do outro que, trocados, fecham sua carta;
saco: Poção.

1. [say] "Potion: swap any two tokens on the board. Any two — they don't
   have to be near it."
2. [do] coloque a Poção; fire up.
3. [do] 🔦 primeiro token → [do] 🔦 segundo token.
4. [say] "Swapped! And look at your card…" → [do] Score.

**Lição 2.8 — Planta (usar o vizinho).**
Estado: uma Carne e uma segunda Planta vizinhas do lugar marcado; saco:
Planta.

1. [say] "Plant: it borrows the ability of a neighbour."
2. [do] coloque a Planta ao lado da Carne; fire up.
3. [do] 🔦 a Carne — "Borrow the Meat's." → move um token (alvo
   indicado).
4. [say] "A Plant next to a Plant can borrow another Plant… and the chain
   keeps going. One turn can run a long way."
5. (Opcional, se couber) [do] repetir com a cadeia Planta → Planta → Carne.

**Lição 2.9 — Pilhas de três.**
Estado: uma pilha de 2 em `0,0` e uma pilha de 3 ao lado; saco: Ferro.

1. [do] 🔦 a pilha de 3 — "Tap a stack to see what's inside." → abre o
   StackPeek.
2. [say] "Only the top token counts, for cards and for abilities."
3. [say] 🔦 a pilha de 3 — "Three is the limit. Nothing more goes on
   here."
4. [do] 🔦 a pilha de 2 — "But this one has room. Put your token on top."
5. [say] "Burying a token is a way to get it out of the way — yours or
   mine."

**Lição 2.10 — Tokens de duas cores.**
Estado: sua carta precisa de Poção numa casa e Carne em outra; saco: um
duplo Carne/Poção.

1. [say] 🔦 o duplo — "A two-coloured token. It counts as either colour for
   your cards."
2. [do] coloque onde fecha a carta → a carta sobe. [say] "Here it's the
   Potion your card wanted."
3. [say] "When you fire it up, you pick which of its two abilities to use."
4. [do] fire up → 🔦 a escolha → [do] escolha a Carne.

**Lição 2.11 — Undo.**
Estado: tu tens uma Carne pra colocar; a casa errada é óbvia.

1. [do] 🔦 casa errada — "Put it here. Trust me." 
2. [say] "…Hm. That was a terrible spot. My fault."
3. [do] 🔦 Undo — "Undo takes it back."
4. [do] coloque no lugar certo.
5. [say] "Undo works inside your own turn. It can't take back a draw — the
   bag doesn't forget — and a card you've scored stays scored."

**Lição 2.12 — Moedas.**
Estado: sua mão com duas cartas impossíveis no tabuleiro atual; baralho
montado com duas boas no topo.

1. [say] 🔦 suas cartas — "Neither of these is going to happen."
2. [do] 🔦 a moeda — "Spend a coin."
3. [say] "You draw two cards, then choose two to put back under the deck."
4. [do] 🔦 as duas ruins → devolver.
5. [say] 🔦 a moeda — "Once a turn, at most. And every coin you still hold
   at the end is worth 1 reputation — so don't splash them around."

**Lição 2.13 — Como o jogo acaba.**
Estado: saco quase vazio (contador baixo), baralho com 1 carta.

1. [say] 🔦 saco — "When the bag runs dry, six spare tokens are poured in,
   once. When those run out too, the game ends."
2. [say] 🔦 baralho — "Same with the deck: the moment the last card is
   drawn, the end begins."
3. [do] marque uma carta e End turn → a mão puxa a última carta do
   baralho. [say] "That was the last card!"
4. [say] "Whoever didn't trigger the end gets one last chance to score —
   no token, just cards already on the board. That's me."
5. [play] o Maple marca uma carta roteirizada.
6. Tela de fim de jogo (roteirizada, ganhando o jogador). [say] "Most
   reputation wins — your coins count now, one each. If it's a tie, whoever
   scored more cards wins."

---

### Ato 3 — O aquecimento

1. [say] (Maple de volta ao centro) "You've got the knack of it. Fancy a
   warm-up game against me? I'll go easy on you."
2. Dois botões na faixa: **"Let's play"** → começa uma **partida real no
   Easy**, com o avatar e o nome do Maple na plaquinha do oponente.
   **"Back to menu"** → tela inicial.

## Partes do "como" já decididas

- Abordagem A: estado montado à mão por lição, filtro de `legalActions`
  no tutorial, ações do professor roteirizadas pelo `applyAction`. O motor
  não ganha nenhuma regra nova.
- Roda na GameScreen real com a HUD inteira (o spotlight aponta pros
  botões de verdade).
- Lições independentes, cada uma com seu estado inicial.
- O Maple fica no centro no Ato 1 e na plaquinha do oponente no Ato 2.
- Skip dentro da faixa.
- Idioma: inglês.
- O aquecimento final é uma partida real no Easy; o tutorial em si é 100%
  controlado.

## Decisões minhas (pode corrigir)

- Ordem das lições do Ato 2 (primeiro turno → carta → os 6 tokens →
  pilha → duplo → Undo → moedas → fim).
- "Marcar carta colocando" fica na 2.2; "marcar carta movendo" na 2.5
  (Carne) e na 2.7 (Poção).
- O turno do Maple aparece na 2.1 (pra ver a vez do outro), na 2.6 (ele
  atrapalha você) e na 2.13 (a última chance).
- O tutorial força `cardGlow` ligado (a aba Score é parte da lição) e
  `opponentThinks` com uma pausa curta.
- Confirmação do Skip na própria faixa, sem dialog.
- Sair no meio volta pra tela inicial; não guarda progresso.

## O que fica com quem for implementar

- Formato exato dos dados de cena e dos passos; como o filtro de
  `legalActions` encaixa no `useLocalTable`/`useGame`.
- Casas exatas e cartas de cada cena (as daqui são sugestão) — cada cena
  precisa de um teste que roda os passos no motor e confirma que a ação
  pedida é legal e que a carta fecha mesmo.
- Implementação do spotlight (recorte em SVG/CSS mask sobre o elemento
  alvo) e de como ele encontra o alvo.
- Arte do Professor Maple: um retrato grande (Ato 1) e o recorte de
  avatar (Ato 2). Gerada no mesmo estilo de `designs/art/`.
- A animação do Maple voando do centro pra plaquinha.
- Comportamento com `prefers-reduced-motion` (sem voo, só troca).
- Conferir se o StackPeek (lição 2.9) abre com toque enquanto há um token
  pra colocar; se não, a lição mostra a pilha antes de sacar.
- A partida de aquecimento precisa aceitar avatar e nome do oponente
  (hoje fixos em "Opponent").
- Leitores de tela: a fala da faixa anunciada via `aria-live`.
