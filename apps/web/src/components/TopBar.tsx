import { bankedReputation } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import { describeLogEntry } from '../game/log.js'

/**
 * Two lines, at a fixed height. The top bar is an `auto` row in the app grid,
 * so a log that grows shrinks the board and moves every hex centre — the same
 * reflow that once turned the two-tap confirm into a mis-tap. Anything longer
 * belongs in the dialog behind "Full log".
 */
const LOG_LINES = 2

/** Whose move it is, said out loud and permanently: the pending stack is shared. */
function turnLine(view: PlayerView): string {
  if (view.phase === 'ended') return 'Game over'
  return view.current === view.seat ? 'Your turn' : "Opponent's turn"
}

export function TopBar({ view, onOpenLog }: { view: PlayerView; onOpenLog: () => void }) {
  const recent = view.log.slice(-LOG_LINES).reverse()

  return (
    <header className="top-bar">
      <p className="turn" aria-live="polite">
        {turnLine(view)}
      </p>
      <p className="opponent">
        Opponent — {view.opponent.handCount} cards, {view.opponent.coins} coins,{' '}
        {bankedReputation(view.opponent)} reputation
      </p>
      <div className="log-row">
        <ol className="log" aria-label="Recent moves">
          {recent.map((entry, index) => (
            <li key={view.log.length - index}>{describeLogEntry(entry, view.seat)}</li>
          ))}
        </ol>
        <button type="button" onClick={onOpenLog}>
          Full log
        </button>
      </div>
    </header>
  )
}
