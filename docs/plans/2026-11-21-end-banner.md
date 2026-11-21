# End-of-game banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the end of the game triggers, both screens show a "Final turn!" banner at the point of the play that triggered it, and the bag and/or deck get a cross until the game ends.

**Architecture:** Pure helpers in `apps/web/src/game/endSignal.ts` find the cause and the log position of the trigger. A hook `useEndBanner` (in `components/EndBanner.tsx`, beside `TurnBanner`) owes a banner when `view.endTriggered` flips, shows it once every queued presentation event before the trigger has played, and holds the events from the trigger on through the presentation `gate`. `GameScreen` wires it to the turn banner, the gate, the busy flag and the bag/deck.

**Tech Stack:** React 19, motion/react, vitest + testing-library.

**Spec:** `docs/specs/2026-11-21-end-banner-design.md`

## Global Constraints

- No engine change.
- Copy: banner "Final turn!", sub-line "The bag is empty" / "The deck is empty". Live line: "Final turn: the bag is empty" / "Final turn: the deck is empty".
- Same shape and hold as the turn banner (`BANNER_HOLD`), ember colours, no rays under reduced motion.
- Mounting with `endTriggered` already true: no banner, crosses shown.

## Review Focus

- Spending a coin can empty the deck (`engine.ts:221`): the deck trigger point is after the last `endTurn` **or** `spendCoin` of the batch. Test in Task 1.
- Bag hit exactly 0 by a crystal with no extras needed, then the two unpicked tokens go back (bag 2, `extrasAdded` false): the cause must still read as bag. Test in Task 1.
- Bag trigger at the start of a turn: order is turn banner → final banner → the draw. Deck trigger: final banner → turn banner. Test in Task 2 (hook ordering via `turn` input).
- A view that jumps (log shorter, reconnect): no banner, crosses shown. Test in Task 2.
- Game already `ended` while the banner is still owed: it is dropped. Test in Task 2.

---

### Task 1: endSignal helpers

**Files:** Create `apps/web/src/game/endSignal.ts`, test `apps/web/src/game/endSignal.test.ts`

**Produces:**
- `type EndCause = 'bag' | 'deck'`
- `endCause(view: Pick<PlayerView, 'deckCount' | 'bag' | 'extrasAdded'>): EndCause` — `'deck'` when `deckCount === 0` and the bag is not exhausted (`bag.length > 0 && !extrasAdded`); else `'bag'`.
- `triggerPoint(added: readonly LogEntry[], offset: number, cause: EndCause): number` — bag: `offset + index` of the first `draw`; deck: `offset + index + 1` of the last `endTurn`/`spendCoin`; neither found: `offset + added.length`.
- `endMarks(view, revealed: boolean): { bag: boolean; deck: boolean }` — nothing unless `revealed && view.endTriggered`; deck when `deckCount === 0`; bag when `deckCount > 0 || bag.length === 0 || extrasAdded`.

- [ ] Tests: cause bag with empty bag; bag with extras added and tokens back in; bag with 2 back and deck > 0; deck with deck 0 and bag full. Trigger point: crystal batch `[fireUp, draw, draw, draw]` at offset 10 → 11; deck `[score, endTurn]` at 4 → 6; `[spendCoin, coinDiscard]` at 0 → 1; nothing matching → offset + length. Marks: none when not revealed.
- [ ] Run `npx vitest run apps/web/src/game/endSignal.test.ts` → FAIL, implement, → PASS. Commit.

### Task 2: useEndBanner + EndBanner, sharing the banner layer

**Files:** Create `apps/web/src/components/EndBanner.tsx`; modify `apps/web/src/components/TurnBanner.tsx` (extract `BannerLayer({ side, bannerKey, onDismiss, children })` used by both); test `apps/web/src/components/EndBanner.test.tsx`.

**Produces:**
```ts
useEndBanner(input: {
  view: Pick<PlayerView, 'endTriggered' | 'log' | 'deckCount' | 'bag' | 'extrasAdded' | 'phase'>
  remaining: readonly { seq: number }[]
  menuOver: boolean
  turn: { pending: boolean; up: boolean }
}): {
  banner: { key: number; cause: EndCause } | null
  pending: boolean            // owed or up
  cause: EndCause | null      // of the owed/up banner
  holds: (seq: number) => boolean // true for seq >= trigger point while pending (negative seqs never)
  revealed: boolean
  dismiss: () => void
}
EndBanner({ banner, onDismiss })
```
Blocked while `menuOver`, while `turn.up`, and while `turn.pending` when the cause is bag. Shows once no `remaining` event has `0 <= seq < point`.

- [ ] Tests (fake timers): flip owes a banner and shows it once nothing before the point remains; waits while an earlier seq remains; `holds` true for seq ≥ point and false after `BANNER_HOLD`; mount with `endTriggered` → no banner, `revealed` true; log shrinks on flip → no banner, revealed; bag cause waits for `turn.pending`, deck cause does not; dropped when `phase` is `ended`; `dismiss` clears it.
- [ ] Run → FAIL, implement, → PASS. Commit.

### Task 3: GameScreen wiring, crosses, styles

**Files:** Modify `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/Bag.tsx`, `apps/web/src/styles.css`; test `apps/web/src/components/Board.test.tsx` neighbour or new `EndMarks.test.tsx`.

- `Bag` and `DeckCount` take `spent?: boolean` → `data-spent`, and the label gains ", ran out: the game ends this turn" / ", none left: the game ends this turn".
- GameScreen: turn banner `blocked` adds the end banner pending with cause deck (through a ref, as `bannerPending`); gate adds `endHolds.current(event.seq)`; `wake` effect also on end pending; `catchingUp` and `busy` add end pending; tap dismisses it; live line; `<EndBanner>` after `<TurnBanner>`.
- CSS: `.turn-banner-layer[data-side='end']` ember gradient, `.turn-banner-sub` small line; `[data-spent]` cross drawn with two rotated bars over `.bag-art` and over `.deck-count`.

- [ ] Test: render `Bag` / `DeckCount` with `spent` → `data-spent` and the label. Run full `npm test` → PASS. `npm run build` → OK. Commit.
