import { createGame, dual, key, single, toPlayerView } from '@dcv/engine'
import type { Action, Board, Pending } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Table } from '../game/table.js'
import { GameScreen } from './GameScreen.js'

/**
 * The board as it is tapped: which taps commit, which take a choice back, and
 * which open the stack inspector. The whole game is driven from these three,
 * and a fake table lets each decision be put on screen on its own rather than
 * played towards from the opening move.
 */
const base = toPlayerView(createGame(2), 0)

const PLANT = { q: 0, r: 0 }
/** A neighbour of the plant holding a dual: two abilities to choose between. */
const DUAL = { q: 1, r: 0 }
/** Another neighbour, a single, and one no decision ever mentions. */
const LONE = { q: 0, r: -1 }
const ASIDE = { q: 1, r: -1 }

function show({ pending, actions, board }: { pending: Pending; actions: Action[]; board?: Board }) {
  const view = { ...base, board: { ...base.board, ...board }, pending: [pending] }
  const perform = vi.fn()
  const table: Table = {
    view,
    actions,
    perform,
    undo: () => {},
    canUndo: false,
    undos: 0,
    forfeit: () => {},
    status: { kind: 'playing' },
    opponentConnected: true,
    opponentLabel: 'Machine',
  }
  const rendered = render(
    <GameScreen
      table={table}
      view={view}
      label="Easy"
      detail="computer"
      restartLabel="New game"
      onRestart={() => {}}
    />,
  )
  return { ...rendered, perform }
}

/** The plant's own token, and neighbours worth borrowing from. */
const plantBoard: Board = {
  [key(PLANT)]: [single('plant')],
  [key(DUAL)]: [dual('potion', 'plant')],
  [key(LONE)]: [single('meat')],
}

const plantPending: Pending = { kind: 'plant', at: PLANT, activated: [PLANT] }

describe("the plant's borrowing, asked on the neighbour", () => {
  const dualTargets: Action[] = [
    { type: 'plantTarget', at: DUAL, ability: 'potion' },
    { type: 'plantTarget', at: DUAL, ability: 'plant' },
    { type: 'plantTarget', at: LONE, ability: 'meat' },
  ]

  it('asks nothing until a neighbour is tapped', () => {
    const { container } = show({ pending: plantPending, actions: dualTargets, board: plantBoard })
    expect(container.querySelector('.fire-choice')).toBeNull()
    expect(container.querySelector('.prompt-text')?.textContent).toBe('Use a neighbouring ability')
  })

  it('puts a fire-up per half over the neighbour, and nothing in the panel below', () => {
    const { container } = show({ pending: plantPending, actions: dualTargets, board: plantBoard })
    fireEvent.click(screen.getByLabelText(/^1,0: /))

    const choice = container.querySelector('.board-area .fire-choice[data-kind="plant"]')
    expect(choice).not.toBeNull()
    expect([...(choice?.querySelectorAll('.fire-up') ?? [])].map((b) => b.getAttribute('data-ability'))).toEqual([
      'potion',
      'plant',
    ])
    expect(choice?.getAttribute('data-shape')).toBe('Y')
    // the question is on the token it is about, not in the bar under the board
    expect(container.querySelectorAll('.prompt-actions button')).toHaveLength(0)
  })

  it('is a single fire over a neighbour with one ability', () => {
    const { container } = show({ pending: plantPending, actions: dualTargets, board: plantBoard })
    fireEvent.click(screen.getByLabelText(/^0,-1: /))
    const choice = container.querySelector('.fire-choice[data-kind="plant"]')
    expect(choice?.getAttribute('data-shape')).toBe('I')
    expect(choice?.querySelectorAll('.fire-up')).toHaveLength(1)
    // borrowing is not optional, so there is nothing to decline
    expect(choice?.querySelector('.fire-skip')).toBeNull()
  })

  it('borrows the ability whose fire is tapped', () => {
    const { perform } = show({ pending: plantPending, actions: dualTargets, board: plantBoard })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByRole('button', { name: 'Use Plant' }))
    expect(perform).toHaveBeenCalledWith({ type: 'plantTarget', at: DUAL, ability: 'plant' })
  })

  it('lets the neighbour go when it is tapped again, without borrowing anything', () => {
    const { container, perform } = show({ pending: plantPending, actions: dualTargets, board: plantBoard })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(container.querySelector('.fire-choice')).toBeNull()
    expect(screen.getByLabelText(/^1,0: /).getAttribute('data-highlight')).toBe('legal')
    expect(perform).not.toHaveBeenCalled()
  })
})

