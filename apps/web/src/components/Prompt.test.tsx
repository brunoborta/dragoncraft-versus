import { DECK, createGame, dual, single, toPlayerView } from '@dcv/engine'
import type { Action, Pending, PlayerView, ShopCard } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
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
  it('names the token being placed, glyph and word both', () => {
    const view = staged({ kind: 'place', token: single('meat'), fireUpAllowed: true })
    const { container } = render(<Prompt view={view} actions={[]} selected={null} onAct={() => {}} />)
    const text = container.querySelector('.prompt-text')
    expect(text?.textContent).toContain('Choose where to place the token')
    expect(text?.textContent).toContain('Meat')
    expect(text?.querySelectorAll('.token-chip svg')).toHaveLength(1)
  })

  it('says what the token being placed would do if fired up', () => {
    const view = staged({ kind: 'place', token: single('crystal'), fireUpAllowed: true })
    const { container } = render(<Prompt view={view} actions={[]} selected={null} onAct={() => {}} />)
    expect(container.querySelector('.prompt-text')?.textContent).toContain(
      'Draw 3, keep 1, place it without firing up',
    )
  })

  it('says what each of a dual token two abilities would do, naming both', () => {
    const view = staged({ kind: 'place', token: dual('meat', 'plant'), fireUpAllowed: true })
    const { container } = render(<Prompt view={view} actions={[]} selected={null} onAct={() => {}} />)
    const effects = [...container.querySelectorAll('.prompt-effect')].map((el) => el.textContent)
    expect(effects).toEqual([
      'Meat: Move one neighbour anywhere',
      "Plant: Use a neighbour's ability",
    ])
  })

  it('says what a fire-up button would do, under its name', () => {
    const view = staged({ kind: 'mayFireUp', at: { q: 0, r: 0 } })
    const actions: Action[] = [{ type: 'fireUp', ability: 'iron' }, { type: 'skipFireUp' }]
    const { container } = render(<Prompt view={view} actions={actions} selected={null} onAct={() => {}} />)
    const first = container.querySelector('.prompt-actions button')
    expect(first?.querySelector('.action-name')?.textContent).toBe('Fire up Iron')
    expect(first?.querySelector('.action-effect')?.textContent).toBe(
      'Move up to two neighbours one space each',
    )
  })

  it('names no hex coordinate on a plant target button', () => {
    const at = { q: 1, r: 0 }
    const view = staged({ kind: 'plant', at: { q: 0, r: 0 } })
    const actions: Action[] = [
      { type: 'plantTarget', at, ability: 'potion' },
      { type: 'plantTarget', at, ability: 'plant' },
    ]
    const { container } = render(<Prompt view={view} actions={actions} selected={at} onAct={() => {}} />)
    const labels = [...container.querySelectorAll('.prompt-actions .action-name')].map((el) => el.textContent)
    expect(labels).toEqual(['Use Potion', 'Use Plant'])
    expect(container.textContent).not.toMatch(/\d,-?\d/)
  })

  it('names each of the three tokens crystal drew instead of numbering them', () => {
    const tokens = [single('bread'), dual('iron', 'potion'), single('plant')]
    const view = staged({ kind: 'crystalPick', tokens })
    const actions: Action[] = tokens.map((_, index) => ({ type: 'crystalPick', index }))
    const { container } = render(<Prompt view={view} actions={actions} selected={null} onAct={() => {}} />)

    // the glyph's symbol sits inside the button too, hence the loose match
    const labels = [...container.querySelectorAll('.prompt-actions button')].map((b) => b.textContent)
    expect(labels).toHaveLength(3)
    expect(labels[0]).toMatch(/^Keep .*Bread$/)
    expect(labels[1]).toMatch(/^Keep .*Iron\/Potion$/)
    expect(labels[2]).toMatch(/^Keep .*Plant$/)
    expect(screen.queryByText(/Keep token/)).toBeNull()
    expect(container.querySelectorAll('.prompt-actions .token-chip svg')).toHaveLength(3)
  })

  it('names the two cards each discard button would return', () => {
    const hand = [card('line-bread'), card('tri-plant'), card('line-iron'), card('tri-meat')]
    const view = staged({ kind: 'coinDiscard' }, hand)
    const actions: Action[] = [
      { type: 'coinDiscard', cardIds: [hand[0].id, hand[1].id] },
      { type: 'coinDiscard', cardIds: [hand[2].id, hand[3].id] },
    ]
    const { container } = render(<Prompt view={view} actions={actions} selected={null} onAct={() => {}} />)

    const labels = [...container.querySelectorAll('.prompt-actions button')].map((b) => b.textContent)
    expect(labels).toEqual([
      `Return ${cardName(hand[0])} + ${cardName(hand[1])}`,
      `Return ${cardName(hand[2])} + ${cardName(hand[3])}`,
    ])
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('OpponentThinking', () => {
  it('holds the decision slot with no instruction and no buttons', () => {
    const { container } = render(<OpponentThinking />)
    expect(screen.getByText('Opponent is thinking…')).toBeDefined()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
