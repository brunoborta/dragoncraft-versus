# Dragoncraft Versus v3 — F1 · Prompts da arte

Complementa a seção 6.1/6.2 de `2026-11-07-dragoncraft-versus-v3-visual.md`. O Bruno gera; eu recorto, comprimo para WebP e integro.

## Como usar

1. **Cole o bloco de estilo antes de cada prompt.** É o que faz os assets parecerem da mesma mão.
2. **Gere 3–4 variações** de cada e escolha a que mais conversa com as outras. Prefira gerar fundo e avatares na mesma sessão.
3. **Entregue em PNG, na maior resolução que a ferramenta der**, sem recortar nem comprimir. Redimensionar, recortar e comprimir é comigo.
4. **Salve em `designs/art/`** com os nomes da tabela. Variações extras: `bg-game-2.png`, etc.
5. Se a ferramenta não aceitar proporção 9:19.5, use **9:16** — eu estendo o topo e a base.
6. Fundo transparente: quase nenhum gerador entrega alfa de verdade. Os prompts pedem **fundo liso** e eu recorto.

### Mudanças em relação aos prompts da seção 6.2

- **Tirei "in the style of Hearthstone".** Alguns geradores recusam nome de jogo, e outros copiam o jogo em vez de só o estilo. O estilo agora vem descrito em palavras.
- **Os dois avatares olham para a direita.** No layout D, a placa do oponente (em cima) e a sua barra (embaixo) têm o avatar à esquerda, então os dois olham para o centro da tela. A seção 6.2 punha o oponente olhando para a esquerda, que ali olharia para fora da tela.
- **Bolsa sem sombra projetada.** A sombra atrapalha o recorte; eu faço em CSS, e ela precisa se mexer quando a bolsa sacode (M2).
- **Fundo:** agora diz exatamente o que fica coberto pela interface (seção 3.3), para os detalhes irem para onde aparecem.
- **Entrou a folhagem de canto** (opcional na 6.1, sem prompt até agora).

---

## Bloco de estilo (sempre antes do prompt)

> Style: hand-painted stylized fantasy illustration for a cozy mobile board game, soft painterly brushwork with clean readable shapes, botanical alchemy greenhouse theme, warm golden afternoon sunlight, palette of emerald green, deep forest green, polished brass and warm cream, gentle glow, rich but not noisy detail. No text, no letters, no numbers, no logos, no watermark, no user interface, no buttons, no frames, no game board, no game pieces, no cards.

---

## Os assets

| # | Arquivo | Prioridade | Saída pedida |
|---|---|---|---|
| 1 | `bg-game.png` | **alta** — é o "uau" da tela | Retrato 9:19.5 (ou 9:16), ≥1080×2340 |
| 2 | `bag.png` | **alta** — sem ela não há M2 | Quadrado, ≥1024 |
| 3 | `avatar-you.png` | média | Quadrado, ≥1024 |
| 4 | `avatar-opponent.png` | média | Quadrado, ≥1024 |
| 5 | `tex-stone.png` | média — hoje as casas são gradiente | Quadrado, ≥1024, *tileable* |
| 6 | `tex-parchment.png` | **alta** para F3 — as cartas | Quadrado, ≥1024, *tileable* |
| 7 | `foliage-corner.png` | baixa, opcional | Quadrado, ≥1024 |

Não precisam de prompt: **fundo do overlay** (eu desfoco o 1), **molduras douradas, peças, ícones, tabuleiro, botões e partículas** (SVG/CSS, comigo).

### 1 · Fundo do jogo — `bg-game.png`

> Vertical portrait composition, aspect ratio 9:19.5. Interior of a Victorian glass greenhouse used as an alchemist's garden, seen from a low, centered viewpoint. Top 20%: tall arched iron-framed windows with soft sunlight streaming in, light rays and floating dust motes. Left and right edges, full height: lush hanging vines, ferns, broad leaves and small pink and violet flowers, framing the scene like curtains. Upper left: a brass lantern with a warm glow hanging from a chain. Lower left edge: wooden shelves with glass bell jars holding glowing blue crystals and small potion bottles. Right edge, middle height: a brass armillary sphere and a potted plant. The central column, from 20% to 95% of the height and the middle 70% of the width, is calm and uncluttered: a softly blurred, slightly darker stone floor fading into a dark polished wooden tabletop in the bottom third, with no objects on it. Depth of field: the edges are detailed, the center is soft and out of focus. Even, gentle contrast; nothing bright in the center.

