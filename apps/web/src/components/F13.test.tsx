import type { LogEntry } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_GAME_OPTIONS, DEFAULT_TABLE_OPTIONS, tableOptionsOf } from '../game/settings.js'
import { PACE, firstOfTurn } from '../game/useOpponent.js'
import { HelpDialog } from './HelpDialog.js'
import { OptionsForm } from './OptionsForm.js'
import { OpponentThinking } from './Prompt.js'

const e = (seat: 0 | 1, action: LogEntry['action']): LogEntry => ({ seat, action })

describe("the machine's pace", () => {
  it('knows the start of its turn: nothing done yet but the draw', () => {
    const log = [e(0, { type: 'endTurn' }), e(1, { type: 'draw', token: { kind: 'single', type: 'meat' } })]
    expect(firstOfTurn(log, 1)).toBe(true)
    expect(firstOfTurn([...log, e(1, { type: 'place', at: { q: 0, r: 0 } })], 1)).toBe(false)
  })

  it('thinks longest before its first move, and barely at all when told not to', () => {
    expect(PACE.thinking.first).toBeGreaterThan(PACE.thinking.next)
    expect(PACE.instant.first).toBeLessThan(PACE.thinking.next)
  })

  it('is a local option: it never goes to a server', () => {
    expect(DEFAULT_GAME_OPTIONS.opponentThinks).toBe(true)
    expect(tableOptionsOf(DEFAULT_GAME_OPTIONS)).toEqual(DEFAULT_TABLE_OPTIONS)
  })

  it('is offered only where there is a machine', () => {
    const { unmount } = render(<OptionsForm options={DEFAULT_GAME_OPTIONS} onChange={() => {}} />)
    expect(screen.getByLabelText(/The machine takes its time/)).toBeDefined()
    unmount()
    render(<OptionsForm options={DEFAULT_TABLE_OPTIONS} onChange={() => {}} />)
    expect(screen.queryByLabelText(/The machine takes its time/)).toBeNull()
  })
})

describe('the panel while the screen catches up', () => {
  it("says the opponent is playing while its moves land, in wine", () => {
    const { container } = render(<OpponentThinking mode="playing" />)
    expect(screen.getByText('Opponent is playing…')).toBeDefined()
    expect(container.querySelector('.prompt')?.getAttribute('data-side')).toBe('opponent')
  })

  it('says your token is on its way, in your colours, before the token itself is shown', () => {
    const { container } = render(<OpponentThinking mode="drawing" />)
    expect(screen.getByText('Drawing from the bag…')).toBeDefined()
    expect(container.querySelector('.prompt')?.getAttribute('data-side')).toBe('you')
  })
})

describe('help', () => {
  it('lists all six tokens with what they do, and closes', () => {
    const onClose = vi.fn()
    render(<HelpDialog onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'How to play' }).querySelectorAll('.help-tokens li')).toHaveLength(6)
    fireEvent.click(screen.getByLabelText('Close help'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
