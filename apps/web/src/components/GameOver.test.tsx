import { createInitialState, DECK, toPlayerView } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('counts the coins into the totals and says where each came from', () => {
    render(
      <GameOver opponentLabel="Machine" restartLabel="New game" view={finished(['tri-bread'], [], 2, 1)} onRestart={() => {}} />,
    )
    // tri-bread banks 3; 2 coins kept make 5 against 0 + 1
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('3 cards')).toBeDefined()
    expect(screen.getByText('+2')).toBeDefined()
    expect(screen.getByText('0 cards')).toBeDefined()
    expect(screen.getByText('+1')).toBeDefined()
  })
})

describe('playing again from the end screen', () => {
  const idle = { waiting: false, opponentWants: false, opponentGone: false }

  it('offers it first, with the way out beside it', () => {
    const act = vi.fn()
    render(
      <GameOver
        opponentLabel="Friend"
        restartLabel="Back to menu"
        view={finished([], [])}
        onRestart={() => {}}
        playAgain={{ ...idle, act }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(act).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeDefined()
  })

  it('waits on the opponent once asked, saying so', () => {
    render(
      <GameOver
        opponentLabel="Friend"
        restartLabel="Back to menu"
        view={finished([], [])}
        onRestart={() => {}}
        playAgain={{ ...idle, act: () => {}, waiting: true }}
      />,
    )
    expect((screen.getByRole('button', { name: 'Play again' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Waiting for Friend…')).toBeDefined()
  })

  it('says when the opponent is asking, and when they have left instead', () => {
    const asking = render(
      <GameOver
        opponentLabel="Friend"
        restartLabel="Back to menu"
        view={finished([], [])}
        onRestart={() => {}}
        playAgain={{ ...idle, act: () => {}, opponentWants: true }}
      />,
    )
    expect(screen.getByText('Friend wants to play again')).toBeDefined()
    asking.unmount()

    render(
      <GameOver
        opponentLabel="Friend"
        restartLabel="Back to menu"
        view={finished([], [])}
        onRestart={() => {}}
        playAgain={{ ...idle, act: () => {}, waiting: true, opponentGone: true }}
      />,
    )
    expect(screen.getByText('Friend left the game')).toBeDefined()
  })
})

describe('GameOver after giving up', () => {
  function givenUp(by: 0 | 1): PlayerView {
    const view = finished(['tri-bread'], [])
    return { ...view, log: [...view.log, { seat: by, action: { type: 'forfeit' } }] }
  }

  it('gives the game to the other side whatever the score, and says who gave up', () => {
    // seat 0 is ahead on cards but gave up
    const { container } = render(<GameOver opponentLabel="Machine" restartLabel="New game" view={givenUp(0)} onRestart={() => {}} />)
    expect(screen.getByText('You lose')).toBeDefined()
    expect(screen.getByText('You gave up')).toBeDefined()
    // the same crest as any loss, for now
    expect(container.querySelector('.crest')?.getAttribute('data-result')).toBe('lose')
  })

  it('names the opponent when they gave up', () => {
    render(<GameOver opponentLabel="Opponent" restartLabel="Back to menu" view={givenUp(1)} onRestart={() => {}} />)
    expect(screen.getByText('You win')).toBeDefined()
    expect(screen.getByText('Opponent gave up')).toBeDefined()
  })

  it('says nothing of the kind after a game played to the end', () => {
    render(<GameOver opponentLabel="Machine" restartLabel="New game" view={finished(['tri-bread'], [])} onRestart={() => {}} />)
    expect(screen.queryByText(/gave up/)).toBeNull()
