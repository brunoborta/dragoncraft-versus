import { useState } from 'react'

/**
 * The first player's screen until the second arrives. The link is the whole
 * invitation: there is no account to make and no code to type, only this to
 * send. Copying can fail (no clipboard permission, an old browser), so the
 * link is also on screen, selectable.
 */
export function RoomLobby({ link, onLeave }: { link: string | null; onLeave: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Invite a friend">
        <div className="modal-head">
          <h2>Invite a friend</h2>
        </div>
        {link ? (
          <>
            <p className="modal-note">Send this link. Whoever opens it first sits across from you.</p>
            <p className="room-link" aria-label="Room link">
              {link}
            </p>
            <button type="button" className="primary" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <p className="modal-note" aria-live="polite">
              Waiting for your friend…
            </p>
          </>
        ) : (
          <p className="modal-note" aria-live="polite">
            Opening a room…
          </p>
        )}
        <button type="button" onClick={onLeave}>
          Back to menu
        </button>
      </section>
    </div>
  )
}
