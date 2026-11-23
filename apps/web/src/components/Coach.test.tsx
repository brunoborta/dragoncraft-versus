import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Step } from '../game/tutorial/script.js'
import { Coach, SETTLE_MS, SPOT_PATIENCE, ribbonTop } from './Coach.js'

const say: Step = { kind: 'say', text: 'Hello, apprentice.' }
const doIt: Step = { kind: 'do', text: 'Tap the gear.', spots: ['.gear'], expect: [{ ui: { kind: 'openSettings' } }] }

function coach(props: Partial<Parameters<typeof Coach>[0]> = {}) {
  const handlers = { onNext: vi.fn(), onSkip: vi.fn(), onPlay: vi.fn(), onMenu: vi.fn() }
  render(<Coach act={1} step={say} busy={false} {...handlers} {...props} />)
  return handlers
}

describe('Coach', () => {
  it("says Maple's line and goes on with a tap anywhere", () => {
    const { onNext } = coach()
    expect(screen.getByText('Hello, apprentice.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('coach-catcher'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('does not go on by a tap when something is to be done: Next waits for it', () => {
    vi.useFakeTimers()
    const { onNext } = coach({ step: doIt })
    // the gear is not on this test's page: the line waits for it, then speaks anyway
    act(() => vi.advanceTimersByTime(SPOT_PATIENCE + 1))
    vi.useRealTimers()
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('coach-catcher'))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('heads the line with its chapter and page', () => {
    coach({ act: 2, page: { chapter: { number: 4, title: 'Main Course' }, page: 2, pages: 7 } })
    expect(screen.getByText('Ch. 4 · Main Course')).toBeTruthy()
    expect(screen.getByText('2/7')).toBeTruthy()
  })

  it('goes back a page, unless there is none', () => {
    const onBack = vi.fn()
    coach({ canBack: true, onBack })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('keeps Back off on the first page, and a tap on it never moves the line on', () => {
    const { onNext } = coach({ canBack: false })
    const back = screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement
    expect(back.disabled).toBe(true)
    fireEvent.click(back)
    expect(onNext).not.toHaveBeenCalled()
  })

  it("shows a chapter's card, and a tap puts it away", () => {
    const onDismissCard = vi.fn()
    coach({ busy: true, card: { number: 4, title: 'Main Course' }, onDismissCard })
    expect(screen.getByText('Chapter 4')).toBeTruthy()
    fireEvent.click(screen.getByText('Main Course'))
    expect(onDismissCard).toHaveBeenCalledOnce()
  })

  it('stands Maple in the pose of his line, explaining when it names none', () => {
    const { container, unmount } = render(
      <Coach act={1} step={{ kind: 'say', text: 'Cards!', pose: 'cards' }} busy={false} onNext={() => {}} onSkip={() => {}} onPlay={() => {}} onMenu={() => {}} />,
    )
    expect(container.querySelector('[data-pose]')?.getAttribute('data-pose')).toBe('cards')
    unmount()
    const plain = coach()
    expect(plain).toBeDefined()
    expect(document.querySelector('[data-pose]')?.getAttribute('data-pose')).toBe('explaining')
  })

  it('welcomes at dessert', () => {
    coach({ act: 3, step: null })
    expect(document.querySelector('[data-pose]')?.getAttribute('data-pose')).toBe('welcoming')
  })

  it('leaves the screen as the player sees it on a clear line: no shade, no ring, the ribbon still there', () => {
    vi.useFakeTimers()
    const { onNext } = coach({ step: { kind: 'say', text: 'Look at both.', clear: true, spots: ['.gear'] } })
    act(() => vi.advanceTimersByTime(SPOT_PATIENCE + 1))
    vi.useRealTimers()
    expect(document.querySelector('.coach-shade')).toBeNull()
    expect(document.querySelector('.coach-ring')).toBeNull()
    expect(screen.getByText('Look at both.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('coach-catcher'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('darkens nothing where the game already shows what to do, and still lets a tap through only there', () => {
    const button = document.createElement('button')
    button.className = 'ok'
    button.getBoundingClientRect = () => ({ left: 100, top: 100, width: 40, height: 40 }) as DOMRect
    document.body.append(button)
    coach({ act: 2, step: { kind: 'do', text: 'End your turn.', spots: ['.ok'], clear: true, expect: [{ action: { type: 'endTurn' } }] } })
    expect(document.querySelector('.coach-shade')).toBeNull()
    expect(document.querySelector('.coach-ring')).toBeNull()
    // the blocking cells are still there, around the one gap
    expect(document.querySelectorAll('.coach-catcher-holes rect').length).toBeGreaterThan(0)
    button.remove()
  })

  it('darkens nothing on a line of the lessons with nothing to point at', () => {
    coach({ act: 2, step: { kind: 'say', text: 'Two tokens, one turn.' } })
    expect(document.querySelector('.coach-shade')).toBeNull()
  })

  it('heads the warm-up offer as Dessert', () => {
    coach({ act: 3, step: null })
    expect(screen.getByText('Dessert')).toBeTruthy()
  })

  it('asks before leaving, and leaves on Yes', () => {
    const { onSkip, onNext } = coach()
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(onNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    expect(onSkip).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('offers the warm-up game once the lessons are over', () => {
    const { onPlay, onMenu } = coach({ act: 3, step: null })
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }))
    expect(onPlay).toHaveBeenCalledOnce()
    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('waits for what a line lights to be there, and speaks anyway after a moment', () => {
    vi.useFakeTimers()
    coach({ step: { kind: 'say', text: 'Look at the gear.', spots: ['.gear'] } })
    expect(screen.queryByText('Look at the gear.')).toBeNull()
    act(() => vi.advanceTimersByTime(SPOT_PATIENCE + 1))
    expect(screen.getByText('Look at the gear.')).toBeTruthy()
    vi.useRealTimers()
  })

  it('waits while the game is still animating', () => {
    coach({ busy: true })
    expect(screen.queryByText('Hello, apprentice.')).toBeNull()
  })

  it('speaks only once the screen has been still a moment, so a banner a frame late does not flash it', () => {
    vi.useFakeTimers()
    const props = { act: 2 as const, step: say, onNext: () => {}, onSkip: () => {}, onPlay: () => {}, onMenu: () => {} }
    const { rerender } = render(<Coach {...props} busy />)
    rerender(<Coach {...props} busy={false} />)
    expect(screen.queryByText('Hello, apprentice.')).toBeNull()
    rerender(<Coach {...props} busy />)
    act(() => vi.advanceTimersByTime(SETTLE_MS + 1))
    expect(screen.queryByText('Hello, apprentice.')).toBeNull()
    rerender(<Coach {...props} busy={false} />)
    act(() => vi.advanceTimersByTime(SETTLE_MS + 1))
    expect(screen.getByText('Hello, apprentice.')).toBeTruthy()
    vi.useRealTimers()
  })

  it('shows nothing during a move of his own: no line, no shade, no ring', () => {
    coach({ act: 2, step: { kind: 'play', action: { type: 'endTurn' }, spots: ['.gear'] } })
    expect(screen.queryByRole('region', { name: 'Professor Maple' })).toBeNull()
    expect(document.querySelector('.coach-shade')).toBeNull()
    expect(document.querySelector('.coach-ring')).toBeNull()
    expect(screen.queryByTestId('coach-catcher')).toBeNull()
  })
})

describe('ribbonTop', () => {
  const screenHeight = 860
  it('stands in the middle of the class when nothing lit is there', () => {
    expect(ribbonTop([], 1, 200, screenHeight, 70)).toBe(330)
  })
  it('moves to the foot of the screen when the middle is lit', () => {
    expect(ribbonTop([{ x: 0, y: 300, w: 100, h: 200 }], 1, 200, screenHeight, 70)).toBe(644)
  })
  it('goes to the top when the middle and the foot are both lit', () => {
    const holes = [
      { x: 0, y: 300, w: 100, h: 200 },
      { x: 0, y: 700, w: 100, h: 100 },
    ]
    expect(ribbonTop(holes, 1, 200, screenHeight, 70)).toBe(16)
  })
  it('hangs under the plate in the lessons, unless that hides the spot', () => {
    expect(ribbonTop([], 2, 90, screenHeight, 70)).toBe(70)
    expect(ribbonTop([{ x: 0, y: 100, w: 50, h: 50 }], 2, 90, screenHeight, 70)).toBe(754)
  })
})
