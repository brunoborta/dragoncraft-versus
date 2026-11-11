import { DECK, createGame, key, single, toPlayerView } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Table } from '../game/table.js'
import { GameScreen } from './GameScreen.js'

const base = toPlayerView(createGame(2), 0)
const lineBread = DECK.find((card) => card.id === 'line-bread')!

describe('the card glow', () => {
  it('lights the card the hovering token would complete', () => {
    // two breads in a line; a third at either end completes the card
    const view: PlayerView = {
      ...base,
      current: base.seat,
      board: { [key({ q: 0, r: 0 })]: [single('bread')], [key({ q: 1, r: 0 })]: [single('bread')] },
      pending: [{ kind: 'place', token: single('bread'), fireUpAllowed: true }],
      you: { ...base.you, hand: [lineBread, ...base.you.hand.filter((card) => card.id !== lineBread.id).slice(0, 1)] },
    }
    const target = { q: 2, r: 0 }
    const table: Table = {
      view,
      actions: [{ type: 'place', at: target }],
      perform: () => {},
      undo: () => {},
      canUndo: false,
      status: { kind: 'playing' },
      opponentConnected: true,
      opponentLabel: 'Machine',
    }
    const { container } = render(
      <GameScreen table={table} view={view} label="Easy" detail="" restartLabel="New game" onRestart={() => {}} />,
    )
    fireEvent.click(screen.getByLabelText(/^2,0: /))
    expect(container.querySelectorAll('.card[data-completes]')).toHaveLength(1)
  })
})
