import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ANIMATIONS_OFF, MotionRoot, useReducedMotion } from './motion.js'

function Probe() {
  return <p>{useReducedMotion() ? 'still' : 'moving'}</p>
}

describe('motion foundation', () => {
  it('turns animation off under test, so whole matches can be played through the DOM', () => {
    expect(ANIMATIONS_OFF).toBe(true)
  })

  it('reports reduced motion in tests, even where the browser has no matchMedia', () => {
    render(
      <MotionRoot>
        <Probe />
      </MotionRoot>,
    )
    expect(screen.getByText('still')).toBeDefined()
  })
})
