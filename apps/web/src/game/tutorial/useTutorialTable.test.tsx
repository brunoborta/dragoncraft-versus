import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scenario } from './scenario.js'
import type { Lesson } from './script.js'
import { SPOT } from './spots.js'
import {
  CARD_HOLD,
  MAPLE_FOLLOW,
  MAPLE_PAUSE,
  NEXT_LESSON_PAUSE,
  openAt,
  settingsOpenAt,
  useTutorialTable,
} from './useTutorialTable.js'

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
    id: 'first-turn',
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
  // the first chapter's title card: out of the way, as a tap would put it
  act(() => hook.result.current.dismissCard())
  return { onExit, hook, now: () => hook.result.current }
}

function finishLesson(now: () => ReturnType<typeof useTutorialTable>) {
  act(() => now().next())
  act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
  act(() => now().dismissCard())
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
    // the class is over: Maple flies to his seat, and lands
    act(() => now().land())
    expect(now().act).toBe(2)
    expect(now().step).toMatchObject({ text: 'Look.' })
  })

  it('does not wait on a busy screen while the settings are open: they are part of the class', () => {
    const { now } = setup()
    act(() => now().table.setScreenBusy?.(true))
    expect(now().busy).toBe(true)
    act(() => now().ui({ kind: 'openSettings' }))
    expect(now().busy).toBe(false)
    act(() => now().ui({ kind: 'closeSettings' }))
    expect(now().busy).toBe(true)
  })

  it('changes the key of the screen when a lesson loads', () => {
    const { now } = setup()
    const first = now().lessonKey
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    // the class is over: Maple flies to his seat, and lands
    act(() => now().land())
    expect(now().lessonKey).not.toBe(first)
  })

  function toTurnLesson(now: () => ReturnType<typeof useTutorialTable>) {
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    // the class is over: Maple flies to his seat, and lands
    act(() => now().land())
    act(() => now().dismissCard())
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

describe('Back, pages and chapters', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function toTurnLesson(now: () => ReturnType<typeof useTutorialTable>) {
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    // the class is over: Maple flies to his seat, and lands
    act(() => now().land())
    act(() => now().dismissCard())
  }

  it('keeps the last line of the class up while Maple flies to his seat, and goes on once he lands', () => {
    const { now } = setup()
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    expect(now().departing).toBe(true)
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
    act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE * 5))
    expect(now().act).toBe(1)
    act(() => now().land())
    expect(now().departing).toBe(false)
    expect(now().act).toBe(2)
  })

  it('jumps straight to a lesson, and to Dessert past the last', () => {
    const { now } = setup()
    act(() => now().jump(2))
    expect(now().lessonIndex).toBe(2)
    expect(now().step).toMatchObject({ text: 'Here.' })
    expect(now().card).toEqual({ number: 6, title: 'House Rules' })
    expect(now().canBack).toBe(false)
    act(() => now().jump(LESSONS.length))
    expect(now().act).toBe(3)
    expect(now().card).toEqual({ number: null, title: 'Dessert' })
  })

  it('plays the moves that follow one of his own close behind it', () => {
    const course: Lesson[] = [
      {
        id: 'first-turn',
        act: 2,
        build: () => scenario({ held: 'bread', bag: ['iron'] }),
        steps: [
          { kind: 'do', text: 'Here.', expect: [{ action: { type: 'place', at: at(1, 1) } }] },
          {
            kind: 'do',
            text: 'End turn.',
            expect: [{ action: { type: 'skipFireUp' } }, { action: { type: 'endTurn' } }],
            draws: ['iron'],
          },
          { kind: 'play', action: { type: 'place', at: at(-1, 2) } },
          { kind: 'play', action: { type: 'skipFireUp' } },
          { kind: 'say', text: 'Done.' },
        ],
      },
    ]
    const hook = renderHook(() => useTutorialTable(() => {}, course))
    const now = () => hook.result.current
    act(() => now().dismissCard())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    act(() => {
      now().table.perform({ type: 'skipFireUp' })
      now().table.perform({ type: 'endTurn' })
    })
    act(() => vi.advanceTimersByTime(MAPLE_PAUSE - 1))
    expect(now().table.view?.board['-1,2']).toBeUndefined()
    act(() => vi.advanceTimersByTime(2))
    expect(now().table.view?.board['-1,2']).toHaveLength(1)
    act(() => vi.advanceTimersByTime(MAPLE_FOLLOW + 1))
    expect(now().step).toMatchObject({ text: 'Done.' })
  })

  it('cannot go back from the very first page', () => {
    const { now } = setup()
    expect(now().canBack).toBe(false)
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'Hello.' })
  })

  it('goes back to the line before', () => {
    const { now } = setup()
    act(() => now().next())
    expect(now().canBack).toBe(true)
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'Hello.' })
    expect(now().fresh).toBe(false)
  })

  it('takes a placement back with the page that asked for it', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    expect(now().step).toMatchObject({ text: 'End turn.' })
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'Put it here.' })
    expect(now().table.view?.board['1,1']).toBeUndefined()
    expect(now().table.actions).toEqual([{ type: 'place', at: at(1, 1) }])
  })

  it("undoes Maple's move on the way back, and the end of the turn before it", () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    act(() => {
      now().table.perform({ type: 'skipFireUp' })
      now().table.perform({ type: 'endTurn' })
    })
    act(() => vi.advanceTimersByTime(MAPLE_PAUSE + 1))
    expect(now().step).toMatchObject({ text: 'See?' })
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'End turn.' })
    expect(now().table.view?.current).toBe(0)
    expect(now().table.view?.board['-1,2']).toBeUndefined()
    expect(now().table.view?.board['1,1']).toHaveLength(1)
  })

  it("goes back across lessons, to the last page of the one before, with its board", () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
    expect(now().act).toBe(1)
    expect(now().card).toBeNull()
  })

  it('counts pages afresh after going back and forth', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    expect(now().page?.page).toBe(2)
    act(() => now().back())
    expect(now().page?.page).toBe(1)
    act(() => now().next())
    expect(now().page?.page).toBe(2)
    act(() => now().back())
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
  })

  it('opens each chapter with its card, and Maple waits for it', () => {
    const onExit = vi.fn()
    const hook = renderHook(() => useTutorialTable(onExit, LESSONS))
    const now = () => hook.result.current
    expect(now().card).toEqual({ number: 1, title: 'The Menu' })
    expect(now().busy).toBe(true)
    act(() => vi.advanceTimersByTime(CARD_HOLD + 1))
    expect(now().card).toBeNull()

    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    // the class is over: Maple flies to his seat, and lands
    act(() => now().land())
    expect(now().card).toEqual({ number: 2, title: 'Starters' })
    expect(now().page).toMatchObject({ page: 1, pages: 4, chapter: { title: 'Starters' } })
  })

  it('goes back one page into the open settings, and opens them again', () => {
    const course: Lesson[] = [
      {
        id: 'class',
        act: 1,
        build: () => scenario({ held: 'bread' }),
        steps: [
          { kind: 'say', text: 'Hello.' },
          { kind: 'do', text: 'Tap the gear.', expect: [{ ui: { kind: 'openSettings' } }] },
          { kind: 'say', text: 'These are the options.' },
          { kind: 'say', text: 'And this is giving up.' },
          { kind: 'do', text: 'Close it.', expect: [{ ui: { kind: 'closeSettings' } }] },
          { kind: 'say', text: 'Done.' },
        ],
      },
    ]
    const hook = renderHook(() => useTutorialTable(() => {}, course))
    const now = () => hook.result.current
    act(() => now().dismissCard())
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    act(() => now().next())
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'These are the options.' })
    expect(now().reopen).toEqual({ settings: true, inspect: null, select: null, keep: null })
    // open, the settings are part of the class: the coach does not wait on them
    act(() => now().table.setScreenBusy?.(true))
    expect(now().busy).toBe(false)
    expect(settingsOpenAt(course, { lesson: 0, step: 3 })).toBe(true)
    expect(settingsOpenAt(course, { lesson: 0, step: 5 })).toBe(false)
  })

  it('does not keep the old screen busy across a Back out of the open settings', () => {
    const course: Lesson[] = [
      {
        id: 'class',
        act: 1,
        build: () => scenario({ held: 'bread' }),
        steps: [
          { kind: 'do', text: 'Tap the gear.', expect: [{ ui: { kind: 'openSettings' } }] },
          { kind: 'say', text: 'These are the options.' },
          { kind: 'say', text: 'Done.' },
        ],
      },
    ]
    const hook = renderHook(() => useTutorialTable(() => {}, course))
    const now = () => hook.result.current
    act(() => now().dismissCard())
    act(() => now().ui({ kind: 'openSettings' }))
    // an open menu: the screen says it is busy
    act(() => now().table.setScreenBusy?.(true))
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'Tap the gear.' })
    expect(now().busy).toBe(false)
  })

  it('goes back one page onto an open stack, and opens it again', () => {
    const course: Lesson[] = [
      {
        id: 'stacks',
        act: 2,
        build: () => scenario({ held: 'iron', board: { '1,0': ['meat', 'plant', 'potion'] } }),
        steps: [
          { kind: 'say', text: 'A stack.' },
          { kind: 'do', text: 'Tap it.', expect: [{ ui: { kind: 'inspect', hex: '1,0' } }] },
          { kind: 'say', text: 'It opens in the corner.', spots: [SPOT.peek] },
          { kind: 'say', text: 'Only the top counts.', spots: [SPOT.peek] },
          { kind: 'say', text: 'Done.' },
        ],
      },
    ]
    const hook = renderHook(() => useTutorialTable(() => {}, course))
    const now = () => hook.result.current
    act(() => now().dismissCard())
    act(() => now().next())
    act(() => now().ui({ kind: 'inspect', hex: '1,0' }))
    act(() => now().next())
    act(() => now().back())
    expect(now().step).toMatchObject({ text: 'It opens in the corner.' })
    expect(now().reopen).toEqual({ settings: false, inspect: '1,0', select: null, keep: null })
    expect(openAt(course, { lesson: 0, step: 1 })).toEqual({ settings: false, inspect: null, select: null, keep: null })
    expect(openAt(course, { lesson: 0, step: 4 })).toEqual({ settings: false, inspect: '1,0', select: null, keep: null })
  })

  it('opens again the space picked and the cards marked, until the next move puts them away', () => {
    const course: Lesson[] = [
      {
        id: 'plant',
        act: 2,
        build: () => scenario({ held: 'plant' }),
        steps: [
          { kind: 'do', text: 'Tap the Meat.', expect: [{ ui: { kind: 'select', hex: '2,-1' } }] },
          { kind: 'do', text: 'Now its flame.', expect: [{ action: { type: 'plantTarget' } }] },
          { kind: 'do', text: 'Keep two.', expect: [{ ui: { kind: 'keep', cards: ['a', 'b'] } }] },
          { kind: 'do', text: 'Confirm.', expect: [{ action: { type: 'coinDiscard' } }] },
          { kind: 'say', text: 'Done.' },
        ],
      },
    ]
    expect(openAt(course, { lesson: 0, step: 1 })).toMatchObject({ select: '2,-1', keep: null })
    expect(openAt(course, { lesson: 0, step: 2 })).toMatchObject({ select: null })
    expect(openAt(course, { lesson: 0, step: 3 })).toMatchObject({ keep: ['a', 'b'] })
    expect(openAt(course, { lesson: 0, step: 4 })).toMatchObject({ keep: null })
  })

  it('jumps from Dessert to any chapter', () => {
    const { now } = setup()
    act(() => now().jump(LESSONS.length))
    expect(now().act).toBe(3)
    act(() => now().jump(1))
    expect(now().lessonIndex).toBe(1)
    expect(now().card).toEqual({ number: 2, title: 'Starters' })
    act(() => now().jump(-1))
    expect(now().lessonIndex).toBe(1)
  })

  it('keeps the chapter and page of the last class line up while Maple flies', () => {
    const { now } = setup()
    act(() => now().next())
    act(() => now().ui({ kind: 'openSettings' }))
    expect(now().departing).toBe(true)
    expect(now().page).toMatchObject({ page: 2, pages: 2, chapter: { title: 'The Menu' } })
  })

  it('counts a stack shut by the next thing done on the board', () => {
    const course: Lesson[] = [
      {
        id: 'stacks',
        act: 2,
        build: () => scenario({ held: 'iron' }),
        steps: [
          { kind: 'do', text: 'Tap it.', expect: [{ ui: { kind: 'inspect', hex: '1,0' } }] },
          { kind: 'do', text: 'Place.', expect: [{ action: { type: 'place' } }] },
          { kind: 'say', text: 'Done.' },
        ],
      },
    ]
    expect(openAt(course, { lesson: 0, step: 1 }).inspect).toBe('1,0')
    expect(openAt(course, { lesson: 0, step: 2 }).inspect).toBeNull()
  })

  it('holds Maple back while a card is up', () => {
    const { now } = setup()
    toTurnLesson(now)
    act(() => now().next())
    act(() => now().table.perform({ type: 'place', at: at(1, 1) }))
    act(() => {
      now().table.perform({ type: 'skipFireUp' })
      now().table.perform({ type: 'endTurn' })
    })
    // a card cannot normally come up mid-lesson; the restart brings the first one back
    act(() => now().restart())
    expect(now().card).toEqual({ number: 1, title: 'The Menu' })
    expect(now().busy).toBe(true)
  })
})
