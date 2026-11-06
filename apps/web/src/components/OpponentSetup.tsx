import type { Difficulty } from '@dcv/ai'

export type OpponentChoice = Difficulty | 'online'

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

/**
 * Asked once, before the game starts. Changing opponent mid-game would let a
 * player walk back a losing position by lowering the difficulty, so the choice
 * is made here and shown as a label for the rest of the game.
 *
 * A friend over the internet is one more entry in the same list, shown only
 * when the site was built with a server to talk to.
 */
export function OpponentSetup({
  online,
  onChoose,
}: {
  online: boolean
  onChoose: (choice: OpponentChoice) => void
}) {
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
        {online ? (
          <button type="button" className="level-choice" onClick={() => onChoose('online')}>
            <span className="action-name">A friend online</span>
            <span className="action-effect">Share a link; the first to open it sits across from you</span>
          </button>
        ) : null}
      </section>
    </div>
  )
}
