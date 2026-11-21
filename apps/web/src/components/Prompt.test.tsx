import { DECK, createGame, dual, single, toPlayerView } from '@dcv/engine'
import type { Action, Pending, PlayerView, ShopCard } from '@dcv/engine'
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cardName } from '../game/labels.js'
import { OpponentThinking, Prompt } from './Prompt.js'

const base = toPlayerView(createGame(2), 0)

const card = (id: string): ShopCard => {
  const found = DECK.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

function staged(pending: Pending, hand: ShopCard[] = base.you.hand): PlayerView {
  return { ...base, pending: [pending], you: { ...base.you, hand } }
}

describe('Prompt', () => {
  it('leaves End turn, Spend a coin and the fire-up to their own places', () => {
    const view = staged({ kind: 'mayFireUp', at: { q: 0, r: 0 } })
    const actions: Action[] = [
      { type: 'fireUp', ability: 'meat' },
      { type: 'skipFireUp' },
      { type: 'spendCoin' },
      { type: 'endTurn' },
    ]
    const { container } = render(<Prompt view={view} actions={actions} onAct={() => {}} />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('.prompt-text')?.textContent).toBe('Fire up this token?')
  })

  it('is one line while placing: the question, without the token or what it does', () => {
    const view = staged({ kind: 'place', token: dual('meat', 'plant'), fireUpAllowed: true })
    const { container } = render(<Prompt view={view} actions={[]} onAct={() => {}} />)
    expect(container.querySelector('.prompt-text')?.textContent).toBe('Choose where to place the token')
    expect(container.textContent).not.toContain('Move one neighbour anywhere')
  })

  it("leaves a plant's borrowing to the fires over the neighbour", () => {
    const at = { q: 1, r: 0 }
    const view = staged({ kind: 'plant', at: { q: 0, r: 0 }, activated: [{ q: 0, r: 0 }] })
    const actions: Action[] = [
      { type: 'plantTarget', at, ability: 'potion' },
      { type: 'plantTarget', at, ability: 'plant' },
    ]
    const { container } = render(<Prompt view={view} actions={actions} onAct={() => {}} />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('.prompt-text')?.textContent).toBe('Use a neighbouring ability')
  })

  it("leaves the crystal's pick to the arch of tokens over the board, keeping only the question", () => {
    const tokens = [single('bread'), dual('iron', 'potion'), single('plant')]
    const view = staged({ kind: 'crystalPick', tokens })
    const actions: Action[] = tokens.map((_, index) => ({ type: 'crystalPick', index }))
    const { container } = render(<Prompt view={view} actions={actions} onAct={() => {}} />)

    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('.prompt-text')?.textContent).toBe('Choose a token to keep')
  })

  it('leaves the discard to the cards, carrying only the confirmation', () => {
    const hand = [card('line-bread'), card('tri-plant'), card('line-iron'), card('tri-meat')]
    const view = staged({ kind: 'coinDiscard' }, hand)
    // the bar is handed the confirming action only once two cards are marked
    const actions: Action[] = [{ type: 'coinDiscard', cardIds: [hand[0].id, hand[1].id] }]
    const { container } = render(<Prompt view={view} actions={actions} onAct={() => {}} />)

    const labels = [...container.querySelectorAll('.prompt-actions button')].map((b) => b.textContent)
    expect(labels).toEqual(['Keep these'])
    expect(container.textContent).not.toContain(cardName(hand[0]))
  })
})

describe('OpponentThinking', () => {
  it('says when the opponent spent a coin and is choosing cards', () => {
    render(<OpponentThinking mode="thinking" name="Professor Maple" />)
    expect(screen.getByText('Professor Maple is thinking…')).toBeDefined()
    cleanup()
    render(<OpponentThinking mode="choosingCards" />)
    expect(screen.getByText('Opponent spent a coin and is choosing cards…')).toBeDefined()
  })

  it("says when the opponent's crystal has them choosing a token", () => {
    render(<OpponentThinking mode="choosingToken" />)
    expect(screen.getByText('Opponent is choosing a token to keep…')).toBeDefined()
  })

  it('holds the decision slot with no instruction and no buttons', () => {
    const { container } = render(<OpponentThinking />)
    expect(screen.getByText('Opponent is thinking…')).toBeDefined()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
