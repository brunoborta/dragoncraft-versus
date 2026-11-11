import { createInitialState, DECK, toPlayerView } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArtProvider } from '../art/ArtContext.js'
import { CHOSEN_ART } from '../art/chosen.js'
import { GameOver } from './GameOver.js'

const card = (id: string) => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

function finished(scoredA: string[], scoredB: string[], coinsA = 0, coinsB = 0): PlayerView {
  const base = createInitialState(1)
  return toPlayerView({
    ...base,
    phase: 'ended',
    players: [
      { ...base.players[0], scored: scoredA.map(card), coins: coinsA },
      { ...base.players[1], scored: scoredB.map(card), coins: coinsB },
    ],
  }, 0)
}

describe('GameOver', () => {
  it('announces the winner and both totals', () => {
    render(<GameOver opponentLabel="Machine" restartLabel="New game" view={finished(['tri-bread'], [])} onRestart={() => {}} />)
    expect(screen.getByText('You win')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('0')).toBeDefined()
  })

  it('announces a loss', () => {
    render(<GameOver opponentLabel="Machine" restartLabel="New game" view={finished([], ['tri-bread'])} onRestart={() => {}} />)
    expect(screen.getByText('You lose')).toBeDefined()
  })

  it('announces a shared victory, under a crest of its own', () => {
    const { container } = render(
      <GameOver opponentLabel="Machine" restartLabel="New game" view={finished(['tri-bread'], ['tri-plant'])} onRestart={() => {}} />,
    )
    expect(screen.getByText('Shared victory')).toBeDefined()
    expect(container.querySelector('.crest')?.getAttribute('data-result')).toBe('draw')
  })

  it('shows the painted crest for the result', () => {
    const { container } = render(
      <GameOver opponentLabel="Machine" restartLabel="New game" view={finished([], ['tri-bread'])} onRestart={() => {}} />,
    )
    expect(container.querySelector('img.crest')?.getAttribute('src')).toBe(CHOSEN_ART.crest.lose)
  })

  /** The art is optional: without it the crest is drawn, and each result still has its own emblem. */
  it('draws a crest, with its own emblem, when the art is missing', () => {
    const art = { ...CHOSEN_ART, crest: { win: null, lose: null, draw: null } }
    const draw = render(
      <ArtProvider art={art}>
        <GameOver opponentLabel="Machine" restartLabel="New game" view={finished(['tri-bread'], ['tri-plant'])} onRestart={() => {}} />
      </ArtProvider>,
    )
    expect(draw.container.querySelector('.crest-star-silver')).not.toBeNull()
    expect(draw.container.querySelector('.crest-crack')).toBeNull()

    const lost = render(
      <ArtProvider art={art}>
        <GameOver opponentLabel="Machine" restartLabel="New game" view={finished([], ['tri-bread'])} onRestart={() => {}} />
      </ArtProvider>,
    )
    expect(lost.container.querySelector('.crest-crack')).not.toBeNull()
    expect(lost.container.querySelector('.crest-star-silver')).toBeNull()
  })

  it('offers a new game', () => {
    render(<GameOver opponentLabel="Machine" restartLabel="New game" view={finished([], [])} onRestart={() => {}} />)
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined()
  })
})
