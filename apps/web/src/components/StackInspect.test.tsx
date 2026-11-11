import { createGame, key, single, toPlayerView } from '@dcv/engine'
import type { Action, Pending, PlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

function play(view: PlayerView, actions: Action[]) {
  const table: Table = {
    view,
    actions,
    perform: () => {},
    undo: () => {},
    canUndo: false,
    status: { kind: 'playing' },
    opponentConnected: true,
    opponentLabel: 'Machine',
  }
  return render(<GameScreen table={table} view={view} label="Easy" detail="" restartLabel="New game" onRestart={() => {}} />)
}

describe('the stack inspector', () => {
  it('opens on a stack while placing', () => {
    play(staged({ kind: 'place', token: single('plant'), fireUpAllowed: true }), [{ type: 'place', at: stacked }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('stays shut while a fire-up picks its targets', () => {
    play(staged({ kind: 'potion' }), [
      { type: 'potionSwap', a: stacked, b: other },
      { type: 'potionSwap', a: other, b: stacked },
    ])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('stays shut while a meat picks the neighbour to move', () => {
    play(staged({ kind: 'meat', at: other }), [{ type: 'meatMove', from: stacked, to: { q: 0, r: 0 } }])
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })
})
