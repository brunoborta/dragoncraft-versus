import { createInitialState, DECK } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameOver } from './GameOver.js'

const card = (id: string) => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

function finished(scoredA: string[], scoredB: string[], coinsA = 0, coinsB = 0): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    phase: 'ended',
    players: [
      { ...base.players[0], scored: scoredA.map(card), coins: coinsA },
      { ...base.players[1], scored: scoredB.map(card), coins: coinsB },
    ],
  }
}

describe('GameOver', () => {
  it('announces the winner and both totals', () => {
    render(<GameOver state={finished(['tri-bread'], [])} onRestart={() => {}} />)
    expect(screen.getByText('You win')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('0')).toBeDefined()
  })

  it('announces a loss', () => {
    render(<GameOver state={finished([], ['tri-bread'])} onRestart={() => {}} />)
    expect(screen.getByText('You lose')).toBeDefined()
  })

  it('announces a shared victory', () => {
    render(<GameOver state={finished(['tri-bread'], ['tri-plant'])} onRestart={() => {}} />)
    expect(screen.getByText('Shared victory')).toBeDefined()
  })

  it('offers a new game', () => {
    render(<GameOver state={finished([], [])} onRestart={() => {}} />)
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined()
  })
})
