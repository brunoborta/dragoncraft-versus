# Dragoncraft Versus — Design

Data: 2026-09-25
Status: aprovado, aguardando plano de implementação

## 1. Contexto e objetivo

Jogo de tabuleiro digital, jogável no navegador, com as mesmas regras do
Flamecraft Duals (Cardboard Alchemy) e com nome, identidade visual e textos
próprios. Regras de jogo não são protegidas por direito autoral; nome, arte e
textos são, e nenhum deles é reaproveitado aqui.

**Objetivo declarado:** jogar de verdade com amigos. Isso significa que o
multiplayer online é requisito, não enfeite, e que o jogo precisa estar
hospedado e ser confiável. Não é portfólio nem exercício.

**Fonte das regras:** `FlamecraftDuals_Rulebook.pdf` na raiz do projeto
(16 páginas). Geometria do tabuleiro extraída das ilustrações do próprio PDF;
composição do deck derivada analiticamente e confirmada pelo dono do jogo
físico.

## 2. Escopo

### v1 — humano contra a máquina
- Modo padrão de 2 jogadores, completo.
- Oponente de máquina em níveis de dificuldade (fácil e médio).
- Interface mobile-first.
- Visual minimalista e assumidamente provisório: cor + símbolo por tipo.

### v2 — online
- Sala por link, sem cadastro.
- Servidor autoritativo.

### Fora de escopo (sem data)
- Fancy Mode (8 fancies, várias alterando regras globais).
- The Fountain (miniatura bloqueadora + 6 fountain cards de 4 ícones).
- Solo Mode.
- Token Buddy.
- Partidas assíncronas e persistência de partida.
- Contas, lobby, ranking, histórico.
- Identidade visual definitiva, animações, som, tutorial.

O motor deve ser desenhado de forma que esses modos caibam depois sem
reescrita, mas nada deles é construído agora.

O plano de implementação derivado desta spec cobre **apenas a v1**. A v2 está
documentada aqui para garantir que o desenho da v1 a comporte, e ganha seu
próprio plano quando chegar a hora.

## 3. Decisões de arquitetura

Abordagem escolhida: **motor puro com transporte plugável**. As regras vivem
num módulo puro de TypeScript que roda igual no navegador e no Node. A UI
conversa com ele através de uma interface de sessão; na v1 a implementação
dessa interface é local, na v2 entra uma implementação remota. O online não é
uma reescrita: é uma segunda implementação da mesma porta.

### As cinco regras inegociáveis

1. **Nenhum `Math.random()` no motor.** Todo aleatório vem de um gerador com
   seed que vive dentro do estado. Sem isso a IA não simula, cliente e servidor
   divergem, e bug não se reproduz.
2. **Estado imutável.** `applyAction` devolve estado novo, nunca muta o que
   recebeu. É o que permite a IA explorar sem sujar o jogo real, e o que dá
   desfazer e replay.
3. **Duas visões de estado desde o primeiro commit.** O estado completo e a
   visão filtrada por jogador. A UI e a IA consomem **apenas** a visão filtrada,
   mesmo na v1 em que tudo roda no mesmo processo.
4. **O motor não conhece React, DOM nem browser.** Verificável por build: o
   pacote `engine` não declara React como dependência.
5. **Jogada é dado, não callback.** Toda ação é um objeto serializável.

## 4. Estrutura do repositório

npm workspaces, três pacotes. A separação torna a regra 4 mecânica em vez de
aspiracional.

```
dragoncraft-versus/
├── packages/
│   ├── engine/     regras puras, tipos, dados dos cards. Zero dependências.
│   └── ai/         estratégias por dificuldade. Depende só de engine.
└── apps/
    └── web/        Vite + React + TS. Depende de engine e ai.
```

Ferramental: TypeScript strict, Vite, Vitest (mesmo runner nos três pacotes),
npm como gerenciador.

Deliberadamente ausentes: state manager (o estado do jogo é o objeto do motor;
`useReducer` chamando `applyAction` é a arquitetura inteira) e biblioteca de
componentes (o jogo é um tabuleiro hexagonal em SVG).

## 5. Regras do jogo (modo padrão 2P)

Resumo normativo do que o motor precisa implementar.

### Componentes
- 36 tokens de dragão artesão: 6 tipos × 6 cópias.
  Tipos: `bread`, `crystal`, `meat`, `iron`, `potion`, `plant`.
- 6 tokens duais, cada um com 2 tipos distintos. **Quais 6 das 15 combinações
  possíveis existem ainda não foi determinado** — ver seção 13.
- 42 shop cards.
- 6 moedas (3 por jogador).

### Preparação
1. Cada jogador recebe 3 moedas.
2. Embaralhar o deck; cada jogador compra 2 cards para a mão (secreta).
3. Retirar 6 tokens artesãos, um de cada tipo, e distribuí-los aleatoriamente
   nas 6 casas do anel interno.