**Por quê:** o tabuleiro fica entre ~20% e 55% da altura, e a mão, o painel e a sua barra cobrem a metade de baixo. Detalhe no centro brigaria com as peças; nas bordas é o que aparece.

### 2 · Bolsa de veludo — `bag.png`

> A single drawstring pouch of deep emerald green velvet, plump and full, sitting upright, mouth gathered and closed, tied at the neck with a thick twisted golden rope ending in two golden tassels. A golden embroidered leaf-and-vine motif on the front. Soft velvet sheen with highlights on the folds. Front view, slightly from above, centered, filling about 80% of the frame. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

### 3 · Avatar seu — `avatar-you.png`

> Portrait bust of a noble young dragon, emerald green scales with golden accents on the horns, brow and neck frills, elegant curled horns, amber eyes, calm and confident expression. Three-quarter view facing right. Head and upper neck only, centered, filling the frame so it can be cropped to a circle, with a little margin around the horns. Plain dark forest-green background with a soft warm rim light from the upper left.

### 4 · Avatar oponente — `avatar-opponent.png`

> Portrait bust of a cunning young dragon, deep crimson scales with ember-orange accents on the horns, brow and neck frills, swept-back horns, glowing golden eyes, mischievous confident smirk. Three-quarter view facing right. Head and upper neck only, centered, filling the frame so it can be cropped to a circle, with a little margin around the horns. Plain dark wine-red background with a soft warm rim light from the upper left.

**Dica:** gere os dois avatares na mesma sessão, ou use o seu como imagem de referência para o do oponente, para manter o mesmo traço e enquadramento.

### 5 · Pedra das casas — `tex-stone.png`

> Seamless tileable texture, flat top-down view, of pale warm sandstone with fine hairline cracks, subtle mineral speckles and a little soft green moss in some crevices. Light cream and beige tones, low contrast. Flat even lighting, no shadows, no perspective, no edges, no border, no large features that would repeat visibly.

### 6 · Pergaminho — `tex-parchment.png`

> Seamless tileable texture, flat top-down view, of warm cream parchment paper with subtle fibers, faint mottled tea-colored stains and very soft grain. Low contrast, light and even, suitable as a background behind dark text. Flat even lighting, no shadows, no folds, no edges, no border, no writing.

**Nas duas texturas:** se a ferramenta não fizer emenda perfeita, sem problema — eu corrijo a costura.

### 7 · Folhagem de canto (opcional) — `foliage-corner.png`

> A cluster of botanical greenery growing in from the top-left corner of the frame: overlapping ferns, ivy and broad leaves in emerald and olive green, a few small pink and violet flowers, two thin golden vine tendrils curling outward. The cluster fills the top-left corner and thins out toward the center, leaving the bottom-right two thirds of the image empty. Isolated on a plain flat solid white background, no shadow.

---

## Depois de entregar

Eu faço: recorte (bolsa, folhagem), máscara circular (avatares), emenda (texturas), versão desfocada do fundo, WebP em @1x/@2x, e confiro o peso total contra o limite de 1.5 MB (F11).

---

## Segunda rodada (F13) — 2026-11-10

Mesmo bloco de estilo de antes, mesmas regras de entrega (PNG grande, fundo liso, sem recortar). Salve em `designs/art/`.

### 8 · Bolsa aberta — `bag-open.png` ~~(prioridade alta)~~ — **descartada em 2026-11-11**

Foi gerada, integrada e tirada: na tela, trocar a bolsa no meio da compra não acrescentou nada. O jogo voltou a usar só a bolsa fechada (que continua sacudindo e brilhando). O PNG, o WebP e o código da troca saíram; o prompt fica aqui como registro.

