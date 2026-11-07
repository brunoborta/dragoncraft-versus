import type { Difficulty } from '@dcv/ai'
import { useState } from 'react'
import type { FormEvent } from 'react'

export type Start =
  | { kind: 'computer'; level: Difficulty }
  | { kind: 'create' }
  | { kind: 'join'; pin: string }

export const LEVELS: { value: Difficulty; label: string; blurb: string }[] = [
  { value: 'easy', label: 'Easy', blurb: 'Plays for the same things as Medium, then fumbles about half of them' },
  { value: 'medium', label: 'Medium', blurb: 'Looks a move ahead and plays to bank reputation' },
  { value: 'hard', label: 'Hard', blurb: 'Plans the whole turn, keeps its coins, and watches what the board gives you' },
]

export const LEVEL_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export const PIN_LENGTH = 6

type Step = 'mode' | 'computer' | 'friend' | 'join'

/**
 * The front door, one question per screen: who you are playing, then the
 * detail of that — how hard the machine is, or whether you are opening a
 * game or joining one by PIN. Every screen past the first has a way back.
 *
 * The opponent is fixed once chosen: changing it mid-game would let a losing
 * position be walked back by lowering the difficulty.
 */
export function ModeSetup({ online, onStart }: { online: boolean; onStart: (start: Start) => void }) {
  const [step, setStep] = useState<Step>('mode')
  const [pin, setPin] = useState('')

  const back = (to: Step) => (
    <button type="button" aria-label="Back" onClick={() => setStep(to)}>
      ←
    </button>
  )

  function submitPin(event: FormEvent): void {
    event.preventDefault()
    if (pin.length === PIN_LENGTH) onStart({ kind: 'join', pin })
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Choose your opponent">
        {step === 'mode' ? (
          <>
            <div className="modal-head">
              <h2>Dragoncraft Versus</h2>
            </div>
            <button type="button" className="level-choice" onClick={() => setStep('computer')}>
              <span className="action-name">Against the computer</span>
              <span className="action-effect">Pick a difficulty and play on this device</span>
            </button>
            <button
              type="button"
              className="level-choice"
              disabled={!online}
              onClick={() => setStep('friend')}
            >
              <span className="action-name">Against a player</span>
              <span className="action-effect">
                {online ? 'Play a friend on another device with a PIN' : 'Not available in this build'}
              </span>
            </button>
          </>
        ) : null}

        {step === 'computer' ? (
          <>
            <div className="modal-head">
              <h2>Choose a difficulty</h2>
              {back('mode')}
            </div>
            <p className="modal-note">Fixed for the whole game.</p>
            {LEVELS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className="level-choice"
                onClick={() => onStart({ kind: 'computer', level: entry.value })}
              >
                <span className="action-name">{entry.label}</span>
                <span className="action-effect">{entry.blurb}</span>
              </button>
            ))}
          </>
        ) : null}

        {step === 'friend' ? (
          <>
            <div className="modal-head">
              <h2>Against a player</h2>
              {back('mode')}
            </div>
            <button type="button" className="level-choice" onClick={() => onStart({ kind: 'create' })}>
              <span className="action-name">Create</span>
              <span className="action-effect">Get a PIN to give your friend</span>
            </button>
            <button type="button" className="level-choice" onClick={() => setStep('join')}>
              <span className="action-name">Join</span>
              <span className="action-effect">Enter the PIN your friend gave you</span>
            </button>
          </>
        ) : null}

        {step === 'join' ? (
          <form className="pin-form" onSubmit={submitPin}>
            <div className="modal-head">
              <h2>Join a game</h2>
              {back('friend')}
            </div>
            <label className="modal-note" htmlFor="pin">
              Game PIN
            </label>
            <input
              id="pin"
              className="pin-input"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="000000"
              maxLength={PIN_LENGTH}
              size={PIN_LENGTH}
              value={pin}
              // digits only, whatever the keyboard or a paste brings
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            />
            <button type="submit" className="primary" disabled={pin.length !== PIN_LENGTH}>
              Join
            </button>
          </form>
        ) : null}
      </section>
    </div>
  )
}
