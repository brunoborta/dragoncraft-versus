import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TABLE_OPTIONS } from '../game/settings.js'
import { scenario } from '../game/tutorial/scenario.js'
import type { Lesson } from '../game/tutorial/script.js'
import { useTutorialTable } from '../game/tutorial/useTutorialTable.js'
import { GameScreen } from './GameScreen.js'

const LESSONS: Lesson[] = [
  {
    id: 'class',
    act: 1,
    build: () => scenario({ held: 'bread', board: { '1,0': ['meat', 'plant', 'iron'] } }),
    steps: [
      { kind: 'do', text: 'Tap the gear.', expect: [{ ui: { kind: 'openSettings' } }] },
      { kind: 'do', text: 'Close it.', expect: [{ ui: { kind: 'closeSettings' } }] },
      { kind: 'do', text: 'Open the stack.', expect: [{ ui: { kind: 'inspect', hex: '1,0' } }] },
      { kind: 'say', text: 'Well done.' },
    ],
  },
]

function Harness() {
  const tutorial = useTutorialTable(() => {}, LESSONS)
  if (!tutorial.table.view) return null
  return (
    <>
      <p data-testid="line">{tutorial.step && tutorial.step.kind !== 'play' ? tutorial.step.text : ''}</p>
      <GameScreen
        key={tutorial.lessonKey}
        table={tutorial.table}
        view={tutorial.table.view}
        label=""
        detail=""
        restartLabel="Leave"
        onRestart={() => {}}
        options={DEFAULT_TABLE_OPTIONS}
        opponentName="Professor Maple"
        onUi={tutorial.ui}
        openingBanner={false}
      />
    </>
  )
}

describe('the game screen in the tutorial', () => {
  it("puts Maple's name on the opponent's plate", () => {
    render(<Harness />)
    expect(screen.getByRole('region', { name: 'Professor Maple' })).toBeTruthy()
  })

  it('tells the tutorial when the settings open and close, and when a stack is opened', () => {
    render(<Harness />)
    const line = () => screen.getByTestId('line').textContent
    expect(line()).toBe('Tap the gear.')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(line()).toBe('Close it.')
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(line()).toBe('Open the stack.')
    fireEvent.click(screen.getByRole('button', { name: /^1,0:/ }))
    expect(line()).toBe('Well done.')
  })

  it('marks spaces and cards for the spotlight to find', () => {
    const { container } = render(<Harness />)
    expect(container.querySelector('[data-hex="1,0"]')).toBeTruthy()
    expect(container.querySelector('[data-coach="settings"]')).toBeTruthy()
  })
})