> The same drawstring pouch of deep emerald green velvet with the golden rope and golden leaf-and-vine embroidery, now with its mouth pulled open and the rope loosened. Warm golden light spills up out of the opening, with a few small floating sparkles above it. Front view, slightly from above so the opening is visible, centered, filling about 80% of the frame, the same size and angle as the closed pouch. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

**Dica:** use a bolsa fechada escolhida (`bag.png`) como imagem de referência, para sair a mesma bolsa.

### 9 · Ícones das peças ~~(opcional)~~ — **entregues e no jogo**

Os seis ícones ficam **brancos sobre a cor da peça**, então o que importa é a silhueta. Gere os seis na mesma imagem para saírem do mesmo traço; eu recorto e vetorizo.

> A sheet of six simple flat icons in a 3 by 2 grid, each a single solid white silhouette with no outline, no shading and no texture, on a plain flat solid black background, evenly spaced with generous margins: a cluster of three crystal shards; a rounded loaf of bread with three score marks; a meat drumstick with its bone; a trapezoid metal ingot; a round-bottomed potion flask with a cork; a sprout with two leaves. Bold, chunky shapes that stay recognizable at 24 pixels, all with the same visual weight. No text, no letters, no numbers.

Salvar como `icons-tokens.png`. Os seis saíram vetorizados para `apps/web/src/art/icon-paths.ts` por `apps/web/scripts/icons.mjs`.

### 10 · Ícones da interface ~~(opcional)~~ — **entregues e no jogo**