describe('taking a move back', () => {
  const moving: Action[] = [
    { type: 'meatMove', from: DUAL, to: PLANT },
    { type: 'meatMove', from: DUAL, to: ASIDE },
  ]
  const pending: Pending = { kind: 'meat', at: LONE }

  it('drops the selection when the chosen token is tapped again', () => {
    show({ pending, actions: moving, board: plantBoard })
    const token = () => screen.getByLabelText(/^1,0: /)

    fireEvent.click(token())
    expect(token().getAttribute('data-highlight')).toBe('selected')

    fireEvent.click(token())
    expect(token().getAttribute('data-highlight')).toBe('legal')
    // and the destinations it had offered are gone with it
    expect(screen.getByLabelText(/^1,-1: /).getAttribute('data-highlight')).toBe('none')
  })

  it('drops it on a tap beside the board, where nothing else answers', () => {
    const { container } = show({ pending, actions: moving, board: plantBoard })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText(/^1,0: /).getAttribute('data-highlight')).toBe('selected')

    fireEvent.click(container.querySelector('.app') as HTMLElement)
    expect(screen.getByLabelText(/^1,0: /).getAttribute('data-highlight')).toBe('legal')
  })

  it('puts the potion back down too: the first end of a swap, tapped again, lets go', () => {
    const swapping: Action[] = [{ type: 'potionSwap', a: DUAL, b: LONE }]
    const { perform } = show({ pending: { kind: 'potion' }, actions: swapping, board: plantBoard })
    const token = () => screen.getByLabelText(/^1,0: /)
    fireEvent.click(token())
    expect(token().getAttribute('data-highlight')).toBe('selected')
    fireEvent.click(token())
    expect(token().getAttribute('data-highlight')).toBe('legal')
    expect(perform).not.toHaveBeenCalled()
  })

  it('puts the iron back down too', () => {
    const shifting: Action[] = [{ type: 'ironMove', from: DUAL, to: ASIDE }, { type: 'ironDone' }]
    const { perform } = show({ pending: { kind: 'iron', at: PLANT, movesLeft: 2, movedTo: [] }, actions: shifting, board: plantBoard })
    const token = () => screen.getByLabelText(/^1,0: /)
    fireEvent.click(token())
    expect(token().getAttribute('data-highlight')).toBe('selected')
    fireEvent.click(token())
    expect(token().getAttribute('data-highlight')).toBe('legal')
    expect(perform).not.toHaveBeenCalled()
  })

  it('still moves when a destination is tapped', () => {
    const { perform } = show({ pending, actions: moving, board: plantBoard })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,-1: /))
    expect(perform).toHaveBeenCalledWith({ type: 'meatMove', from: DUAL, to: ASIDE })
  })
})

describe('the stack inspector, while a decision is open', () => {
  const buried: Board = { ...plantBoard, [key(DUAL)]: [single('iron'), dual('potion', 'plant')], [key(ASIDE)]: [single('bread'), single('meat')] }
  const targets: Action[] = [
    { type: 'plantTarget', at: DUAL, ability: 'potion' },
    { type: 'plantTarget', at: DUAL, ability: 'plant' },
  ]

  it('opens on the space the decision is about: the tap answers and shows what is buried', () => {
    show({ pending: plantPending, actions: targets, board: buried })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
    // the tap did what it was for: the fire-ups are up
    expect(screen.getByRole('button', { name: 'Use Potion' })).toBeDefined()
  })

  it('moves to the next stack tapped, letting go of the selection', () => {
    show({ pending: plantPending, actions: targets, board: buried })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,-1: /))
    expect(screen.getByLabelText('Stack at 1,-1')).toBeDefined()
    expect(screen.queryByLabelText('Stack at 1,0')).toBeNull()
    expect(screen.getByLabelText(/^1,0: /).getAttribute('data-highlight')).toBe('legal')
  })

  it('opens on the stack a move picks its token up from, and shuts as the move is made', () => {
    const moving: Action[] = [{ type: 'meatMove', from: DUAL, to: ASIDE }]
    const { perform } = show({ pending: { kind: 'meat', at: LONE }, actions: moving, board: buried })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
    fireEvent.click(screen.getByLabelText(/^1,-1: /))
    expect(perform).toHaveBeenCalledWith(moving[0])
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('shuts when the picked-up token is put back down', () => {
    const moving: Action[] = [{ type: 'meatMove', from: DUAL, to: ASIDE }]
    show({ pending: { kind: 'meat', at: LONE }, actions: moving, board: buried })
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })
})
