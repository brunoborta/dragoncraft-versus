# Tutorial em capítulos, com Back e Next — design curto

Data: 2026-11-21 · Tamanho: mudança média sobre o tutorial existente · Status: para aprovação

Estende `docs/specs/2026-11-21-tutorial-design.md`.

## Por quê

O tutorial é uma sequência longa de falas. Quem toca rápido demais pula uma
fala e não tem como voltar; e não há noção de onde se está nem de quanto
falta. Capítulos dão o mapa, o contador dá o ritmo, e o Back conserta o toque
errado.

## Capítulos — o cardápio dos dragões

| # | Nome | Lições (ids em `lessons.ts`) |
|---|---|---|
| 1 | The Menu | `class` |
| 2 | Starters | `first-turn`, `scoring` |
| 3 | Seconds, Please | `bread`, `crystal` |
| 4 | Main Course | `meat-alone`, `meat-card`, `iron`, `potion` |
| 5 | Chef's Specials | `plant`, `dual` |
| 6 | House Rules | `stacks`, `undo`, `coins` |
| 7 | The Bill | `the-end` |
| — | Dessert | o convite pro aquecimento (ato 3), sem número |

## A faixa

```
╔═════════════════════════════════════════╗
║ CH. 4 · MAIN COURSE                2/7  ║
║ Meat: fire it up and you move one       ║
║ neighbour — anywhere on the board.      ║
║ Skip                     ◂ Back  Next ▸ ║
╚═════════════════════════════════════════╝
```

- Cabeçalho: número e nome do capítulo, e a página dentro do capítulo.
- **Página** = cada passo `say` ou `do`. Passos `play` (o Maple jogando) não contam.
- Rodapé: Skip à esquerda (com a confirmação de hoje); ◂ Back e Next ▸ juntos à direita.
- Dessert mostra só "DESSERT" no cabeçalho, sem página, e os botões do convite no lugar de Back/Next.

## Next

- Página de fala: avança (como o ▸ e o toque na tela de hoje — os dois continuam).
- Página de ação: desabilitado (cinza) até a jogada ser feita. Não existe "Show me": quem faz é o jogador.

## Back

- Volta uma página e desfaz o que aconteceu nela: se a página anterior pediu
  uma ação, o tabuleiro volta pra antes dela e a ação fica pedida de novo.
- Jogadas do Maple no caminho são desfeitas junto, até a página anterior do jogador.
- Atravessa lições e capítulos: na página 1 de um capítulo, volta pra última
  página do capítulo anterior, com o tabuleiro como estava.
- Desabilitado só na primeira página do tutorial.
- Voltar não mostra banner de turno nem cartão de capítulo; só a tela no estado daquela página.

## Cartão de capítulo

Ao entrar num capítulo indo pra frente (e no Dessert), um cartão no estilo
dos banners — "Chapter 4" pequeno, "Main Course" grande — por ~1,4 s, ou até
um toque. O Maple espera ele sair.

## Como (abordagem)

- `chapters.ts`: a lista acima; o capítulo e a página de qualquer cursor saem dela.
- O tutorial já guarda o histórico do jogo (`useGame`). A cada página que
  entra, guarda uma foto: cursor + histórico do jogo. Back restaura a última
  foto de página do jogador e remonta a tela sem animar (como a troca de lição).
- Ganha um `restore(history)` em `useGame`.

## Fora do escopo

Menu de capítulos pra pular direto; guardar progresso entre sessões.
