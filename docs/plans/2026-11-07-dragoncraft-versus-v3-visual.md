# Dragoncraft Versus v3 — Plano da Camada Visual

**Goal:** O jogo ganha a cara dos mockups em `designs/` — estufa alquímica, tabuleiro de pedra com moldura dourada, peças com volume, cartas de pergaminho, bolsa de veludo — e o *game feel* do Hearthstone: banner de turno, peça saindo da bolsa, peça caindo no tabuleiro com impacto, carta pontuável brilhando, Discover para o cristal. Nenhuma regra muda, e o jogo continua jogável, testável e acessível a cada fase.

**Architecture:** O motor e o `Table` não mudam. Entra uma **camada de apresentação** entre a `PlayerView` e a tela: ela compara o log da visão anterior com o da nova, transforma a diferença numa fila de eventos (`draw`, `place`, `fireUp`, `move`, `swap`, `score`, `coin`, `endTurn`) e toca cada um como uma coreografia curta. A verdade (o que é clicável, o que o leitor de tela anuncia) é sempre a visão atual; a animação é só como ela chega lá. Funciona igual no local e no online, porque os dois entregam visões com log.

**Tech Stack:** O que já existe, mais `motion` (ex-Framer Motion) para animação declarativa em React (springs, `AnimatePresence`, sequências). Arte raster em WebP para fundo, bolsa, avatares e texturas; SVG para tabuleiro, peças e molduras. Sem 3D.

**Referências:** `designs/*.png`. Nenhuma imagem é especificação: cada uma acerta umas coisas e erra outras (seção 1).

---

## 1. Análise dos designs

### 1.1 Revisão imagem por imagem (com o Bruno)

O que vale levar de cada imagem foi decidido aqui, uma imagem de cada vez. Só vale o que está nesta seção; o que não foi citado não é referência.

#### UI-Konzepttafel — revisada em 2026-11-08

- **"Place the token" mostra as cartas da mão.** No mockup elas somem nessa tela; não podem sumir. As cartas são o que diz se a casa escolhida vai fechar uma carta, então ficam visíveis em todo momento de escolher casa (colocar, cristal, Carne, Ferro, Poção, Planta).
- **Brilho da carta antes de confirmar (configuração da sala).** Com a prévia na casa (primeiro toque, antes de confirmar), a carta que aquela jogada completaria brilha. Vira uma opção da sala, porque hoje o jogo de propósito não aponta onde uma carta fecha (`GameScreen.tsx`: "the printed game does not point out where a card would complete"). Desligada, o jogo continua como o impresso. **Vem ligada por padrão.**
- **Reputação visível também vira configuração da sala.** Mostrar ou esconder a reputação dos dois jogadores durante a partida.
- **Cartas do jogador "You" precisam aparecer** em todas as telas do turno — ainda a discutir onde e como.
- **Mão de 3 cartas sem apertar.** Existe um *fancy dragon* que deixa jogar com 3 cartas. O Fancy Mode ainda não existe no motor (`HAND_SIZE = 2`; a spec o deixa fora da v1), mas o layout da mão nasce suportando 2 ou 3 cartas sem ficarem espremidas.
- **Contador de cartas: a decidir, inclinação é manter, para You e Opponent.** Os dois jogadores sempre têm o mesmo número de cartas (2 e 2, ou 3 e 3), então ele informa pouco; se ficar, aparece nas duas placas, do mesmo jeito.
- **Reputação das cartas no mockup está errada** (seção 1.2, item 4).

#### Dein Zug — revisada em 2026-11-08

Tem muita coisa errada; vale só o que está listado aqui.

- **Levar:**
  - **O fundo** de estufa.
  - **O banner "Your Turn"**.
  - **O efeito da peça recém-colocada**: depois do "Place here", a peça na casa ganha o brilho dourado com faíscas do mockup, e ele dura enquanto a decisão de ativar está aberta.
  - **A bolsa com a contagem de peças** ("Bag 12").
- **Não levar:**
  - **"Next draw"** com as próximas peças. Não faz sentido: a ordem da bolsa é secreta.
  - O resto da tela (placas, cartas com custo em moeda, layout da mão) não serve de referência.
- **Painel de ativar:** a ideia visual dos botões serve, mas:
  - **Só duas escolhas: ativar ou não ativar.** O botão de ativar tem efeito de fogo (chama animada, brasa), não é só um botão laranja.
  - **A moeda sai desse painel** (a discutir). O motor permite gastar moeda em qualquer momento do turno antes de passar a vez, inclusive nessa hora; então ela precisa morar em outro lugar fixo da tela, não sumir. Proposta na revisão do Guia: a moeda como botão próprio.

