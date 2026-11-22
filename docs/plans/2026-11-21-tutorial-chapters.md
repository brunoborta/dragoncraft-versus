# Tutorial Chapters, Back and Next Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the tutorial into seven menu-named chapters with a page counter, a chapter card on entry, and Back/Next controls where Back rewinds the board.

**Architecture:** `chapters.ts` maps lesson ids to chapters and computes the page of a cursor. `useTutorialTable` records a snapshot (cursor + game history) at every page it enters; Back restores the previous snapshot through a new `useGame.restore` and remounts the screen without banners. The coach renders the header, footer and chapter card.

**Tech Stack:** React 19, vitest + testing-library.

**Spec:** `docs/specs/2026-11-21-tutorial-chapters-design.md`

## Global Constraints

- No commits (the user commits when they say so).
- Chapters, in order: The Menu (`class`); Starters (`first-turn`, `scoring`); Seconds, Please (`bread`, `crystal`); Main Course (`meat-alone`, `meat-card`, `iron`, `potion`); Chef's Specials (`plant`, `dual`); House Rules (`stacks`, `undo`, `coins`); The Bill (`the-end`); then Dessert, unnumbered.
- A page is a `say` or `do` step; `play` steps are not pages.
- Header copy: `CH. 4 · MAIN COURSE` and `2/7`; Dessert shows `DESSERT` only.
- Footer: Skip on the left; `◂ Back` and `Next ▸` together on the right.
- Next disabled on `do` pages. Back disabled only on the first page of the tutorial.
- Going back shows no turn banner and no chapter card.

## Review Focus

- Back from a `do` page whose first action is already done (skip done, End turn pending): lands on the previous page with the board before both. Test in Task 2.
- Back across a lesson boundary restores the previous lesson's board, not the new lesson's. Test in Task 2.
- Back over Maple's moves undoes them too. Test in Task 2.
- Going forward again after Back records pages afresh (no duplicates, the counter stays right). Test in Task 2.
- A chapter card holds Maple's scripted move until it is gone. Test in Task 2.

---

### Task 1: chapters.ts

**Files:** Create `apps/web/src/game/tutorial/chapters.ts`, test `chapters.test.ts`.

**Produces:** `type Chapter = { number: number; title: string; lessons: string[] }`; `CHAPTERS: readonly Chapter[]`; `chapterOf(lessonId: string): Chapter`; `pageOf(lessons: readonly Lesson[], lesson: number, step: number): { chapter: Chapter; page: number; pages: number }` (page 1-based; on a `play` step, the page before it).

- [ ] Tests: every lesson of `LESSONS` is in exactly one chapter and the chapter order follows `LESSONS`; `pageOf` at the first step of `meat-alone` is Main Course page 1; pages of Main Course equal its say+do steps; a play step reports the page before it. FAIL → implement → PASS.

### Task 2: Back and the chapter card in useTutorialTable

**Files:** Modify `apps/web/src/game/useGame.ts` (`history: GameState[]`, `restore(history: GameState[]): void`), `apps/web/src/game/tutorial/useTutorialTable.ts`; test `useTutorialTable.test.tsx`.

**Produces on `Tutorial`:** `back(): void`, `canBack: boolean`, `fresh: boolean` (false after a Back until the next forward load), `page: ReturnType<typeof pageOf> | null`, `card: { number: number | null; title: string } | null`, `dismissCard(): void`. `CARD_HOLD = 1400`. `busy` is true while a card is up.

- [ ] Tests (fake timers, small course with chapter-mapped ids): Back on a say returns to the previous page; Back after a placement removes the token and the step asks for it again; Back after End turn and Maple's move restores the board before End turn; Back on the first page of a lesson returns to the last page of the previous lesson with its board; `canBack` false on the very first page; going forward after Back counts pages correctly; a card is up at the start and on entering a new chapter, not on Back; Maple waits while the card is up. FAIL → implement → PASS.

### Task 3: Coach header, footer and card; wiring

**Files:** Modify `apps/web/src/components/Coach.tsx`, `apps/web/src/App.tsx` (`openingBanner={act !== 1 && fresh}`, pass page/card/back), `apps/web/src/styles.css`; test `Coach.test.tsx`, `TutorialApp.test.tsx`.

- [ ] Tests: header shows `CH. 4 · MAIN COURSE` and `2/7`; Next enabled on say and calls onNext, disabled on do; Back calls onBack and is disabled when `canBack` false; the Skip confirm still works; the card shows number and title and a tap dismisses it; Dessert header. FAIL → implement → PASS → `npm test`, `npm run build`, `tsc`; check in the browser.