4. Retirar outros 6 artesãos, um de cada tipo, e reservá-los fora do saco
   (tokens extras, usados só no fim de jogo).
5. O saco fica com 24 artesãos + 6 duais = 30 tokens.
6. Primeiro jogador: determinado pela Fire Up Chart. Na v1, sorteio simples
   com a seed.

### Turno
Três fases em ordem: PLAY, SCORE, REFRESH. A qualquer momento antes do
REFRESH, e no máximo uma vez por turno, o jogador pode GASTAR UMA MOEDA.

**PLAY**
1. Puxar um token do saco, sem olhar (automático).
2. Colocá-lo em qualquer casa vazia, ou no topo de uma pilha existente.
   Nenhuma pilha pode passar de 3 tokens, nunca, nem como resultado de
   movimentação.
3. Opcionalmente ATIVAR o token recém-colocado. Num token dual, escolhe-se
   uma das duas habilidades — nunca as duas.

**SCORE**
Única fase em que se pontua. Comparar o tabuleiro com os padrões dos cards na
mão; o card pode ser rotacionado em qualquer orientação. Casando, o card pode
ser pontuado e vai para a pilha de pontuados. Pode-se pontuar mais de um card
por turno, e pontuar é sempre opcional.

**REFRESH**
Comprar até ter 2 cards na mão. Passa a vez.

**GASTAR UMA MOEDA**
Descartar a moeda, comprar 2 shop cards, depois escolher 2 cards quaisquer da
mão e colocá-los no fundo do deck. Moedas não gastas valem 1 de reputação cada
no fim.

### Habilidades
- **bread** — Puxar um novo token do saco e colocá-lo em qualquer casa
  permitida. Esse token pode então ser ativado (recursivo).
- **crystal** — Puxar 3 tokens do saco, colocar 1 numa casa permitida e
  devolver os outros 2 ao saco. O token colocado **não** é ativado.
- **meat** — Escolher 1 token adjacente ao meat e movê-lo para qualquer outra
  casa permitida, inclusive para cima do próprio meat.
- **iron** — Escolher 1 ou 2 tokens distintos adjacentes ao iron e mover cada
  um 1 casa em qualquer direção, inclusive para cima do próprio iron. Os dois
  podem estar na mesma pilha: move-se primeiro o do topo, depois o que foi
  revelado.
- **potion** — Trocar de posição 2 tokens quaisquer do tabuleiro, inclusive o
  próprio potion.
- **plant** — Escolher 1 token adjacente ao plant e usar a habilidade dele. Um
  plant pode ativar outro plant, e assim por diante (recursivo).

Habilidades afetam apenas o token que está no **topo** de uma pilha, e o topo
pode mudar durante o turno.

### Fim de jogo
Dispara ao puxar o último token do saco **ou** ao comprar a última carta do
deck. O turno em curso é concluído por inteiro. Se o saco esvaziar e ainda for
preciso puxar tokens, os 6 extras entram no saco — e o gatilho vale mesmo que
o saco volte a ter tokens.

Depois do turno final, o oponente tem uma fase especial: pode SCORE e pode
GASTAR UMA MOEDA, mais nada.

**Pontuação final:** soma da reputação dos cards pontuados, mais 1 por moeda
não gasta. Empate desempata por número de cards pontuados; persistindo o
empate, vitória compartilhada.

## 6. Modelo de domínio

### Tabuleiro
Coordenadas axiais `(q, r)`. O tabuleiro é o conjunto de casas onde
`max(|q|, |r|, |q+r|) <= 2`: 1 centro + anel interno de 6 + anel externo de 12
= **19 casas**. As 6 casas iniciais são exatamente os vizinhos do centro.
Adjacência é soma de vetores; não existe caso especial de borda.

### Tokens e pilhas
Um token é de tipo único ou dual (dois tipos distintos). Cada casa guarda uma
pilha representada de baixo para cima, com no máximo 3 tokens. **Apenas o topo
conta**, tanto para habilidade quanto para pontuação: uma pilha de 3 expõe
somente o dragão de cima.

### Deck — derivado, não transcrito
Todos os shop cards têm exatamente 3 ícones. Existem três famílias:

| Família | Forma | Contagem | Reputação |
|---|---|---|---|
| 3 iguais em linha | linha reta de 3 | 6 (um por tipo) | 3 |
| 3 iguais em triângulo | 3 mutuamente adjacentes | 6 (um por tipo) | 3 |
| 2 iguais + 1 diferente, em linha | linha reta de 3 | 30 (6 × 5) | 2 |

Total: **42 cards**, somando **96** de reputação.