#### Guia de Assets — revisada em 2026-11-08

O guia vale quase inteiro como referência de assets e estados. Ajustes:

- **Escolha de cartas (item 6) em grade 2×2**, não em fileira 1×4. É o modal da moeda (4 cartas, ficar com 2).
- **HUD (item 7) é uma peça só por jogador:** cartas, reputação e moedas juntas na mesma placa, não em pílulas separadas como no guia.
- **Moeda como botão separado** é uma boa: resolve onde gastar moeda depois que ela sai do painel de ativar (Dein Zug). A placa mostra quantas moedas você tem; o botão gasta. A decidir onde ele fica.
- **Efeitos (item 9):** todos agradam. Os prioritários são **colocar peça** (M4), **fire up** (M5) e **ganho de reputação** (M10). "Peça sorteada da bolsa" vem junto com a animação da bolsa (M2).
- O tabuleiro do item 2 serve pelo visual (pedra, moldura, estados selecionado/válido/inválido). A quantidade de casas não: o tabuleiro é sempre o de 19.

#### Spielbrett-5 — revisada em 2026-11-08

- **Símbolos ilustrados das peças: levar.** O mockup tem cristal (azul), pão (amarelo), carne (vermelho), planta (verde) e ferro (cinza), mas esqueceu a **poção (roxo)**, que aparece só com o ▼ geométrico. Ao desenhar os símbolos, a poção entra no conjunto com o mesmo tratamento (frasco), e as duplas usam os mesmos símbolos.
- **Volume das peças: levar.** É a referência de ficha com espessura, bisel e sombra.
- **Botão End Turn: precisa existir**, e no estilo do Hearthstone: **sempre presente na tela**.
  - No seu turno: dourado/azul, vivo.
  - No turno do oponente: cinza, sem ação.
  - O motor só aceita passar a vez depois que a peça foi colocada e as habilidades resolvidas (`endTurn` só é legal sem pendência aberta). **A restrição fica.** Duas formas aceitas, a escolher no layout: o botão aparece bloqueado e destrava quando a peça é colocada, ou só aparece depois de colocar. O brilho de "não sobrou nada útil" (M12) entra por cima disso.
  - **Onde ele fica no layout ainda está em aberto.** A posição do mockup não é decisão; o que vale é que ele existe.

#### Arena-3 — revisada em 2026-11-08

Quase não acrescenta: a direção do turno é a da Konzepttafel (banner "Your Turn" no seu turno, "Opponent is thinking…" no dele). O que entra daqui:

- **Turno do oponente em vermelho/vinho** ("Opponent's Turn").
- **"Opponent is thinking…" com ampulheta.**

O resto (cartas triangulares, layout, tabuleiro) não é referência.

### 1.2 O que está errado nas imagens (contra as regras do motor)

Conferido em `packages/engine/src/{types,cards,tokens,engine}.ts`.

1. **Faltam a sexta peça.** As legendas (Konzepttafel, Guia) mostram 5 tipos. São 6: `bread, crystal, meat, iron, potion, plant`. A Poção (roxa, ▼) aparece no tabuleiro de todas as imagens, mas sem nome e sem asset.
2. **Não existem as peças duplas.** São 6 fichas de duas cores (anel `bread–crystal–iron–potion–plant–meat`). Nenhuma imagem mostra. Hoje são um disco partido ao meio; precisam do mesmo tratamento das simples.
3. **Não existem pilhas.** Uma casa empilha até 3 e só a de cima conta. Nenhuma imagem mostra uma pilha. Precisa de visual (fichas deslocadas embaixo + contador) e do inspetor de pilha que já existe.
4. **Reputação das cartas trocada.** Konzepttafel diz "Line = 2, Triangle = 3". A reputação vem dos **tipos**, não da forma:
   - **Três do mesmo tipo = 3**, em linha ou em triângulo.
   - **Tipos diferentes = 2** (dois iguais e um diferente, sempre em linha, com o diferente numa ponta).
   - **Não existe triângulo misto.** Estão errados: o triângulo cristal+pão+pão ★3 (Spielbrett-5), os triângulos "verde+vermelho+vermelho", "azul+vermelho+vermelho", "laranja+laranja+cinza" (Konzepttafel, Guia).
   - Arena-3 põe o padrão "Two Crystal and one Bread" (que é uma *linha*) numa carta em forma de triângulo com ★★★: forma e reputação erradas.
