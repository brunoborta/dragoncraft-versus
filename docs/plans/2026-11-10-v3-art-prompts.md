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

### 8 · Bolsa aberta — `bag-open.png` (prioridade alta)

Entra no lugar da bolsa fechada enquanto a peça sai (M2). Já está ligada no código: basta salvar o arquivo e eu rodo o script; sem ele, o jogo usa a fechada.

> The same drawstring pouch of deep emerald green velvet with the golden rope and golden leaf-and-vine embroidery, now with its mouth pulled open and the rope loosened. Warm golden light spills up out of the opening, with a few small floating sparkles above it. Front view, slightly from above so the opening is visible, centered, filling about 80% of the frame, the same size and angle as the closed pouch. Isolated on a plain flat solid light grey background, no cast shadow, no floor, no other objects.

**Dica:** use a bolsa fechada escolhida (`bag.png`) como imagem de referência, para sair a mesma bolsa.

### 9 · Ícones das peças (opcional, só se os desenhados não servirem)

Os seis ícones ficam **brancos sobre a cor da peça**, então o que importa é a silhueta. Gere os seis na mesma imagem para saírem do mesmo traço; eu recorto e vetorizo.

> A sheet of six simple flat icons in a 3 by 2 grid, each a single solid white silhouette with no outline, no shading and no texture, on a plain flat solid black background, evenly spaced with generous margins: a cluster of three crystal shards; a rounded loaf of bread with three score marks; a meat drumstick with its bone; a trapezoid metal ingot; a round-bottomed potion flask with a cork; a sprout with two leaves. Bold, chunky shapes that stay recognizable at 24 pixels, all with the same visual weight. No text, no letters, no numbers.

Salvar como `icons-tokens.png`.

### 10 · Ícones da interface (opcional)

> A sheet of eight simple flat icons in a 4 by 2 grid, each a single solid warm-gold silhouette (#f3dfa2) with no outline and no shading, on a plain flat solid black background, evenly spaced with generous margins: two playing cards fanned with a small star on the front one; a five-pointed star; a scroll with three lines of writing; a curved arrow turning back (undo); two right-pointing chevrons (end turn); a closed padlock; a flame; an hourglass; plus, if space allows, an open eye and a gear. Bold, chunky shapes that stay recognizable at 20 pixels, the same visual weight. No text, no letters, no numbers.

Salvar como `icons-ui.png`.
