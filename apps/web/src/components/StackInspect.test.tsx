import { createGame, key, single, toPlayerView } from '@dcv/engine'
import type { Action, Pending, PlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Table } from '../game/table.js'
import { GameScreen } from './GameScreen.js'

const base = toPlayerView(createGame(2), 0)
const stacked = { q: 1, r: 0 }
const other = { q: -1, r: 0 }

/** Your turn, a two-token stack at 1,0 and a single token at -1,0, with `pending` on top. */
function staged(pending: Pending): PlayerView {
  return {
    ...base,
    current: base.seat,
    board: { [key(stacked)]: [single('iron'), single('bread')], [key(other)]: [single('meat')] },
    pending: [pending],
  }
}

function play(view: PlayerView, actions: Action[], undo: () => void = () => {}) {
  const table: Table = {
    view,
    actions,
    perform: vi.fn(),
    undo,
    canUndo: true,
    status: { kind: 'playing' },
    opponentConnected: true,
    opponentLabel: 'Machine',
  }
  return render(<GameScreen table={table} view={view} label="Easy" detail="" restartLabel="New game" onRestart={() => {}} />)
}

describe('the stack inspector', () => {
  it('stays shut on a stack while placing: you choose a space, not what is under it', () => {
    play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [{ type: 'place', at: stacked }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('stays shut while a fire-up is offered on the token just placed', () => {
    play(staged({ kind: 'mayFireUp', at: stacked }), [{ type: 'fireUp', ability: 'bread' }, { type: 'skipFireUp' }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('opens when the potion lifts a token off a stack', () => {
    play(staged({ kind: 'potion' }), [
      { type: 'potionSwap', a: stacked, b: other },
      { type: 'potionSwap', a: other, b: stacked },
    ])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('opens when the meat picks a stacked neighbour to move', () => {
    play(staged({ kind: 'meat', at: other }), [{ type: 'meatMove', from: stacked, to: { q: 0, r: 0 } }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('opens when the iron picks a stacked token to shift', () => {
    play(staged({ kind: 'iron', at: other, movesLeft: 2, movedTo: [] }), [
      { type: 'ironMove', from: stacked, to: { q: 0, r: 0 } },
      { type: 'ironDone' },
    ])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('stays shut on a stack the move does not take', () => {
    play(staged({ kind: 'meat', at: { q: 0, r: 0 } }), [{ type: 'meatMove', from: other, to: { q: 0, r: -1 } }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('opens on any stack once the turn is played out, and shuts on a second tap', () => {
    play({ ...staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), pending: [] }, [{ type: 'endTurn' }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it("opens on any stack during the opponent's turn", () => {
    const theirs = { ...staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), current: (1 - base.seat) as 0 | 1 }
    play(theirs, [])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('stays shut on a single token, even with nothing left to decide', () => {
    play({ ...staged({ kind: 'potion' }), pending: [] }, [{ type: 'endTurn' }])
    fireEvent.click(screen.getByLabelText(/^-1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('stays shut while the plant borrows: only the top token counts', () => {
    play(staged({ kind: 'plant', at: other, activated: [other] }), [{ type: 'plantTarget', at: stacked, ability: 'bread' }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })
})

describe('the stack panel', () => {
  const swaps: Action[] = [
    { type: 'potionSwap', a: stacked, b: other },
    { type: 'potionSwap', a: other, b: stacked },
  ]
  const open = () => fireEvent.click(screen.getByLabelText(/^1,0: /))

  it('lists the stack bottom to top without naming a coordinate on screen', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    const panel = screen.getByLabelText('Stack at 1,0')
    expect(panel.textContent).toContain('Bottom to top')
    expect(panel.textContent).not.toMatch(/\d,-?\d/)
  })

  it('closes from its own button', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    fireEvent.click(screen.getByLabelText('Close stack'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes when the move is made', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    fireEvent.click(screen.getByLabelText(/^-1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes when the turn is undone', () => {
    const undo = vi.fn()
    play(staged({ kind: 'potion' }), swaps, undo)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalled()
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })
})

describe("the opponent's coin", () => {
  it('says on the bar that they are choosing cards, not just thinking', () => {
    const theirs = { ...staged({ kind: 'coinDiscard' }), current: (1 - base.seat) as 0 | 1 }
    play(theirs, [])
    expect(screen.getByText('Opponent spent a coin and is choosing cards…')).toBeDefined()
    expect(screen.queryByText('Opponent is thinking…')).toBeNull()
  })
})

describe('the table around the board', () => {
  it('shows the deck count in the bag corner, under the bag', () => {
    const { container } = play(staged({ kind: 'potion' }), [])
    const corner = container.querySelector('.bag-corner')
    const deck = screen.getByRole('img', { name: `Deck, ${base.deckCount} cards left` })
    expect(corner?.firstElementChild?.classList.contains('bag')).toBe(true)
    expect(corner?.lastElementChild).toBe(deck)
  })
})
