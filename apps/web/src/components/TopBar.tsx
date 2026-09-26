import { scoreOf } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import { describeLogEntry } from '../game/log.js'

const LOG_LINES = 4

/** Whose move it is, said out loud and permanently: the pending stack is shared. */
function turnLine(view: PlayerView): string {
  if (view.phase === 'ended') return 'Game over'
  return view.current === view.seat ? 'Your turn' : "Opponent's turn"
}

export function TopBar({ view }: { view: PlayerView }) {
  const recent = view.log.slice(-LOG_LINES).reverse()

  return (
    <header className="top-bar">
      <p className="turn" aria-live="polite">
        {turnLine(view)}
      </p>
      <p className="opponent">
        Opponent — {view.opponent.handCount} cards, {view.opponent.coins} coins,{' '}
        {scoreOf(view.opponent)} reputation
      </p>
      <ol className="log" aria-label="Recent moves">
        {recent.map((entry, index) => (
          <li key={view.log.length - index}>{describeLogEntry(entry)}</li>
        ))}
      </ol>
    </header>
  )
}
