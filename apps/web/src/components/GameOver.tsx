import { finalScore, winner } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { HUMAN_SEAT } from '../game/seats.js'

export function GameOver({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const result = winner(state)
  const headline =
    result === 'draw' ? 'Shared victory' : result === HUMAN_SEAT ? 'You win' : 'You lose'

  return (
    <div className="game-over" role="dialog" aria-label="Final score">
      <h2>{headline}</h2>
      <dl>
        <dt>You</dt>
        <dd>{finalScore(state, 0)}</dd>
        <dt>Machine</dt>
        <dd>{finalScore(state, 1)}</dd>
      </dl>
      <button type="button" onClick={onRestart}>
        New game
      </button>
    </div>
  )
}