Não existe padrão `T1 T2 T1`: o ícone diferente fica sempre numa ponta. Como
consequência, `T1 T1 T2` e `T2 T1 T1` são o mesmo card girado 180 graus, e
não existem triângulos mistos. Os padrões são gerados em código, não
transcritos à mão.

**Reflexão nunca importa nesta fase:** linha refletida é linha rotacionada, e
o triângulo de 3 iguais é simétrico. O matcher só precisa das 6 rotações.

### Matcher
Para cada uma das 6 rotações do padrão, ancorando em cada uma das 19 casas,
verificar se todas as posições caem no tabuleiro com o topo do tipo exigido.
Um token dual casa se qualquer um dos seus 2 tipos bater; como cada posição é
verificada independentemente, o coringa não cria acoplamento entre posições.
Cerca de 340 verificações por card — instantâneo, inclusive dentro de
simulações.

O mesmo matcher, com uma posição em branco, responde "se eu colocar um token
aqui, o que eu completo?". Essa única função serve três consumidores: a
pontuação, o destaque visual da UI e a função de avaliação da IA.

## 7. Estado e visão filtrada

O estado completo contém: gerador com seed, tabuleiro, saco, tokens extras,
deck ordenado, estado dos dois jogadores (mão, pontuados, moedas, se já gastou
moeda no turno), jogador da vez, fase, pilha de pendências e se o fim já
disparou.

A visão de um jogador oculta: a **mão do oponente** (só a contagem) e a **ordem
do deck** (só a contagem). A **composição do saco** é exposta — ela é dedutível
contando os tokens visíveis no tabuleiro, então esconder seria falsa segurança,
e a IA pode usá-la sem trapacear.

## 8. Motor de turno

Um turno não é uma ação atômica: é uma sequência de escolhas pequenas, e as
habilidades se encadeiam de forma genuinamente recursiva (plant ativando plant,
bread colocando outro bread).

Solução: **pilha de pendências** no estado. `state.pending` é uma pilha de
decisões em aberto. `legalActions(state)` olha somente o topo da pilha e
enumera o que é legal agora. `applyAction(state, action)` desempilha uma
pendência e pode empilhar outras.

```
[escolherCasa(token)] -> jogador coloca
[podeAtivar(casa)]    -> jogador ativa um plant
[escolherAlvoPlant]   -> jogador aponta o vizinho
[efeito(iron)]        -> empilhado pelo plant; jogador move 2 tokens
```

Plant encadeado e bread recursivo não precisam de código especial: são a mesma
pendência empilhada de novo.

**Resolvido automaticamente dentro de `applyAction`, sem virar decisão:** puxar
token do saco, comprar carta no REFRESH, e a entrada dos 6 tokens extras quando
o saco esvazia no meio de uma habilidade. O motor sempre avança até o próximo
ponto onde existe escolha real.

**Gastar moeda** é uma ação ortogonal à pilha, legal a qualquer momento antes
do REFRESH, uma vez por turno; a escolha dos 2 cards a devolver empilha uma
pendência própria.

**Validação:** `applyAction` rejeita ação ilegal. Na v1 é rede de segurança que
nunca deveria disparar, porque a UI só oferece o que `legalActions` retornou.
Na v2 é a defesa do servidor contra cliente adulterado. Mesmo código, dois
papéis.

## 9. Interface

Mobile-first, retrato, três faixas: oponente e log no topo, tabuleiro ocupando
o máximo no meio, mão e moedas na base. Tabuleiro em SVG com `viewBox` fixo —
escala de um celular pequeno a um desktop sem cálculo de pixel.

**Pilhas:** token do topo desenhado normalmente, com indicador discreto de
profundidade na borda. Nada de perspectiva 3D, que come espaço e não é legível
em 40 pixels. Tocar numa pilha abre ela.

**Destaque de padrão (recurso central):** com um token na mão, cada casa legal
mostra se aquela colocação completa um card do jogador. Casar padrão
rotacionado de cabeça, em tela pequena, é cansativo; o matcher já faz essa
conta.

**Toque em dois tempos:** primeiro toque mostra o preview (token translúcido e
o que completaria), segundo confirma. Reavaliar depois de jogar de verdade.

**Score explícito:** cards pontuáveis ficam realçados, mas nada pontua sozinho.
Segurar um card pontuável é jogada válida.

**Log de jogadas:** necessário para entender o que a máquina fez, especialmente
quando ela encadeia plant.

**Desfazer na v1:** como o estado é imutável, guardar o histórico dá desfazer
sem esforço. Vale contra a máquina; não existe no online.

**Acessibilidade:** cada tipo é cor **e** símbolo, nunca só cor.

## 10. Máquina

Interface única: `chooseAction(view, legalActions) -> Action`. O primeiro
parâmetro é a **visão filtrada** — a máquina não sabe a mão do oponente nem a
ordem do deck, e isso é garantido pelo tipo da função, não por disciplina.

