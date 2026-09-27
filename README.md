# Dragoncraft Versus

A hex board game for two, played on a phone. Draw a dragon from the bag, place
it, optionally fire up its ability, and try to match the patterns on the shop
cards in your hand before the bag or the deck runs out.

**[Play it](https://brunoborta.github.io/dragoncraft-versus/)**

## The game in a minute

Nineteen hexagonal spaces. Each turn you pull a dragon token at random and put
it anywhere with room — stacks go up to three, and only the top one counts.
Then you may fire up what you just placed:

| Dragon | What firing it up does |
|---|---|
| Bread | Draw another dragon and place it |
| Crystal | Draw 3, keep 1, place it without firing up |
| Meat | Move one neighbour anywhere |
| Iron | Move up to two neighbours one space each |
| Potion | Swap any two dragons |
| Plant | Use a neighbour's ability |

The last two are where it gets interesting: a plant can fire another plant,
and a bread can place another bread, so one turn can run a long way.

Then you score. A shop card shows three icons in a shape, and it scores when
that shape is on the board in any rotation. Dual-coloured dragons count as
either of their two types. Most reputation when the bag or the deck empties
wins.

## Running it

```bash
npm install
npm run dev     # serves on your network, so a phone on the same wifi can play
npm test        # 251 tests
npm run build
```

## How it is built

Three workspace packages, and the boundary between them is the point.

**`packages/engine`** holds the rules. It has no runtime dependencies, imports
no React and no DOM, and never calls `Math.random`, `Date.now` or `crypto` —
every random draw threads an explicit seed through the call. State is
immutable: `applyAction(state, action)` returns a new state and never touches
the one it was given. That is what makes the same seed and the same moves
replay to a byte-identical game, which is what the machine opponent needs to
simulate and what a server would need to stay in step with a client.

A turn is not one action. Placing, firing up, choosing a target, chaining into
another ability — each is a separate decision. The engine models that as a
stack of pending decisions: `legalActions` reads only the top of the stack, and
`applyAction` pops one and may push more. The recursive abilities fall out of
that with no special cases.

**`packages/ai`** holds the opponents. The important part is a type signature:
a strategy is handed a `PlayerView`, never a `GameState`. It reaches a full
state only through `determinize`, which *guesses* the hidden information. The
machine cannot see your hand because the compiler will not let it. Medium beats
Easy 39 games to 1 over 40.

**`apps/web`** holds the interface. Portrait first, SVG board, everything
committed in two taps so a mis-tap never costs a move. It only ever offers what
`legalActions` returned, so an illegal move is not something you can tap and be
told off for — it is not there.

## Tests

The suite leans where the bugs are, which is the engine.

- **Whole games.** Forty games played end to end by choosing at random among
  the legal moves, asserting on every single step that no stack exceeds three,
  that all 42 tokens and all 42 cards are still accounted for, that a legal
  move always exists, and that the game terminates.
- **Self-play.** A hundred games of Easy against Medium with no illegal action
  and no hang.
- **A game through the real DOM.** One test drives a complete game through the
  interface, clicking what a player would click.

## Scope

Standard two-player mode, against the machine. Online play against a friend is
the next thing, and the engine was shaped for it: the rules already run
unchanged on a server, and the view a player gets is already filtered.

The design documents in [`docs/`](docs/) are in Portuguese — the spec argues
the decisions, the plan is the task-by-task build.
