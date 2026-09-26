import { createGame, toPlayerView } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Hand } from './Hand.js'
import { TopBar } from './TopBar.js'

const view = toPlayerView(createGame(1), 0)

describe('Hand', () => {
  it('shows both cards in hand', () => {
    const { container } = render(<Hand view={view} actions={[]} onAct={() => {}} />)
    expect(container.querySelectorAll('.card')).toHaveLength(2)
  })

  it('shows your coins', () => {
    render(<Hand view={view} actions={[]} onAct={() => {}} />)
    expect(screen.getByText(/3 coins/)).toBeDefined()
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

  it('shows the most recent log line', () => {
    render(<TopBar view={view} onOpenLog={() => {}} />)
    expect(screen.getByText(/Drew/)).toBeDefined()
  })
})