5. **Carta não tem custo.** Dein Zug põe "2🪙" no canto das cartas. Carta não se compra com moeda; a moeda compra 2 cartas e devolve 2.
6. **Reputação não é "3 estrelas".** Spielbrett-5 mostra "Reputation ☆☆☆" como se fosse uma nota. Reputação é um número (as partidas chegam a ~30). Estrela é ícone ao lado do número.
7. **"Next draw (3)" vaza informação oculta.** A *ordem* da bolsa é secreta (só a composição é pública). Mostrar as próximas 3 peças está errado. O que pode existir: tocar na bolsa e ver **a composição** (quantas de cada restam) — isso a `PlayerView` já entrega e é uma boa ideia.
8. **"Fire Up" não é um botão permanente.** Spielbrett-5 deixa "Fire Up" e "End Turn" lado a lado o tempo todo. Ativar só existe logo depois de colocar (pendência `mayFireUp`), e só para a peça recém-colocada.
9. **Contradições de estado.** Spielbrett-5: banner "Your Turn" e barra "The opponent is thinking…" ao mesmo tempo. Dein Zug: a peça acesa é Pão (laranja) e o botão diz "Fire up Meat".
10. **Tabuleiro com casas a mais.** O do Guia tem mais de 19 casas. O certo é o hexágono de raio 2: 3-4-5-4-3 = 19.
11. **Telas que faltam:** cristal (compra 3, fica com 1 — é o *Discover* do Hearthstone), alvos de Carne / Ferro / Poção / Planta, escolha de habilidade de peça dupla, pontuar carta, fim de jogo, log, inspetor de pilha, escolha de modo, lobby com PIN, reconectando.

### 1.3 Duas linguagens de peça

As imagens usam dois estilos de símbolo: **geométrico** (◆ ■ ▲ ✦ ● ▼ — o que o jogo usa hoje, em `theme.ts`) e **ilustrado** (Spielbrett-5). O geométrico garante que forma sozinha identifica a peça a 40px (requisito de acessibilidade já testado). O ilustrado é bem mais bonito e temático, e as seis silhuetas também são distintas entre si. Decidido: ilustrado (seção 7).

---

## 2. Como construir: 2D, 2.5D ou 3D

**Recomendação: 2.5D.** Arte pintada para o que é cenário, vetor para o que é jogo, e profundidade fingida com luz, sombra e perspectiva.

| Camada | Técnica | Por quê |
|---|---|---|
| Fundo de estufa | WebP pintado (gerado por IA), jogo + versão desfocada para overlay | É o que dá o "uau" das imagens; impossível em CSS. ~150–250 KB. |
| Tabuleiro | SVG: casas de pedra (textura em `<pattern>`), juntas e moldura dourada em gradiente | Já é SVG; escala sem borrar; as casas continuam elementos clicáveis com `aria-label`. |
| Peças | SVG procedural: disco com bisel (gradiente radial), brilho especular, aro escuro, sombra que encolhe quando a peça "sobe" | 6 simples + 6 duplas saem do mesmo componente; uma imagem por peça daria 12+ arquivos e não acenderia/apagaria por código. |
| Ícones das peças | SVG paths (geométricos ou ilustrados) | Brancos sobre a cor, silhueta forte. |
| Bolsa | 1 WebP + transformações (sacudir = rotação, abrir = escala + brilho por cima) | Os 3 quadros do Guia viram 1 imagem e movimento. |
| Cartas | Textura de pergaminho (WebP pequeno) + moldura em `border-image` 9-slice + padrão desenhado com as mesmas peças SVG | O padrão é o mesmo componente do tabuleiro, então nunca diverge. |
| Banners, botões, placas | `border-image` 9-slice com moldura dourada + texto real | Texto real = traduzível, acessível, nítido. |
| Avatares | WebP circular, 2 dragões (você / oponente) | |
| Partículas (fogo, brilhos, poeira) | Canvas 2D leve num overlay, ou sprites CSS | Poucas dezenas por efeito, só durante o efeito. |

**Por que não 3D (three.js / R3F):** as referências são pinturas 2D, não renders; 3D traria ~150 KB+ de runtime, custo de bateria contínuo, perda do DOM acessível do tabuleiro (as casas viram pixels num canvas), e a mesma sensação de volume sai de gradiente + sombra + `perspective`. Um toque barato de 3D que vale: o tabuleiro levemente inclinado com `transform: perspective() rotateX()` e as peças "caindo" no eixo Z falso (escala + sombra). Se um dia quiser peças 3D de verdade, dá para trocar só o componente da peça, porque a camada de apresentação não depende de como a peça é desenhada.

---

## 3. Sistema visual

### 3.1 Cores (tokens em `:root`, substituindo os atuais)

