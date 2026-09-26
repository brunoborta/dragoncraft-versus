import type { Difficulty } from '@dcv/ai'
import { LEVEL_LABEL } from './DifficultySetup.js'

/**
 * The opponent is a label, not a control: it is chosen before the game starts.
 * Letting it change mid-game would let a losing position be walked back by
 * lowering the difficulty.
 */
export function Controls({
  level,
  onUndo,
  canUndo,
}: {
  level: Difficulty | null
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <div className="controls">
      <p className="level">{level ? `Opponent: ${LEVEL_LABEL[level]}` : ''}</p>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  )
}
