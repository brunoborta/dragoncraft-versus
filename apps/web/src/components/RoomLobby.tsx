import { useState } from 'react'

/**
 * The creator's screen until the second player arrives: the PIN, big, to be
 * read out or sent. Copying can fail (no clipboard permission), and that is
 * fine — the number is on screen.
 */
export function RoomLobby({ pin, onLeave }: { pin: string | null; onLeave: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    if (!pin) return
    try {
      await navigator.clipboard.writeText(pin)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Waiting for a player">
        <div className="modal-head">
          <h2>{pin ? 'Game PIN' : 'Connecting…'}</h2>
        </div>
        {pin ? (
          <>
            <p className="pin" aria-label="Game PIN">
              {pin.slice(0, 3)} {pin.slice(3)}
            </p>
            <p className="modal-note">Your friend picks Against a player, then Join, and types this PIN.</p>
            <button type="button" onClick={copy}>
              {copied ? 'Copied' : 'Copy PIN'}
            </button>
            <p className="modal-note" aria-live="polite">
              Waiting for your friend…
            </p>
          </>
        ) : (
          <p className="modal-note" aria-live="polite">
            Talking to the server…
          </p>
        )}
        <button type="button" onClick={onLeave}>
          Cancel
        </button>
      </section>
    </div>
  )
}