| Token | Valor | Uso |
|---|---|---|
| `--forest-900` | `#13261d` | Fundo das placas, barras, overlay |
| `--forest-600` | `#2f5a3c` | Botão primário (Confirm, Your Turn) |
| `--brass-400` | `#d9b45a` | Molduras, aros, números |
| `--brass-200` | `#f3dfa2` | Brilhos, realce de borda |
| `--parchment` | `#efe2c2` | Cartas, painéis de decisão |
| `--ink` | `#3b2a17` | Texto sobre pergaminho |
| `--wine-700` | `#6d2232` | Tudo que é do oponente (banner de turno, faixa "Opponent drew") |
| `--glow-valid` | `#9be15d` | Casa válida |
| `--glow-select` | `#62c3ff` | Casa selecionada |

As cores das 6 peças ficam em `theme.ts`, ajustadas para ficarem mais saturadas como nas imagens; `contrast.test.ts` continua garantindo contraste do ícone branco.

**Regra de cor do Hearthstone:** verde/dourado = você, vinho = oponente. Todo elemento do oponente (banner, faixa da bolsa, brilho da peça que ele jogou) usa vinho, para que dê pra saber de quem é o momento sem ler.

### 3.2 Tipografia

**Alegreya** (títulos, banners, nomes de carta) + **Alegreya Sans** (números, rótulos pequenos, botões secundários). Serifada de livro antigo, com cara de grimório de alquimia, e legível em tamanho pequeno — as imagens usam uma serifada parecida. Números com `font-variant-numeric: tabular-nums` para o placar não pular. Carregadas com `font-display: swap`, só os pesos usados (400, 700).

### 3.3 Layout no celular (retrato) — aprovado em 2026-11-08

