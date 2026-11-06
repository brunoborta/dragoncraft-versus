import { finalScore, winnerOfView } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'

export function GameOver({
  view,
  opponentLabel,
  restartLabel,
  onRestart,
}: {
  view: PlayerView
  opponentLabel: string
  restartLabel: string
  onRestart: () => void
}) {
  const result = winnerOfView(view)
  const headline = result === 'draw' ? 'Shared victory' : result === view.seat ? 'You win' : 'You lose'

  return (
    <div className="game-over" role="dialog" aria-label="Final score">
      <h2>{headline}</h2>
      <dl>
        <dt>You</dt>
        <dd>{finalScore(view.you)}</dd>
        <dt>{opponentLabel}</dt>
        <dd>{finalScore(view.opponent)}</dd>
      </dl>
      <button type="button" onClick={onRestart}>
        {restartLabel}
      </button>
    </div>
  )
}
