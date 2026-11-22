import { toPlayerView } from '@dcv/engine'
import type { Action, GameState, HexKey } from '@dcv/engine'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HUMAN_SEAT } from '../seats.js'
import type { Table } from '../table.js'
import { useGame } from '../useGame.js'
import { DESSERT, chapterOf, pageOf } from './chapters.js'
import { LESSONS } from './lessons.js'
import { rig, token } from './scenario.js'
import { accepts, offered, uiMatches } from './script.js'
import type { Lesson, Reopen, Step, UiEvent } from './script.js'

/** How long Maple waits, once the screen is still, before the first of his scripted moves. */
export const MAPLE_PAUSE = 700
/** …and before each move that follows one of his own. */
export const MAPLE_FOLLOW = 250
/** The beat after a lesson's last step, so its last move is seen before the next board. */
export const NEXT_LESSON_PAUSE = 900

/** How long a chapter's title card stays up, unless tapped away. */
export const CARD_HOLD = 1400

type Cursor = { lesson: number; step: number; done: number }
type Page = { cursor: Cursor; history: readonly GameState[] }
export type ChapterCard = { number: number | null; title: string }

export type Tutorial = {
  table: Table
  /** Changes whenever a lesson's board loads: the game screen is keyed on it, queues and all. */
  lessonKey: number
  /** 1 the class, 2 the lessons, 3 the warm-up offer once they are over. */
  act: 1 | 2 | 3
  /** The line on screen; null between lessons and in act 3. */
  step: Step | null
  /** The game screen is still playing something: the coach waits for it. */
  busy: boolean
  /** A tap on one of Maple's lines. */
  next: () => void
  /** Something happened on the screen that the engine never hears about. */
  ui: (event: UiEvent) => void
  restart: () => void
  /** The class is over: Maple's last line stays up while he flies to his seat. */
  departing: boolean
  /** He has landed: the lessons begin. */
  land: () => void
  /** One page back, the board with it. */
  back: () => void
  canBack: boolean
  /** False after a Back, until the next lesson loads going forward: no opening banner then. */
  fresh: boolean
  /** Where the line on screen stands in its chapter; null between lessons and in act 3. */
  page: ReturnType<typeof pageOf> | null
  card: ChapterCard | null
  dismissCard: () => void
  /** Straight to a lesson, by index; past the last one is Dessert. */
  jump: (index: number) => void
  /** The lesson on screen, by index; the lessons' length in act 3. */
  lessonIndex: number
  /** After a Back: what the rebuilt screen must open again (the settings, a stack); null otherwise. */
  reopen: Reopen | null
}

/**
 * Professor Maple's table. It is a `Table`, so the real game screen runs it:
 * the engine, the animations and the HUD are the game's own. What differs is
 * who decides what can be done: the step on screen. Only the action it waits
 * for is offered (`offered`), a tap on anything else is refused (`accepts`),
 * the bag is rigged before each step that draws, and Maple's moves are the
 * script's. Progress lives in a ref as well as in state, so the two actions
 * End turn sends in one tap — decline the fire-up, end — both land.
 */
