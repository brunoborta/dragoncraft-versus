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
    undos: 0,
    forfeit: () => {},
    status: { kind: 'playing' },
    opponentConnected: true,
    opponentLabel: 'Machine',
  }
  return render(<GameScreen table={table} view={view} label="Easy" detail="" restartLabel="New game" onRestart={() => {}} />)
}

describe('the stack inspector', () => {
  it('opens on a stack while placing: choosing a space is also looking at it', () => {
    play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [{ type: 'place', at: stacked }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('opens in the corner of the board, leaving the controls uncovered, with a ring on the space', () => {
    const { container } = play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [
      { type: 'place', at: stacked },
    ])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(container.querySelector('.board-area .stack-peek')).not.toBeNull()
    expect(container.querySelector('footer .stack-peek')).toBeNull()
    // the tap also chose the space, and the selection ring outranks the quiet one
    expect(container.querySelector(".hex-ring[data-highlight='selected']")).not.toBeNull()
  })

  it('opens while a fire-up is offered on the token just placed', () => {
    play(staged({ kind: 'mayFireUp', at: stacked }), [{ type: 'fireUp', ability: 'bread' }, { type: 'skipFireUp' }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
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

  it('opens even on a stack the move does not take: looking is never wrong', () => {
    play(staged({ kind: 'meat', at: { q: 0, r: 0 } }), [{ type: 'meatMove', from: other, to: { q: 0, r: -1 } }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('opens on any stack once the turn is played out, and shuts on a second tap', () => {
    play({ ...staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), pending: [] }, [{ type: 'endTurn' }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it("opens on any stack during the opponent's turn, ringing the space it is about", () => {
    const theirs = { ...staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), current: (1 - base.seat) as 0 | 1 }
    const { container } = play(theirs, [])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
    // nothing is selected off-turn, so the quiet ring marks the peeked space
    expect(container.querySelector(".hex-ring[data-highlight='inspected']")).not.toBeNull()
  })

  it('stays shut on a single token, even with nothing left to decide', () => {
    play({ ...staged({ kind: 'potion' }), pending: [] }, [{ type: 'endTurn' }])
    fireEvent.click(screen.getByLabelText(/^-1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('opens while the plant borrows, though only the top token counts for it', () => {
    play(staged({ kind: 'plant', at: other, activated: [other] }), [{ type: 'plantTarget', at: stacked, ability: 'bread' }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })
})

describe('the stack peek', () => {
  const swaps: Action[] = [
    { type: 'potionSwap', a: stacked, b: other },
    { type: 'potionSwap', a: other, b: stacked },
  ]
  const open = () => fireEvent.click(screen.getByLabelText(/^1,0: /))
  const chips = () => [...document.querySelectorAll('.stack-chip')]

  it('says the order for a reader without naming a coordinate on screen', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    const panel = screen.getByLabelText('Stack at 1,0')
    expect(panel.textContent).toContain('Bottom to top')
    expect(panel.textContent).not.toMatch(/\d,-?\d/)
  })

  it('stands the chips in a column, the top of the stack on top and marked', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    expect(chips()).toHaveLength(2)
    // the stack is iron under bread: the bread leads the column, lit
    expect(chips()[0].hasAttribute('data-top')).toBe(true)
    expect(chips()[1].hasAttribute('data-top')).toBe(false)
  })

  it('deals the chips in bottom first, though the column shows the top first', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    // the bottom of the stack (iron, index 0) animates first; the top last
    const delays = chips().map((chip) => (chip as HTMLElement).style.getPropertyValue('--i'))
    expect(delays).toEqual(['1', '0'])
  })

  it('shows the token you are placing as a ghost on top, while this is its space', () => {
    play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [{ type: 'place', at: stacked }])
    open()
    const all = chips()
    expect(all).toHaveLength(3)
    // the ghost leads the column and takes the light; the stack's own top (bread) steps back
    expect(all[0].hasAttribute('data-ghost')).toBe(true)
    expect(all[0].hasAttribute('data-top')).toBe(true)
    expect(all[1].hasAttribute('data-top')).toBe(false)
    // and it is the last to be dealt in
    expect((all[0] as HTMLElement).style.getPropertyValue('--i')).toBe('2')
    expect(screen.getByLabelText('Stack at 1,0').textContent).toContain('yours would go on top: Plant')
  })

  it('opens on a single token when yours is about to land on it: a stack of two in the making', () => {
    play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [{ type: 'place', at: other }])
    fireEvent.click(screen.getByLabelText(/^-1,0: /))
    expect(screen.getByLabelText('Stack at -1,0')).toBeDefined()
    const all = chips()
    expect(all).toHaveLength(2)
    expect(all[0].hasAttribute('data-ghost')).toBe(true)
  })

  it('stays shut on a single token that is not where yours would land', () => {
    play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [{ type: 'place', at: stacked }])
    fireEvent.click(screen.getByLabelText(/^-1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('shows no ghost when the stack is only being looked at', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    expect(document.querySelector('.stack-chip[data-ghost]')).toBeNull()
  })

  it('has no close button: a second tap is what puts it away', () => {
    play(staged({ kind: 'potion' }), swaps)
    open()
    expect(screen.queryByLabelText('Close stack')).toBeNull()
    open()
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
