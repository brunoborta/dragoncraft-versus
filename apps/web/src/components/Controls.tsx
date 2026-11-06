/**
 * Who you are playing and where, as labels, not controls: the opponent is
 * chosen before the game starts. Letting it change mid-game would let a
 * losing position be walked back by lowering the difficulty.
 */
export function Controls({
  label,
  detail,
  onUndo,
  canUndo,
}: {
  /** "Opponent: Medium", or empty before the choice is made. */
  label: string
  /** The seed against the machine, the room code online: what names this game. */
  detail: string
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <div className="controls">
      <p className="level">
        {label}
        <span className="seed">{detail}</span>
      </p>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  )
}
