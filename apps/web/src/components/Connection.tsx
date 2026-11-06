import type { TableStatus } from '../game/table.js'

/**
 * A line under the board about the wire, shown only when there is something
 * to say. Silence is the normal case.
 */
export function Connection({ status, opponentConnected }: { status: TableStatus; opponentConnected: boolean }) {
  if (status.kind === 'connecting') {
    return (
      <p className="connection" role="status">
        Reconnecting…
      </p>
    )
  }
  if (status.kind === 'playing' && !opponentConnected) {
    return (
      <p className="connection" role="status">
        Your friend disconnected. Waiting for them to come back…
      </p>
    )
  }
  return null
}

export function Closed({ reason, onLeave }: { reason: string; onLeave: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Game closed">
        <div className="modal-head">
          <h2>This game is over</h2>
        </div>
        <p className="modal-note">{reason}</p>
        <button type="button" className="primary" onClick={onLeave}>
          Back to menu
        </button>
      </section>
    </div>
  )
}
