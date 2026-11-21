import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scenario } from './scenario.js'
import type { Lesson } from './script.js'
import { MAPLE_PAUSE, NEXT_LESSON_PAUSE, useTutorialTable } from './useTutorialTable.js'

const at = (q: number, r: number) => ({ q, r })

// a small course: a class line, a lesson with a placement, a double action and a Maple turn, and a last lesson
const LESSONS: Lesson[] = [
  {
    id: 'class',
    act: 1,
    idle: { type: 'place' },
    build: () => scenario({ held: 'bread' }),
    steps: [
      { kind: 'say', text: 'Hello.' },
      { kind: 'do', text: 'Tap the gear.', expect: [{ ui: { kind: 'openSettings' } }] },
    ],
  },
  {
    id: 'turn',
    act: 2,
    build: () => scenario({ held: 'bread', bag: ['iron'] }),
    steps: [
      { kind: 'say', text: 'Look.' },
      { kind: 'do', text: 'Put it here.', expect: [{ action: { type: 'place', at: at(1, 1) } }] },
      {
        kind: 'do',
        text: 'End turn.',
        expect: [{ action: { type: 'skipFireUp' } }, { action: { type: 'endTurn' } }],
        draws: ['iron'],
      },
      { kind: 'play', action: { type: 'place', at: at(-1, 2) } },
      { kind: 'say', text: 'See?' },
    ],
  },
  {
    id: 'undo',
    act: 2,
    build: () => scenario({ held: 'meat' }),
    steps: [
      { kind: 'do', text: 'Here.', expect: [{ action: { type: 'place', at: at(0, 0) } }] },
      { kind: 'do', text: 'Undo.', expect: [{ undo: true }] },
      { kind: 'say', text: 'Done.' },
    ],
  },
]

function setup() {
  const onExit = vi.fn()
  const hook = renderHook(() => useTutorialTable(onExit, LESSONS))
  return { onExit, hook, now: () => hook.result.current }
}

function finishLesson(now: () => ReturnType<typeof useTutorialTable>) {
  act(() => now().next())
  act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
}

describe('useTutorialTable', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens on the class, on its first line, with the token waiting to be placed', () => {
    const { now } = setup()
    expect(now().act).toBe(1)
    expect(now().step).toMatchObject({ kind: 'say', text: 'Hello.' })
    expect(now().table.actions.every((action) => action.type === 'place')).toBe(true)
    expect(now().table.actions.length).toBeGreaterThan(0)
  })

  it('moves a line on with a tap, and a screen step with what it waits for', () => {
    const { now } = setup()
    act(() => now().next())
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
    act(() => now().next())
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
    act(() => now().ui({ kind: 'closeSettings' }))
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
    act(() => now().ui({ kind: 'openSettings' }))
    act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
    expect(now().act).toBe(2)
    expect(now().step).toMatchObject({ text: 'Look.' })
  })

  it('changes the key of the screen when a lesson loads', () => {
    const { now } = setup()
    const first = now().lessonKey
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
    expect(now().lessonKey).not.toBe(first)
  })

  function toTurnLesson(now: () => ReturnType<typeof useTutorialTable>) {
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
  }

  it('ignores a tap on the game while Maple is talking', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    expect(now().table.view?.board['1,1']).toBeUndefined()
    expect(now().step).toMatchObject({ text: 'Look.' })
  })

  it('offers exactly the action a step waits for, and moves on once it is done', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    expect(now().table.actions).toEqual([{ type: 'place', at: at(1, 1) }])
    act(() => now().table.perform({ type: 'place', at: at(0, 0) }))
    expect(now().table.view?.board['0,0']).toBeUndefined()
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    expect(now().table.view?.board['1,1']).toHaveLength(1)
    expect(now().step).toMatchObject({ text: 'End turn.' })
  })

  it('takes the two actions of End turn in one tap, and Maple then plays her line', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    act(() => {
      now().table.perform({ type: 'skipFireUp' })
      now().table.perform({ type: 'endTurn' })
    })
    expect(now().table.view?.current).toBe(1)
    expect(now().step).toMatchObject({ kind: 'play' })
    expect(now().table.actions).toEqual([])

    act(() => now().table.setScreenBusy?.(true))
    act(() => vi.advanceTimersByTime(MAPLE_PAUSE + 1))
    expect(now().table.view?.board['-1,2']).toBeUndefined()

    act(() => now().table.setScreenBusy?.(false))
    act(() => vi.advanceTimersByTime(MAPLE_PAUSE + 1))
    expect(now().table.view?.board['-1,2']).toEqual([{ kind: 'single', type: 'iron' }])
    expect(now().step).toMatchObject({ text: 'See?' })
  })

  it('lets Undo through only on the step that asks for it', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    act(() => {
      now().table.perform({ type: 'skipFireUp' })
      now().table.perform({ type: 'endTurn' })
    })
    act(() => vi.advanceTimersByTime(MAPLE_PAUSE + 1))
    finishLesson(now)
    expect(now().step).toMatchObject({ text: 'Here.' })
    expect(now().table.canUndo).toBe(false)
    act(() => now().table.perform({ type: 'place', at: at(0, 0) }))
    expect(now().table.canUndo).toBe(true)
    act(() => now().table.undo())
    expect(now().table.view?.board['0,0']).toBeUndefined()
    expect(now().step).toMatchObject({ text: 'Done.' })
  })

  it('reaches act 3 after the last lesson, and starts over on restart', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    act(() => {
      now().table.perform({ type: 'skipFireUp' })
      now().table.perform({ type: 'endTurn' })
    })
    act(() => vi.advanceTimersByTime(MAPLE_PAUSE + 1))
    finishLesson(now)
    act(() => now().table.perform({ type: 'place', at: at(0, 0) }))
    act(() => now().table.undo())
    finishLesson(now)
    expect(now().act).toBe(3)
    expect(now().step).toBeNull()
    expect(now().table.actions).toEqual([])

    act(() => now().restart())
    expect(now().act).toBe(1)
    expect(now().step).toMatchObject({ text: 'Hello.' })
  })

  it('leaves the tutorial when the player gives up', () => {
    const { now, onExit } = setup()
    act(() => now().table.forfeit())
    expect(onExit).toHaveBeenCalled()
  })
})