export function useTutorialTable(onExit: () => void, lessons: readonly Lesson[] = LESSONS): Tutorial {
  const game = useGame(0, () => lessons[0].build())
  const cursorRef = useRef<Cursor>({ lesson: 0, step: 0, done: 0 })
  const [cursor, setCursorState] = useState<Cursor>(cursorRef.current)
  const [lessonKey, setLessonKey] = useState(0)
  const [screenBusy, setScreenBusy] = useState(false)
  /*
   * The screen counts an open menu as busy — the machine must not move under
   * it. The class opens the settings and talks about what is inside, so with
   * them open the coach does not wait: the game is frozen under them anyway.
   */
  const [settingsOpen, setSettingsOpen] = useState(false)
  // the chapter's title card, on the way in: Maple waits for it
  const [card, setCard] = useState<ChapterCard | null>(() => cardFor(lessons, 0))
  const busy = (screenBusy && !settingsOpen) || card !== null
  // false after a Back: the screen comes back as the page left it, without a turn banner
  const [fresh, setFresh] = useState(true)
  // after a Back: what the rebuilt screen opens again, as it was on that page
  const [reopen, setReopen] = useState<Reopen | null>(null)
  // a copy of the game at every page entered, to go back to
  const [pages, setPagesState] = useState<Page[]>([])
  const pagesRef = useRef<Page[]>([])
  const setPages = useCallback((next: Page[]) => {
    pagesRef.current = next
    setPagesState(next)
  }, [])

  const setCursor = useCallback((next: Cursor) => {
    cursorRef.current = next
    setCursorState(next)
  }, [])

  const lesson = lessons[cursor.lesson] as Lesson | undefined
  const step = lesson?.steps[cursor.step] ?? null
  const act: 1 | 2 | 3 = lesson ? lesson.act : 3

  /** One thing the current step waited for has happened. */
  const advance = useCallback(() => {
    const c = cursorRef.current
    const current = lessons[c.lesson]?.steps[c.step]
    const needed = current?.kind === 'do' ? current.expect.length : 1
    setCursor(c.done + 1 < needed ? { ...c, done: c.done + 1 } : { ...c, step: c.step + 1, done: 0 })
  }, [lessons, setCursor])

  const prepareFor = (current: Step | undefined, done: number): ((state: GameState) => GameState) | undefined => {
    if (!current || current.kind === 'say' || !current.draws || done > 0) return undefined
    const wanted = current.draws.map(token)
    return (state) => rig(state, wanted)
  }

  const perform = useCallback(
    (action: Action) => {
      const c = cursorRef.current
      const current = lessons[c.lesson]?.steps[c.step]
      if (!accepts(current, c.done, action)) return
      game.perform(action, prepareFor(current, c.done))
      advance()
    },
    [lessons, game, advance],
  )

  const ui = useCallback(
    (event: UiEvent) => {
      if (event.kind === 'openSettings') setSettingsOpen(true)
      if (event.kind === 'closeSettings') setSettingsOpen(false)
      const c = cursorRef.current
      const current = lessons[c.lesson]?.steps[c.step]
      if (current?.kind !== 'do') return
      const want = current.expect[c.done]
      if (want && 'ui' in want && uiMatches(event, want.ui)) advance()
    },
    [lessons, advance],
  )

  const undoWanted = (() => {
    if (step?.kind !== 'do') return false
    const want = step.expect[cursor.done]
    return want !== undefined && 'undo' in want
  })()

  const undo = useCallback(() => {
    if (!undoWanted || !game.canUndo) return
    game.undo()
    advance()
  }, [undoWanted, game, advance])

  const next = useCallback(() => {
    const c = cursorRef.current
    if (lessons[c.lesson]?.steps[c.step]?.kind === 'say') advance()
  }, [lessons, advance])

  const load = useCallback(
    (index: number) => {
      const target = lessons[index]
      if (target) game.load(target.build())
      // a new lesson is a new screen: whatever menu was open closed with the old one
      setSettingsOpen(false)
      setReopen(null)
      setFresh(true)
      // from Dessert (past the last lesson) there is no lesson to come from: always a new chapter
      const from = lessons[cursorRef.current.lesson]
      if (index === 0 || !target || !from || chapterOf(from.id).title !== chapterOf(target.id).title) {
        setCard(cardFor(lessons, index))
      }
      if (index === 0) setPages([])
      setCursor({ lesson: index, step: 0, done: 0 })
      setLessonKey((key) => key + 1)
    },
    [lessons, game, setCursor, setPages],
  )

  // every page entered is kept as it was when it opened: the cursor, and the game up to it
  useEffect(() => {
    const current = lessons[cursor.lesson]?.steps[cursor.step]
    if (!current || current.kind === 'play' || cursor.done !== 0) return
    const last = pagesRef.current[pagesRef.current.length - 1]
    if (last && last.cursor.lesson === cursor.lesson && last.cursor.step === cursor.step) return
    setPages([...pagesRef.current, { cursor, history: game.history }])
  }, [cursor, game.history, lessons, setPages])

  /**
   * One page back, and the game with it: whatever the player did on that page,
   * and whatever Maple played after it, is undone. Across lessons and
   * chapters too — the board comes back as that page left it.
   */
  const back = useCallback(() => {
    const kept = pagesRef.current
    if (kept.length < 2) return
    const rest = kept.slice(0, -1)
    const target = rest[rest.length - 1]
    // always one page: the screen, rebuilt, opens again what was open on it — the settings, a stack in the corner
    const open = openAt(lessons, target.cursor)
    setPages(rest)
    game.restore(target.history)
    setReopen(open)
    setSettingsOpen(open.settings)
    // the old screen's busy (a menu it had open) goes with it: the rebuilt one says its own
    setScreenBusy(false)
    setFresh(false)
    setCard(null)
    setCursor(target.cursor)
    setLessonKey((key) => key + 1)
  }, [game, lessons, setCursor, setPages])

  /** Straight to a lesson's first page (or Dessert, past the last): the debug panel's travel. Back starts afresh there. */
  const jump = useCallback(
    (index: number) => {
      // a lesson the course does not have (the panel lists the whole menu) is nowhere to go
      if (index < 0 || index > lessons.length) return
      setPages([])
      setReopen(null)
      load(index)
    },
    [lessons, load, setPages],
  )

  useEffect(() => {
    if (!card) return
    const timer = setTimeout(() => setCard(null), CARD_HOLD)
    return () => clearTimeout(timer)
  }, [card])

  /*
   * Maple plays his line once the screen is still: a beat before his first
   * move, so it can be followed, then his next ones close behind — place,
   * decline, end read as one gesture, not three scenes.
   */
  useEffect(() => {
    if (step?.kind !== 'play' || busy) return
    const following = lesson?.steps[cursor.step - 1]?.kind === 'play'
    const timer = setTimeout(() => {
      const c = cursorRef.current
      const current = lessons[c.lesson]?.steps[c.step]
      if (current?.kind !== 'play') return
      game.perform(current.action, prepareFor(current, 0))
      advance()
    }, following ? MAPLE_FOLLOW : MAPLE_PAUSE)
    return () => clearTimeout(timer)
  }, [step, busy, lessons, lesson, cursor.step, game, advance])

  // past the last line: a beat to see it land, then the next lesson
  const finished = lesson !== undefined && cursor.step >= lesson.steps.length
  /*
   * The class is over and Maple is to take his seat: the next lesson waits for
   * him to fly there (`land`), with his last line still on screen.
   */
  const departing = finished && lesson.act === 1 && lessons[cursor.lesson + 1]?.act === 2
  useEffect(() => {
    if (!finished || busy || departing) return
    const timer = setTimeout(() => load(cursorRef.current.lesson + 1), NEXT_LESSON_PAUSE)
    return () => clearTimeout(timer)
  }, [finished, busy, departing, load])

  const { state } = game
  const view = useMemo(() => toPlayerView(state, HUMAN_SEAT), [state])
  const yours = state.current === HUMAN_SEAT && state.phase !== 'ended' && lesson !== undefined && !finished
  // with nothing else to show, a token still to place keeps the turn reading as the player's — never "is thinking…"
  const actions = yours ? offered(lesson.steps, cursor.step, cursor.done, game.actions, lesson.idle ?? { type: 'place' }) : []

  const table: Table = {
    view,
    actions,
    perform,
    undo,
    canUndo: undoWanted && game.canUndo,
    undos: game.undos,
    forfeit: onExit,
    status: { kind: 'playing' },
    opponentConnected: true,
    opponentLabel: 'Professor Maple',
    setScreenBusy,
  }

  return {
    table,
    lessonKey,
    act,
    // leaving the class, his last line stays up while he flies
    step: departing ? lesson.steps[lesson.steps.length - 1] : finished ? null : step,
    departing,
    land: () => {
      if (departing) load(cursorRef.current.lesson + 1)
    },
    busy,
    next,
    ui,
    restart: () => load(0),
    back,
    canBack: pages.length >= 2 && step?.kind !== 'play' && !finished,
    fresh,
    // leaving the class, the last line stays up — and its page with it
    page: lesson && (!finished || departing) ? pageOf(lessons, cursor.lesson, Math.min(cursor.step, lesson.steps.length - 1)) : null,
    card,
    dismissCard: () => setCard(null),
    jump,
    lessonIndex: cursor.lesson,
    reopen,
  }
}