Layout D do canvas de layouts (https://claude.ai/artifact/RQE7JcT4gNDj7wc2LsZ4jz), uma mistura das opções A e B.

```
┌──────────────────────────────┐
│ Dragoncraft Versus [log][⚙][?]│  cabeçalho fixo
│ (🐉) Opponent    🂠3 🪙3 ★4   │  placa do oponente
│          ⬡⬡⬡                 │
│        ⬡⬡⬡⬡                  │
│       ⬡⬡⬡⬡⬡                 │  tabuleiro
│        ⬡⬡⬡⬡                  │
│ ○●●     ⬡⬡⬡        [bolsa]   │  moedas no canto esq., bolsa no dir.
│ Spend coin          Bag 23   │
│ ╭ Place your Crystal  [Cancel] [Place here] ╮ │  painel de decisão
│    ┌───┐ ┌───┐ ┌───┐         │
│    │ ★3│ │ ★2│ │ ★3│         │  mão em leque (2 ou 3 cartas)
│    └───┘ └───┘ └───┘         │
│ (🐉) 🂠3 🪙2 ★5   [End turn]  │  barra sua, discreta, lá embaixo
└──────────────────────────────┘
```

- **Banner de turno não é fixo.** "Your Turn" (verde) e "Opponent's Turn" (vinho) aparecem sobre a tela escurecida por 1–2s e somem, como no Hearthstone. O que fica dizendo de quem é a vez: o End Turn (dourado no seu turno, cinza no dele), um brilho verde no seu avatar e "Opponent is thinking…" com ampulheta no turno dele.
- **Placa do oponente** em cima; **sua barra** lá embaixo, mais discreta (fundo mais transparente, borda fina, avatar menor): cartas, moedas, reputação. O **End Turn** fica ao lado dela, grande.
- **Moedas** no canto inferior esquerdo da área do tabuleiro, como três moedinhas: cada moeda gasta vira um encaixe vazio tracejado. O grupo inteiro é o botão de gastar. A forma final ainda pode ser refinada.
- **Bolsa** no canto inferior direito, com a contagem, tocável (abre a composição).
- **Mão em leque** acima da sua barra: 2 ou 3 cartas sem apertar, só com o padrão e a **estrela grande com o número** (sem nome). A carta que a prévia completaria brilha e sobe um pouco.
- **Painel de decisão** entre o tabuleiro e a mão; muda por pendência.
- **Prévia da peça:** sólida (não translúcida), flutuando acima da casa com contorno azul e sombra no chão. Numa casa com pilha, ela flutua mais alto, nada embaixo se mexe, e um selo diz a posição que vai ocupar ("3 of 3"); ao confirmar, ela cai e encaixa no topo.
- **Pilhas** desenhadas como discos empilhados: cada peça enterrada aparece como uma borda da própria cor por baixo da de cima, mais o contador.

Restrições que já existem no código e continuam valendo:
- **O tabuleiro nunca encolhe abaixo de 250px de altura** (`styles.css`, abaixo disso a casa fica menor que 44px).
- **Nada acima do tabuleiro muda de altura durante o jogo** (`TopBar.tsx`: reflow mudava o centro das casas e transformava o segundo toque em erro). O banner de turno é sobreposto (`position: absolute`), não empurra nada.
- **Dois toques para confirmar** continuam: o primeiro mostra a prévia na casa, o segundo confirma.
- Testar em 360×640 (Android pequeno), 390×844 e 430×932. O layout D ocupa ~780px de altura em 390×844; o celular pequeno precisa de uma versão compacta (cartas menores, placas mais baixas), ainda por desenhar.

### 3.4 Movimento (tokens)

| Token | Valor | Uso |
|---|---|---|
| `--t-tap` | 100ms | Resposta ao toque (escala 0.96) |
| `--t-ui` | 200ms | Painéis, troca de estado |
| `--t-move` | 350ms | Peça se movendo pelo tabuleiro |
| `--t-show` | 700–1100ms | Momentos: banner, bolsa, pontuação |
| Mola padrão | `stiffness 400, damping 28` | Peças pousando, cartas |
| Saída | 60% da entrada | Tudo que sai |

Regras: **toque em qualquer lugar adianta a fila** (nenhuma animação bloqueia o jogo); `prefers-reduced-motion` troca movimento por *crossfade* curto e desliga partículas e ambiente; ambiente pausa com a aba oculta.

---

## 4. Momentos (as micro-interações)

Cada um tem o paralelo no Hearthstone, o que dispara, e a coreografia.

| # | Momento | HS | Gatilho (log / pendência) | Coreografia |
|---|---|---|---|---|
| M1 | **Seu turno** | Banner "Your Turn" | `current` vira você | Banner desce com overshoot sobre a tela escurecida, raios de luz atrás, fica 1–2s e some. No turno dele: o mesmo banner em vinho, depois "Opponent is thinking…" com ampulheta girando. |
| M2 | **Compra da bolsa** | Carta saindo do deck | entrada `draw` | Bolsa sacode 2×, abre com brilho, a peça sobe girando até o centro, faixa "You drew **Crystal**" (vinho e menor para o oponente), peça encolhe e vai para o slot "na mão" do painel de decisão. ~1.2s, adiantável. |
| M3 | **Escolher casa** | Mira do lacaio | pendência `place` | Casas válidas pulsam verde suave; primeiro toque: a peça flutua sólida sobre a casa, com anel azul e sombra no chão (mais alto sobre uma pilha, com o selo da posição). |
| M4 | **Peça cai no tabuleiro** | Lacaio entrando em campo | `place` | Peça desce do Z (escala 1.35→1), squash no impacto, onda de poeira dourada, tremor de 2px no tabuleiro. Em pilha: fichas de baixo afundam 1px e o contador "pula". |
| M5 | **Ativar (Fire Up)** | Battlecry | `mayFireUp` → `fireUp` | Painel "Fire up this dragon?" com o efeito escrito; ao ativar, labareda em volta da peça, aro em brasa enquanto a habilidade está pendente. |
| M6 | **Cristal** | **Discover** | `crystalPick` | 3 peças saem da bolsa em leque sobre o tabuleiro escurecido; escolher uma, as outras voltam. Depois "Place the token (without firing up)". |
| M7 | **Carne / Ferro** | — | `meatMove`, `ironMove` | Peça sobe, viaja em arco, pousa (M4 menor). Ferro: até 2, numerados. |
| M8 | **Poção** | — | `potionSwap` | As duas peças sobem e trocam em arcos cruzados com rastro roxo. |
| M9 | **Planta** | — | `plantTarget` | Cipó verde cresce da planta até o vizinho; o vizinho faz o seu M5. Cadeia de plantas = cipós em sequência. |
| M10 | **Carta pontuável** | Carta jogável com borda verde | `scoreCard` legal | Borda dourada pulsando na carta. Ao tocar no Score: as 3 casas do padrão acendem em sequência, a carta voa até sua placa, estrelas estouram, o número conta para cima. |
| M11 | **Moeda** | — | `spendCoin` → `coinDiscard` | Moeda gira e voa até o deck, 2 cartas deslizam para a mão, abre "Choose 2 cards / keep two" (o modal do Konzepttafel). |
| M12 | **Fim de turno** | Botão End Turn amarelo | só `endTurn` (e talvez `spendCoin`) legal | Botão "End Turn" ganha brilho quando não sobra nada útil — exatamente o sinal do HS. |
| M13 | **Ações do oponente** | Jogada do oponente visível | log do outro assento | Mesmos M2–M10, mais rápidos, com cor vinho; cartas dele aparecem como verso. |
| M14 | **Fim de jogo** | Brasão de vitória/derrota | `phase: ended` | Brasão grande com resultado, placar contando, botão de nova partida. |
| M15 | **Ambiente** | Tabuleiro vivo | sempre | Partículas de luz flutuando, lanterna piscando. Mínimo, e desligado em movimento reduzido. |

---

## 5. A peça técnica que decide tudo: a fila de apresentação

Hoje a tela pinta direto a `PlayerView`. Uma ação da máquina, ou várias (uma cadeia de planta), chegam como uma visão nova e a tela pula. Para animar, precisa saber **o que aconteceu**, não só o resultado.

- **Fonte:** `view.log` já registra cada passo com o assento (`draw` com a peça, `place` com a casa, `meatMove` com de/para, `potionSwap`, `scoreCard`, `endTurn`...). Entre duas visões, as entradas novas do log são exatamente o roteiro a tocar. Vale para local e online sem mexer no servidor.
- **Estado apresentado ≠ estado real:** a fila mantém um "tabuleiro apresentado" que anda passo a passo até alcançar o real. Para reconstruir os passos intermediários sem o `GameState`, aplicamos cada entrada do log ao tabuleiro apresentado com uma função pura pequena (colocar, mover, trocar — operações de tabuleiro que o motor já expõe em `board.ts`).
- **Identidade das peças:** o motor não dá id às fichas. Para animar uma peça *indo* de uma casa a outra (e não sumindo e aparecendo), a fila atribui ids de apresentação ao colocar e os carrega nos movimentos.
- **Desfazer** não anima: a fila é descartada e o tabuleiro apresentado vira o real na hora.
- **Reconexão / visão inicial** não anima: só entradas que chegam com a tela já montada.
- **Testes:** `App.test.tsx` joga uma partida inteira pelo DOM. Em teste (e em movimento reduzido) a fila tem duração zero, então nada muda para os testes. Testes novos cobrem a fila como função pura: log antes/depois → lista de eventos.
- **Acessibilidade:** o anúncio para leitor de tela sai do evento ("Opponent placed Meat at…"), não da animação.

Essa é a primeira fase de código depois da pele estática, e as animações de verdade só começam quando ela estiver testada.

---

## 6. Fases

Cada fase é um PR que funciona sozinho. Critério de aceite comum: testes verdes, `typecheck` limpo, captura em 360×640 e 390×844 lado a lado com a referência, e uma checagem com movimento reduzido.

| Fase | Entrega | Depende de |
|---|---|---|
| **F0 · Fundação** | Tokens de cor/tipo/movimento, fontes, `motion` instalado, hook `useReducedMotion` e modo "sem animação" em teste. Nada visível muda além da fonte. | — |
| **F1 · Arte** | Produzir e otimizar os assets raster (seção 6.1). | decisões da seção 7 |
| **F2 · Tabuleiro e peças** | Fundo, tabuleiro de pedra com moldura, peças com volume (6 simples + 6 duplas), pilhas, estados selecionado/válido. Estático. | F0, F1 |
| **F3 · HUD** | Cabeçalho com ícones, placa do oponente e barra sua com avatar, End Turn, moedas no canto, mão em leque com cartas de pergaminho (padrão + estrela grande), botões (primário verde, secundário pergaminho, Undo cinza), painel de decisão por pendência, bolsa com contador e composição. | F2 |
| **F4 · Modais** | Choose 2 cards (moeda), Discover do cristal, inspetor de pilha, log, fim de jogo, e reskin de escolha de modo / lobby / reconectando. | F3 |
| **F5 · Fila de apresentação** | Seção 5, só com crossfades. Toda a lógica testada. | F2 |
| **F6 · Turno** | M1 e M12. | F5 |
| **F7 · Bolsa** | M2 (você e oponente). | F5 |
| **F8 · Colocar** | M3, M4, pilha. | F5 |
| **F9 · Habilidades** | M5–M9. | F8 |
| **F10 · Pontuar e moeda** | M10, M11. | F5 |
| **F11 · Polimento** | M13 revisado, M14, M15, passe de performance num Android barato, peso total < 1.5 MB. | todas |
| **F12 · Som (opcional)** | Compra, impacto, fogo, pontuação, turno. Com botão de mudo. | F6–F10 |
| **F13 · Repensar** | Os itens da seção 8, depois de toda a pele e todo o movimento estarem no lugar. | F0–F12 |

Andamento (2026-11-10): F0–F11 feitas (F1: arte escolhida em A/B, ver decisão 5). F13 em grande parte feita (8.1: itens 1 e 4 feitos, 2 e 3 esperando arte; 8.2: item 5 e 6 feitos). Falta F12 (som, opcional).

### 6.1 Lista de assets raster

| Asset | Formato | Observação |
|---|---|---|
| Fundo da estufa, jogo | WebP 1080×2340 | **Sem UI pintada**, centro mais escuro e calmo onde fica o tabuleiro |
| Fundo, overlay/modal | WebP pequeno | Versão desfocada |
| Bolsa de veludo verde | WebP com alfa, ~512px | Boca fechada, frontal |
| Avatares dragão ×2 | WebP circular, 256px | Dourado/verde (você), vermelho (oponente) |
| Textura de pedra da casa | WebP 256px *tileable* | |
| Textura de pergaminho | WebP 256px *tileable* | |
| Moldura dourada (carta, banner, painel) | PNG 9-slice | Uma por tipo de superfície |
| Folhagem de canto (opcional) | WebP com alfa | Decora as bordas da tela |

Tudo o mais (peças, ícones, tabuleiro, botões, partículas) é SVG/CSS/canvas.

---

### 6.2 Prompts da arte

Todos começam com o mesmo bloco de estilo, para que os assets saiam da mesma mão:

> *Style: painted mobile-game art in the style of Hearthstone and cozy fantasy board games; botanical alchemy greenhouse; warm golden sunlight, emerald and brass palette, soft painterly brushwork, rich but not noisy detail. No text, no letters, no UI, no buttons, no game board, no tokens.*

| Asset | Prompt (depois do bloco de estilo) | Saída |
|---|---|---|
| Fundo, jogo | *Vertical 9:19.5 interior of a Victorian glass greenhouse used as an alchemist's garden. Tall arched iron-framed windows at the top with sunlight streaming in. Lush hanging vines, ferns and pink and purple flowers framing the left and right edges. A brass lantern upper left, glass bell jars with glowing crystals and potion bottles on wooden shelves low on the left, a brass armillary sphere on the right. The center of the image, from 25% to 75% height, is a calm, slightly darker, softly blurred stone floor and wooden table with nothing on it, so a game board can sit there. Bottom 20% is a dark wooden tabletop.* | PNG 1080×2340 ou maior |
| Fundo, overlay | Mesmo prompt, depois desfocado por mim. Não precisa gerar. | — |
| Bolsa | *A single drawstring pouch of deep emerald velvet, tied at the neck with a thick golden rope and tassels, embroidered with a golden leaf motif on the front. Closed, front view, slightly plump, sitting upright. Isolated on a plain flat light-grey background, soft shadow under it.* | PNG quadrado ≥1024 |
| Avatar você | *Circular portrait bust of a noble young dragon, emerald and gold scales, curled horns, facing right, three-quarter view, calm and confident. Plain dark-green background, centered, head and neck filling the circle.* | PNG quadrado ≥512 |
| Avatar oponente | Mesmo prompt com *crimson and ember-orange scales, facing left, mischievous expression*. | PNG quadrado ≥512 |
| Textura de pedra | *Seamless tileable top-down texture of pale weathered sandstone with fine cracks and a little green moss in the crevices. Flat even lighting, no shadows, no perspective.* | PNG 1024 quadrado |
| Textura de pergaminho | *Seamless tileable top-down texture of warm cream parchment paper with subtle fibers and faint stains. Flat even lighting.* | PNG 1024 quadrado |

As molduras douradas, os ícones das peças, as peças e as partículas eu faço em SVG/CSS. Recorte de fundo, compressão para WebP e versões @1x/@2x ficam comigo.

## 7. Decisões

Tomadas em 2026-11-07:

1. **Ícones das peças: ilustrados** — cristal, lingote, pão, folha, pernil e frasco de poção, em SVG branco sobre a cor da peça. O teste de acessibilidade passa a verificar que as 6 silhuetas são distintas, no lugar dos símbolos geométricos.
2. **Cartas: retangulares**, com o padrão (linha ou triângulo) desenhado dentro e a reputação em número + estrela.
3. **Arte raster: o Bruno gera** com os prompts da seção 6.2; eu otimizo e integro.
4. **Ordem: pele estática primeiro** — F0 → F1 → F2 → F3 → F4, depois F5 em diante.

Em aberto: **som** (F12) — decidir quando chegarmos lá.

Tomadas em 2026-11-10:

5. **Arte escolhida** (A/B de cada asset): fundo B (hora dourada), bolsa A, avatares B (ilustração chapada, os dois), pedra B (lajes), pergaminho A. **Folhagem de canto: descartada** — nenhuma das duas agradou; não existe mais no código nem nos assets.
6. **A moeda** é uma imagem só, usada como está.

## 8. Pendências (F13 e o que não pode se perder)

Tudo o que foi notado durante F0–F6 e ficou para depois. Nada daqui se faz antes de F12, salvo o que for bloqueio.

### 8.1 Repensar (F13)

1. **[Feito 2026-11-10]** **Banner de turno contra a máquina.** A tela avisa a mesa quando ainda está mostrando algo; a máquina espera, e só então pensa (1,5s antes da primeira jogada, 0,7s entre jogadas) ou joga logo, conforme a opção local "The machine takes its time". O painel de decisão também espera: "Opponent is playing…" enquanto as jogadas dele aterrissam, "Drawing from the bag…" enquanto a sua peça sai. Texto original: Hoje a máquina joga assim que é a vez dela, então "Opponent's Turn" sobe enquanto as jogadas dela já correm (escurecidas) por baixo, e logo em seguida vem "Your Turn": com a IA, há sempre um banner na tela. Decisão a tomar: a máquina **espera o banner sair** antes de jogar (obrigatório), e ganha um **"pensamento" falso** — uma pausa de 1–2s com a ampulheta antes da primeira jogada e talvez entre jogadas. **Vira configuração:** jogar na hora ou com pensamento falso. Toque adianta tudo, como sempre.
2. **[Descartada em 2026-11-11: feita, vista na tela e removida — a bolsa fechada basta]** **Bolsa aberta.** Prompt em `2026-11-10-v3-art-prompts.md`, item 8; salvar `designs/art/bag-open.png` e rodar o script. Texto original: Falta uma imagem da bolsa com a boca aberta (e talvez uma sacudindo), para trocar no momento em que a peça sai (M2). Hoje a compra usa a bolsa fechada com transformações. Precisa de prompt (mesmo bloco de estilo da seção 6.2; "the same pouch, mouth open, golden light spilling out, seen slightly from above"), e o recorte/integração ficam comigo.
3. **[Prompts escritos, item 9 e 10]** **Ícones gerados.** Os ícones de interface (cartas, estrela, log, undo, End turn, cadeado, fogo, ampulheta) e talvez os seis ícones das peças são desenhados em SVG e o Bruno não gostou. Avaliar gerar um conjunto; os das peças continuam dentro do componente SVG (acendem, partem ao meio nas duplas, empilham), só o desenho interno trocaria.
4. **Configurações (⚙) e ajuda (?).** Feito em 2026-11-10: as opções da mesa (brilho da carta, reputação visível, composição da bolsa) são escolhidas numa tela depois da dificuldade ou depois de "Create"; contra a máquina dá para mudar durante o jogo, online são do anfitrião e ficam só para leitura para os dois (o servidor as recebe no `create` e as manda no `seated`). **Falta:** o pensamento falso da IA (item 1) e o som (F12) entrarem nessa tela, e o botão **?** — feito em 2026-11-10.

### 8.2 Layout e acabamento

5. **[Feito 2026-11-10: botões em linhas compartilhadas, linhas de efeito menores, padrão da carta mais baixo; o alvo de toque de 44px fica]** **Celular pequeno (360×640).** O painel de decisão com a escolha de ativar de uma peça dupla (dois botões de fogo com duas linhas + "Do not fire up") tem ~200px e não cabe: o painel rola, mas o End turn pode sair pela borda de baixo. Precisa da versão compacta prometida na seção 3.3 (cartas mais baixas, painel com botões em linha única, placas menores). A 390×844 tudo cabe.
6. **[Feito]** **Padrão das cartas** um pouco pequeno em telas grandes (430×932). Ajuste de uma linha na altura do `.pattern`.
7. **Contador de cartas** nas placas: decidido manter (seção 1.1); conferir se ainda vale depois do Fancy Mode.
8. **Peso do bundle.** O JS foi de 65 KB para 118 KB gzip com o `motion`. Dentro do orçamento (1.5 MB total), mas vale conferir no passe de performance (F11) se o `motion/react-mini` basta.
9. **Fancy Mode (3 cartas).** A mão já suporta 3; o motor não. Fora da v3.

10a. **Desempenho medido só no computador.** Com a CPU 4× mais lenta (Chrome), a abertura do jogo fica em 60fps (p95 17ms, sem tarefas longas): o JavaScript não pesa. O que esse teste não mede é a pintura dos filtros de desfoque do SVG; o único contínuo (19 anéis pulsando com desfoque) foi tirado. Falta conferir num Android barato de verdade.

### 8.3 Processo

10. **Dois ambientes na mesma máquina.** Outra sessão (worktree `elm`) roda servidores de desenvolvimento e escreve em `/tmp`; screenshots devem sempre identificar o servidor pelo diretório (`lsof -p <pid>`, cwd) e usar pastas temporárias com nome aleatório.
