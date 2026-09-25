import type { PlayerView } from '@dcv/engine'
import { describeLogEntry } from '../game/log.js'
import { reputationOf } from './Hand.js'

const LOG_LINES = 4

export function TopBar({ view }: { view: PlayerView }) {
  const recent = view.log.slice(-LOG_LINES).reverse()

  return (
    <header className="top-bar">
      <p className="opponent">
        Opponent — {view.opponent.handCount} cards, {view.opponent.coins} coins,{' '}
        {reputationOf(view.opponent.scored) + view.opponent.coins} reputation
      </p>
      <ol className="log" aria-label="Recent moves">
        {recent.map((entry, index) => (
          <li key={view.log.length - index}>{describeLogEntry(entry)}</li>
        ))}
      </ol>
    </header>
  )
}
