# Banner de fim de jogo — design curto

Data: 2026-11-21 · Tamanho: mudança pequena · Status: para aprovação

**Por quê.** O fim dispara quando o último token sai do saco ou a última
carta sai do baralho, mas a tela não diz nada. No caso do Cristal com 2 tokens
no saco, o jogo acaba, os 6 extras entram pra fechar a compra, e ninguém fica
sabendo. O tutorial (lição 2.13) também depende disso.

**Objetivo.** No momento do gatilho, os dois jogadores veem um banner
"Final turn!" com a causa, e o saco e/ou o baralho ficam marcados com um X até
o fim da partida.

**Não-objetivos.** Animação dos 6 extras caindo no saco. Mudanças no motor.

## Abordagens

1. **Escolhida.** Um terceiro tipo de banner na camada do "Your Turn",
   aparecendo no ponto da fila de animações onde o gatilho acontece.
2. Um momento novo dentro da fila de apresentação (`script`): tempo exato,
   mas mexe na camada de apresentação e nos testes dela. Grande demais pra
   isso.
3. Só um selo discreto no saco: barato, mas passa despercebido.

## Design

- **O que dispara.** `view.endTriggered` passa de `false` pra `true` numa
  atualização da view. Montar a tela já com `true` (recarregar a página,
  entrar numa sala) não mostra banner, só os X.
- **Causa.** Saco, se `view.extrasAdded` ou `view.bag.length === 0`; senão,
  baralho (`deckCount === 0`).
- **Quando aparece** (é o gatilho, não o fim da animação):
  - Saco: logo **antes do primeiro `draw`** do lote que disparou. No Cristal:
    a peça é colocada, o fire up acontece, o banner aparece, e só então os
    três tokens saem do saco. Num turno que começa sacando o último token: o
    banner do turno, depois este, depois a compra.
  - Baralho: logo **depois do `endTurn`** que reabasteceu a mão, antes do
    banner do turno seguinte.
  - As compras/o banner do turno esperam ele sair, como já esperam o banner
    de turno (`gate`).
  - Para os dois lados igual: cada tela segue a própria fila, então o
    oponente (máquina ou online) vê no mesmo ponto da jogada.
- **Visual.** Mesmo formato do banner de turno (faixa, raios, toque pra
  dispensar, `BANNER_HOLD`), cor laranja-brasa (`--ember-500`/`--ember-300`).
  Texto: **"Final turn!"**, com a linha menor "The bag is empty" ou "The deck
  is empty". Com `prefers-reduced-motion`, sem raios, só fade.
- **Marca.** Um X por cima do saco quando a causa saco ocorreu (fica mesmo
  depois que os extras entram e o contador volta a subir); um X sobre o
  contador do baralho quando `deckCount === 0`. Ficam até a tela de fim.
- **Leitor de tela.** O banner é decorativo como o de turno; o anúncio vai
  pela linha `aria-live` ("Final turn: the bag is empty"). O rótulo do saco
  ganha "empty, the game ends this turn".
- **Testes.** Hook do banner: dispara na transição, não no mount; causa
  certa; espera o gate. Tela: X aparece no saco/baralho certo.

## Fica com quem implementar

- Como o hook enxerga "antes do primeiro draw do lote" a partir de
  `presentation.remaining` (o gate da fila já existe, linha `gate:` em
  `GameScreen.tsx`).
- O desenho exato do X sobre a arte do saco.