- **Fácil** — escolha aleatória entre as jogadas legais, com um único viés:
  sempre pontua quando pode.
- **Médio** — guloso de um lance, avaliando reputação fechada agora mais
  progresso (quantos cards ficaram a uma casa de fechar, via matcher com
  posição em branco).
- **Difícil** (pós-v1) — determinização e simulação: sorteia mão plausível do
  oponente e saco plausível, joga centenas de partidas até o fim, escolhe a
  melhor média. Roda em Web Worker; travar a tela do celular é inaceitável.

**Limitação conhecida e aceita:** como o turno é uma sequência de escolhas, o
médio decide onde colocar sem considerar o que fará na ativação seguinte, e
fica míope. É parte do que o torna médio. O difícil resolve, porque simula até
o fim do turno.

v1 entrega fácil e médio. Difícil é mais uma implementação da mesma interface.

## 11. Online (v2)

Um processo Node servindo o site estático e um WebSocket. Um deploy, sem CORS.
O servidor importa `packages/engine` inalterado: recebe a ação, valida com
`legalActions`, aplica com `applyAction` e envia a cada jogador a sua visão
filtrada.

**Sala por link:** o servidor gera id e seed; o link é compartilhado; o amigo
senta na cadeira 2. Sem cadastro. Cada jogador recebe um token aleatório
guardado em `localStorage` e amarrado à cadeira, o que permite reconectar como
si mesmo e impede que um terceiro que receba o link encaminhado tome o lugar.

**Reconexão é requisito.** Mobile-first significa tela apagando, navegador em
segundo plano e wifi caindo. O cliente volta para a sala e ressincroniza
recebendo a visão inteira.

**Sem persistência na v2:** a sala vive na memória do servidor. Se ele
reiniciar, a partida acaba. Partida assíncrona foi explicitamente descartada.

## 12. Testes e critério de pronto

O grosso dos testes fica no `engine`, onde é barato e onde estão os bugs de
verdade:

- Cada habilidade isolada.
- Plant encadeado; bread recursivo.
- Iron movendo dois tokens da mesma pilha, na ordem topo-depois-revelado.
- Saco esvaziando no meio de um crystal, com entrada dos 6 tokens extras.
- Os dois gatilhos de fim de jogo e a fase final do oponente.
- Limite de 3 na pilha respeitado inclusive em movimentações.

Três testes que valem mais que o resto somados:

1. **Deck gerado:** 42 padrões distintos somando 96 de reputação.
2. **Determinismo:** mesma seed e mesma sequência de ações produzem estado
   idêntico. É o teste que protege o online inteiro.
3. **Autojogo:** 100 partidas fácil contra médio, sem interface, afirmando que
   nenhuma ação ilegal ocorreu, nada estourou e toda partida terminou.

Na UI, o mínimo: ela é fina de propósito para que testá-la renda pouco.

**Critério de pronto da v1:** a suíte passa **e** uma partida inteira é jogada
contra o médio, num celular, do primeiro token até a contagem final.

## 13. Riscos e questões em aberto

- **Composição dos tokens duais (bloqueia a preparação da partida).** Existem
  6 tokens duais entre 15 pares possíveis de tipos, e quais 6 são não está no
  rulebook nem foi derivado. Sem isso o saco não pode ser montado. É uma
  consulta de trinta segundos aos tokens do jogo físico. Enquanto não houver
  resposta, o motor usa uma lista provisória isolada num único ponto do código,
  trocável sem tocar em mais nada.
- **Primeiro jogador.** O rulebook usa a Fire Up Chart (ordem de precedência
  dos tipos) para desempatar o sorteio. A ordem exata da chart não foi lida do
  PDF. Na v1 o primeiro jogador é sorteado pela seed, o que é justo e
  suficiente; a chart fica pendente caso vire relevante.
- **Balanceamento não verificado.** A derivação do deck (42 cards, 96 de
  reputação) bate com a contagem de componentes e foi confirmada pelo dono do
  jogo físico, mas nenhuma partida foi jogada contra a caixa para conferir.
  Primeira partida completa serve de verificação.
- **Qualidade do médio.** A miopia descrita na seção 10 pode deixá-lo fraco
  demais para ser divertido. Descobre-se jogando; o remédio é a estratégia
  difícil, já prevista na mesma interface.
- **Custo do difícil no celular.** Determinização e simulação em Web Worker num
  aparelho modesto pode não caber no orçamento de tempo desejável por jogada.
  Não bloqueia a v1.
- **Visual provisório.** A identidade minimalista foi escolhida explicitamente
  como "só para ter algo agora". Substituí-la depois é trabalho de UI, não de
  arquitetura.
