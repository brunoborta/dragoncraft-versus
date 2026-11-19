import type { GameOptions, TableOptions } from '../game/settings.js'
import { HoldButton } from './HoldButton.js'
import { OptionsForm } from './OptionsForm.js'

/**
 * The table's options during a game. Against the machine they can still be
 * changed; online they are the host's choice for both players, shown but not
 * editable (no `onChange`). Giving up lives here too, out of the way of the
 * buttons used every turn, and only happens when held.
 */
export function SettingsDialog({
  options,
  onChange,
  onForfeit,
  onClose,
}: {
  options: TableOptions | GameOptions
  onChange?: (next: GameOptions) => void
  /** Present while the game is on. */
  onForfeit?: () => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop menu-backdrop" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>
        {onChange ? null : <p className="modal-note">Chosen by whoever opened this game, for both players.</p>}
        <OptionsForm options={options as GameOptions} onChange={onChange} />
        {onForfeit ? (
          <div className="forfeit">
            <HoldButton onConfirm={onForfeit}>Hold to give up</HoldButton>
            <p className="modal-note">The game ends here and the other side wins.</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
