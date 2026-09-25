import type { Difficulty } from '@dcv/ai'

const LEVELS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
]

export function Controls({
  level,
  onLevel,
  onUndo,
  canUndo,
}: {
  level: Difficulty
  onLevel: (level: Difficulty) => void
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <div className="controls">
      <label>
        Opponent
        <select value={level} onChange={(event) => onLevel(event.target.value as Difficulty)}>
          {LEVELS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  )
}
