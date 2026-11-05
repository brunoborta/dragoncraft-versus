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
machine cannot see your hand because the compiler will not let it.

The three levels are one brain at three depths. **Medium** is greedy over a
single guess, one decision at a time. **Easy** is Medium with a shaky hand: the
same judgement, thrown away on about 45% of decisions, which compounds over the
five decisions of a turn into recognisable intentions rarely carried through.
**Hard** searches the whole turn before committing to its first move, prices an
unspent coin at the one reputation the rules actually pay for it, and subtracts
what the board is handing you — estimated from every card it has not seen
rather than from one guessed pair. Over forty games apiece the three average
roughly 9, 16 and 29 reputation.

Pattern matching is where all the time goes, so it does not run the readable
way. Asking whether a board serves a card means walking six orientations over
nineteen anchors, and the engine does that by adding hexes into fresh objects,
formatting `"q,r"` keys and hashing them — three allocations per cell check,
thirteen thousand checks to judge one board. None of that depends on the
position: which spaces a card can occupy is fixed when the deck is. So
`patterns.ts` computes it once into flat arrays of board indices and reduces a
position to nineteen integers, turning each check into an array read and a
bitwise and. That is about sixty times faster and took Hard from 54ms a
decision to 2.7ms, with the headroom spent on searching wider instead.

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
- **Self-play.** A hundred games of Easy against Medium, plus forty apiece of
  Easy and Hard against Medium, with no illegal action and no hang. One test
  asserts the ladder is in order on both win rate and scoreline, so a tuning
  change that flattens two levels into one fails.
- **Mirror matches.** Every level also plays itself. That is not symmetry for
  its own sake: a game that could not be finished — two plants handing the turn
  to each other forever — sat in the engine for months, reachable about once in
  a hundred and fifty games, and the step cap in self-play would have caught it
  immediately. It never did, because nothing had a level play itself, and the
  board shape only turned up with the same judgement building both ends.
- **The fast path against the slow one.** `evaluate.ts` keeps the readable
  statement of "is this card one placement away", built from the engine's own
  primitives, purely so the integer version has something to be checked
  against. One test holds them to the same answer for all 42 cards across
  several hundred boards taken from real games. A fast path with nothing to
  compare itself to is a fast path nobody can trust.
- **A game through the real DOM.** One test drives a complete game through the
  interface, clicking what a player would click.

## Scope

Standard two-player mode, against the machine. Online play against a friend is
the next thing, and the engine was shaped for it: the rules already run
unchanged on a server, and the view a player gets is already filtered.

The design documents in [`docs/`](docs/) are in Portuguese — the spec argues
the decisions, the plan is the task-by-task build.
