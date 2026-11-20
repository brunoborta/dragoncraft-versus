import { createGame, toPlayerView } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Hand } from './Hand.js'
import { PlayerBar, endTurnState } from './PlayerBar.js'
import { TopBar } from './TopBar.js'

const view = toPlayerView(createGame(1), 0)

describe('Hand', () => {
  it('shows both cards in hand', () => {
    const { container } = render(<Hand view={view} actions={[]} onAct={() => {}} />)
    expect(container.querySelectorAll('.card')).toHaveLength(2)
  })

  it('fans the cards from the middle, so two or three fit without squeezing', () => {
    const { container } = render(<Hand view={view} actions={[]} onAct={() => {}} />)
    const angles = [...container.querySelectorAll<HTMLElement>('.fan-slot')].map((slot) =>
      slot.style.getPropertyValue('--fan-angle'),
    )
    expect(angles).toEqual(['-2deg', '2deg'])
  })
})

describe('PlayerBar', () => {
  const bar = (actions: Action[] = [], myTurn = true) =>
    render(<PlayerBar view={view} actions={actions} myTurn={myTurn} onAct={() => {}} />)

  it('starts at zero reputation, however many coins you are holding', () => {
    bar()
    // coins become reputation at the end of the game; counting them now would
    // open every game at 3 and dock a point for spending one
    expect(screen.getByText(/0 reputation/)).toBeDefined()
    expect(screen.getByText(/3 coins/)).toBeDefined()
  })

  it('shows your card count, the same way the opponent plate does', () => {
    bar()
    expect(screen.getByText(/2 cards/)).toBeDefined()
  })

  it('keeps End turn on screen on the opponent turn, grey and inert', () => {
    bar([], false)
    const button = screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement
    expect(button.dataset.state).toBe('waiting')
    expect(button.disabled).toBe(true)
  })

  it('locks End turn while the turn still has something open', () => {
    bar([{ type: 'place', at: { q: 0, r: 0 } }])
    const button = screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement
    expect(button.dataset.state).toBe('locked')
    expect(button.disabled).toBe(true)
  })

  it('lights End turn once ending is legal, and ends the turn when tapped', () => {
    const onAct = vi.fn()
    render(<PlayerBar view={view} actions={[{ type: 'endTurn' }]} myTurn onAct={onAct} />)
    const button = screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement
    expect(button.dataset.state).toBe('ready')
    fireEvent.click(button)
    expect(onAct).toHaveBeenCalledWith({ type: 'endTurn' })
  })

  it('agrees with the engine on when ending is allowed', () => {
    expect(endTurnState(false, view, [{ type: 'endTurn' }])).toBe('waiting')
    expect(endTurnState(true, view, [{ type: 'spendCoin' }])).toBe('locked')
    expect(endTurnState(true, view, [{ type: 'spendCoin' }, { type: 'endTurn' }])).toBe('ready')
  })

  describe('as soon as the token is placed, with "Fire up this token?" open', () => {
    const asking: PlayerView = { ...view, pending: [{ kind: 'mayFireUp', at: { q: 0, r: 0 } }] }
    const answers: Action[] = [{ type: 'skipFireUp' }, { type: 'fireUp', ability: 'meat' }]

    it('opens End turn, gold: there is still the fire-up to decide', () => {
      render(<PlayerBar view={asking} actions={answers} myTurn onAct={() => {}} />)
      const button = screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement
      expect(button.dataset.state).toBe('ready')
      expect(button.dataset.done).toBeUndefined()
      expect(button.title).toBe('End your turn without firing up this token')
    })

    it('declines the fire-up and ends the turn in one tap: the log reads both', () => {
      const onAct = vi.fn()
      render(<PlayerBar view={asking} actions={answers} myTurn onAct={onAct} />)
      fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
      expect(onAct.mock.calls).toEqual([[{ type: 'skipFireUp' }], [{ type: 'endTurn' }]])
    })

    it('stays locked inside a chain, where declining would leave the chain open', () => {
      // a plant's chain still open under the question (the stack's top is last)
      const chained: PlayerView = { ...asking, pending: [{ kind: 'plant', at: { q: 1, r: 0 }, activated: [{ q: 1, r: 0 }] }, ...asking.pending] }
      expect(endTurnState(true, chained, answers)).toBe('locked')
    })
  })

  it('turns green when the turn is played out, and stays gold with the hints off', () => {
    const { unmount } = render(<PlayerBar view={view} actions={[{ type: 'endTurn' }]} myTurn onAct={() => {}} />)
    expect((screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement).dataset.done).toBe('true')
    unmount()
    render(<PlayerBar view={view} actions={[{ type: 'endTurn' }]} myTurn onAct={() => {}} revealsScoring={false} />)
    expect((screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement).dataset.done).toBeUndefined()
  })
})

describe('TopBar', () => {
  it('shows the opponent card count without showing the cards', () => {
    render(<TopBar view={view} onOpenLog={() => {}} />)
    expect(screen.getByText(/2 cards/)).toBeDefined()
    expect(screen.queryByText(view.you.hand[0].id)).toBeNull()
  })

  // the fixture is seat 0's view, so `current` alone decides the line
  it('says whose turn it is', () => {
    render(<TopBar view={{ ...view, current: 0 }} onOpenLog={() => {}} />)
    expect(screen.getByText('Your turn')).toBeDefined()
  })

  it('says so when it is the opponent turn', () => {
    render(<TopBar view={{ ...view, current: 1 }} onOpenLog={() => {}} />)
    expect(screen.getByText("Opponent's turn")).toBeDefined()
  })

  it('leaves the moves to their pictures and the log: no line of text under the plate', () => {
    render(<TopBar view={view} onOpenLog={() => {}} />)
    expect(screen.queryByText(/Drew/)).toBeNull()
    expect(screen.queryByLabelText('Recent moves')).toBeNull()
  })
})
