import { finalScore, winner } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { HUMAN_SEAT, MACHINE_SEAT } from '../game/seats.js'

export function GameOver({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const result = winner(state)
  const headline =
    result === 'draw' ? 'Shared victory' : result === HUMAN_SEAT ? 'You win' : 'You lose'

  return (
    <div className="game-over" role="dialog" aria-label="Final score">
      <h2>{headline}</h2>
      <dl>
        <dt>You</dt>
        <dd>{finalScore(state, HUMAN_SEAT)}</dd>
        <dt>Machine</dt>
        <dd>{finalScore(state, MACHINE_SEAT)}</dd>
      </dl>
      <button type="button" onClick={onRestart}>
        New game
      </button>
    </div>
  )
}