/** True when the lesson has opened the settings before this step and not yet closed them. */
export function settingsOpenAt(lessons: readonly Lesson[], cursor: { lesson: number; step: number }): boolean {
  let open = false
  for (const step of lessons[cursor.lesson]?.steps.slice(0, cursor.step) ?? []) {
    if (step.kind !== 'do') continue
    for (const want of step.expect) {
      if (!('ui' in want)) continue
      if (want.ui.kind === 'openSettings') open = true
      if (want.ui.kind === 'closeSettings') open = false
    }
  }
  return open
}

/**
 * What was open on a page: the settings, between the step that opened them and
 * the one that closed them; and, until the next thing done on the board — any
 * move puts them away — a stack opened in the corner, a space picked, the
 * cards marked to keep.
 */
export function openAt(lessons: readonly Lesson[], cursor: { lesson: number; step: number }): Reopen {
  let inspect: HexKey | null = null
  let select: HexKey | null = null
  let keep: string[] | null = null
  const moved = () => {
    inspect = null
    select = null
    keep = null
  }
  for (const step of lessons[cursor.lesson]?.steps.slice(0, cursor.step) ?? []) {
    if (step.kind === 'play') moved()
    if (step.kind !== 'do') continue
    for (const want of step.expect) {
      if (!('ui' in want)) moved()
      else if (want.ui.kind === 'inspect') inspect = want.ui.hex
      else if (want.ui.kind === 'select') select = want.ui.hex
      else if (want.ui.kind === 'keep') keep = want.ui.cards
    }
  }
  return { settings: settingsOpenAt(lessons, cursor), inspect, select, keep }
}

/** The title card of the chapter a lesson opens — or Dessert, past the last one. */
function cardFor(lessons: readonly Lesson[], index: number): ChapterCard {
  const lesson = lessons[index]
  if (!lesson) return { number: null, title: DESSERT }
  const chapter = chapterOf(lesson.id)
  return { number: chapter.number, title: chapter.title }
}