> A sheet of eight simple flat icons in a 4 by 2 grid, each a single solid warm-gold silhouette (#f3dfa2) with no outline and no shading, on a plain flat solid black background, evenly spaced with generous margins: two playing cards fanned with a small star on the front one; a five-pointed star; a scroll with three lines of writing; a curved arrow turning back (undo); two right-pointing chevrons (end turn); a closed padlock; a flame; an hourglass; plus, if space allows, an open eye and a gear. Bold, chunky shapes that stay recognizable at 20 pixels, the same visual weight. No text, no letters, no numbers.

Salvar como `icons-ui.png`. Os dez saíram vetorizados pelo mesmo script; só o `?` continua desenhado à mão (não estava na folha).

---

## Terceira rodada — emblemas do fim de jogo — 2026-11-11 — **entregues e no jogo**

O emblema que cai no topo da tela final. Um por resultado, e **cada um com um símbolo diferente**, para o resultado se ler antes do título ("You win" / "You lose" / "Shared victory"). Mesmo bloco de estilo, mesmas regras de entrega (PNG quadrado ≥1024, fundo liso, sem recortar). Salve em `designs/art/` e rode `node apps/web/scripts/art.mjs crests`.

Já está ligado no código: cada arquivo que existir substitui a coroa desenhada daquele resultado; os que faltarem continuam desenhados (estrela dourada / estrela meio prata, meio ouro / estrela rachada). Aparece a ~150×150 px num celular, então o símbolo tem que ser legível pequeno: uma forma forte no centro, pouco detalhe miúdo.

**Dica:** gere os três na mesma sessão, usando o primeiro escolhido como referência para os outros dois, para saírem com a mesma moldura e o mesmo tamanho.

### 11 · Vitória — `crest-win.png`

> A single victory emblem: a radiant polished-gold five-pointed star, slightly domed with a soft inner glow, set at the top of a lush wreath of bright emerald-green laurel leaves tied at the bottom with a small golden ribbon. Warm golden light radiates softly from the star. Triumphant, bright and celebratory. Front view, perfectly centered and symmetrical, filling about 80% of the frame. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

### 12 · Empate — `crest-draw.png`

> A single emblem for a tied game: a small polished brass balance scale with two identical round pans hanging perfectly level, set at the top of a laurel wreath whose left half is emerald-green leaves and whose right half is gold leaves, the two halves meeting evenly at the bottom under a small ribbon that is half green, half gold. Calm, even, balanced mood with a soft neutral glow, neither triumphant nor sad. Front view, perfectly centered and symmetrical, filling about 80% of the frame. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

### 13 · Derrota — `crest-lose.png`

> A single defeat emblem: a dull, tarnished bronze five-pointed star with a visible crack running through it and one small chipped point, no glow, set at the top of a drooping wreath of wilted laurel leaves in muted dusty wine-red and brown, a few leaves curled. Subdued, gentle and a little melancholic, but still handsome and well crafted, not grim or broken apart. Front view, perfectly centered and symmetrical, filling about 80% of the frame. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

**Fundo:** o recorte tira todo cinza-claro neutro, inclusive o que aparece por dentro da coroa. Por isso nenhum dos três usa prata, branco ou cinza no emblema — o empate é verde e ouro, não prata e ouro.

### O que o recorte aprendeu com estes três (2026-11-11)

O brilho da estrela da vitória obrigou duas mudanças em `cutOut`, as duas valendo para qualquer arte nova:

- **`glow`**: a luz que se dissolve no fundo agora some junto com ele, em vez de terminar na linha onde o preenchimento parou — um pixel é tão opaco quanto a sua cor está longe da cor do fundo. Só na faixa perto da borda: no meio do desenho, um branco quente é tinta, não luz derramada no fundo.
- **Buraco claro ≠ buraco de fundo**: um vão fechado só é recortado se não for mais claro que o fundo. O núcleo branco da estrela é cinza-neutro como o fundo, mas é mais claro — e é tinta. Sem isso ficava um furo escuro no meio da estrela.

As três saem com 30–42 KB cada, dentro do orçamento de 1.5 MB (F11).

## Quarta rodada — a bandeja do token — 2026-11-11

A peça onde o token sorteado espera até ser colocado: a sua, centrada embaixo do tabuleiro, e a do oponente, no canto de cima à esquerda. Hoje é uma elipse desenhada em CSS. As duas têm **o mesmo tamanho e a mesma forma**; só a cor diz de quem é — verde você, vinho o oponente (a regra de cor da seção 3.1 do plano).

**Da mesma família que a bolsa e a moeda:** veludo esmeralda com bordado e cordão de ouro (a bolsa), ouro martelado com folhas em relevo (a moeda). A bandeja é uma almofada de veludo assentada num aro de ouro — o lugar onde se pousa uma peça preciosa. O topo da almofada fica liso, porque o token fica em pé ali e nada pode brigar com ele. Aparece a ~80 px de largura num celular: vale a silhueta, o aro e o cordão, não o bordado miúdo.

Mesmo bloco de estilo, mesmas regras de entrega (PNG ≥1024 de largura, fundo liso, sem recortar). Salve em `designs/art/`. Ainda não está ligado no código: quando os arquivos chegarem, eu recorto, comprimo e troco a elipse pelas imagens.

**Dica:** gere a sua com `bag.png` e `coin.png` como imagens de referência. Depois use a bandeja escolhida como referência para a do oponente, para sair com a mesma forma, o mesmo ângulo e o mesmo tamanho no quadro.

### 14 · Bandeja sua — `tray-you.png`

> A single small round cushion of deep emerald green velvet, plump and soft with a gentle dip in the middle, resting inside a low, wide ring of hammered polished gold. The gold ring has a raised relief of small gold leaves running around it, in the same style as an embossed gold coin, and a thick twisted golden rope is laid along the seam where the velvet meets the gold. The top of the cushion is smooth and plain, with no embroidery and nothing resting on it, a soft velvet sheen catching warm light. Seen from slightly above at about 25 degrees, so the whole piece reads as a wide oval roughly three times wider than it is tall. Rich, tactile, precious, like a jeweller's cushion for a single treasured game piece. Front view, perfectly centered and symmetrical, filling about 85% of the frame's width. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

### 15 · Bandeja do oponente — `tray-opponent.png`

> The same small round cushion in the same low hammered-gold ring, same shape, same angle and same size in the frame, but the velvet is a deep wine-red crimson instead of green. The same raised gold leaves around the ring, the same thick twisted golden rope along the seam, the same smooth, plain top with nothing resting on it and a soft velvet sheen catching warm light. Seen from slightly above at about 25 degrees, a wide oval roughly three times wider than it is tall. Front view, perfectly centered and symmetrical, filling about 85% of the frame's width. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

**Fundo:** pelo que o recorte aprendeu na terceira rodada, nada de prata, branco ou cinza na bandeja — o recorte levaria junto. Ouro e veludo colorido saem limpos.
