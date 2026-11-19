import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOLD_TO_CONFIRM_MS, HoldButton } from './HoldButton.js'

describe('HoldButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const button = () => screen.getByRole('button', { name: 'Hold to give up' })

  it('acts once held for the whole time, with the ring growing meanwhile', () => {
    const onConfirm = vi.fn()
    render(<HoldButton onConfirm={onConfirm}>Hold to give up</HoldButton>)

    fireEvent.pointerDown(button(), { button: 0 })
    expect(button().hasAttribute('data-holding')).toBe(true)
    act(() => vi.advanceTimersByTime(HOLD_TO_CONFIRM_MS - 1))
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(button().hasAttribute('data-holding')).toBe(false)
  })

  it('does nothing when let go, or slid off, too soon', () => {
    const onConfirm = vi.fn()
    render(<HoldButton onConfirm={onConfirm}>Hold to give up</HoldButton>)

    fireEvent.pointerDown(button(), { button: 0 })
    act(() => vi.advanceTimersByTime(HOLD_TO_CONFIRM_MS / 2))
    fireEvent.pointerUp(button())
    fireEvent.pointerDown(button(), { button: 0 })
    act(() => vi.advanceTimersByTime(HOLD_TO_CONFIRM_MS / 2))
    fireEvent.pointerLeave(button())
    act(() => vi.advanceTimersByTime(HOLD_TO_CONFIRM_MS * 2))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('ignores a plain click', () => {
    const onConfirm = vi.fn()
    render(<HoldButton onConfirm={onConfirm}>Hold to give up</HoldButton>)
    fireEvent.click(button())
    act(() => vi.advanceTimersByTime(HOLD_TO_CONFIRM_MS * 2))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('can be held from the keyboard', () => {
    const onConfirm = vi.fn()
    render(<HoldButton onConfirm={onConfirm}>Hold to give up</HoldButton>)
    fireEvent.keyDown(button(), { key: ' ' })
    act(() => vi.advanceTimersByTime(HOLD_TO_CONFIRM_MS))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
