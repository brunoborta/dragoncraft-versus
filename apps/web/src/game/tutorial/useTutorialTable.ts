import { toPlayerView } from '@dcv/engine'
import type { Action, GameState } from '@dcv/engine'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HUMAN_SEAT } from '../seats.js'
import type { Table } from '../table.js'
import { useGame } from '../useGame.js'
import { LESSONS } from './lessons.js'
import { rig, token } from './scenario.js'
import { accepts, offered, uiMatches } from './script.js'
import type { Lesson, Step, UiEvent } from './script.js'

/** How long Maple waits, once the screen is still, before each scripted move. */
export const MAPLE_PAUSE = 700
/** The beat after a lesson's last step, so its last move is seen before the next board. */
export const NEXT_LESSON_PAUSE = 900

type Cursor = { lesson: number; step: number; done: number }

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
  const busy = screenBusy && !settingsOpen

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
      setCursor({ lesson: index, step: 0, done: 0 })
      setLessonKey((key) => key + 1)
    },
    [lessons, game, setCursor],
  )

  // Maple plays her line once the screen is still
  useEffect(() => {
    if (step?.kind !== 'play' || busy) return
    const timer = setTimeout(() => {
      const c = cursorRef.current
      const current = lessons[c.lesson]?.steps[c.step]
      if (current?.kind !== 'play') return
      game.perform(current.action, prepareFor(current, 0))
      advance()
    }, MAPLE_PAUSE)
    return () => clearTimeout(timer)
  }, [step, busy, lessons, game, advance])

  // past the last line: a beat to see it land, then the next lesson
  const finished = lesson !== undefined && cursor.step >= lesson.steps.length
  useEffect(() => {
    if (!finished || busy) return
    const timer = setTimeout(() => load(cursorRef.current.lesson + 1), NEXT_LESSON_PAUSE)
    return () => clearTimeout(timer)
  }, [finished, busy, load])

  const { state } = game
  const view = useMemo(() => toPlayerView(state, HUMAN_SEAT), [state])
  const yours = state.current === HUMAN_SEAT && state.phase !== 'ended' && lesson !== undefined && !finished
  const actions = yours ? offered(lesson.steps, cursor.step, cursor.done, game.actions, lesson.idle) : []

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
    step: finished ? null : step,
    busy,
    next,
    ui,
    restart: () => load(0),
  }
}
