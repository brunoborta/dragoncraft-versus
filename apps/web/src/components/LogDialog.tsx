import type { PlayerView } from '@dcv/engine'
import { groupRounds } from '../game/log.js'

/**
 * The whole history, newest turn first. The top bar can only hold a couple of
 * lines without growing and shrinking the board, and a single opponent turn is
 * longer than that — so reading what actually happened needs its own surface.
 */
export function LogDialog({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  // newest round first, but the two turns inside one read in the order played
  const rounds = groupRounds(view.log, view.seat).reverse()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Move log"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Move log</h2>
          <button type="button" onClick={onClose} aria-label="Close log">
            ✕
          </button>
        </div>
        <ol className="log-rounds">
          {rounds.map((round) => (
            <li key={round.number}>
              <p className="log-round">Round {round.number}</p>
              <ol className="log-turns">
                {round.turns.map((turn) => (
                  <li key={turn.at}>
                    <p className="log-who">{turn.who}</p>
                    <ul>
                      {turn.lines.map((line, index) => (
                        <li key={`${turn.at}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
