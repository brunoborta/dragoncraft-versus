import type { Difficulty } from '@dcv/ai'
import { LEVEL_LABEL } from './DifficultySetup.js'

/**
 * The opponent is a label, not a control: it is chosen before the game starts.
 * Letting it change mid-game would let a losing position be walked back by
 * lowering the difficulty.
 */
export function Controls({
  level,
  seed,
  onUndo,
  canUndo,
}: {
  level: Difficulty | null
  /** Shown so a game can be named, replayed or reported. */
  seed: number
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <div className="controls">
      <p className="level">
        {level ? `Opponent: ${LEVEL_LABEL[level]}` : ''}
        <span className="seed">Seed {seed}</span>
      </p>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  )
}
