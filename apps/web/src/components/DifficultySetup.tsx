import type { Difficulty } from '@dcv/ai'

export const LEVELS: { value: Difficulty; label: string; blurb: string }[] = [
  { value: 'easy', label: 'Easy', blurb: 'Plays at random, but never passes up a card it can score' },
  { value: 'medium', label: 'Medium', blurb: 'Looks a move ahead and plays to bank reputation' },
]

export const LEVEL_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
}

/**
 * Asked once, before the game starts. Changing opponent mid-game would let a
 * player walk back a losing position by lowering the difficulty, so the choice
 * is made here and shown as a label for the rest of the game.
 */
export function DifficultySetup({ onChoose }: { onChoose: (level: Difficulty) => void }) {
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Choose your opponent">
        <div className="modal-head">
          <h2>Choose your opponent</h2>
        </div>
        <p className="modal-note">Fixed for the whole game.</p>
        {LEVELS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className="level-choice"
            onClick={() => onChoose(entry.value)}
          >
            <span className="action-name">{entry.label}</span>
            <span className="action-effect">{entry.blurb}</span>
          </button>
        ))}
      </section>
    </div>
  )
}
