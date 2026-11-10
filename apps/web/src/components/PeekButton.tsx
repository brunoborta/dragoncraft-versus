import { EyeIcon } from './icons.js'

/**
 * The eye (as in Slay the Spire): puts a choice aside to look at the board and
 * the hand, and the only way on is back to the choice. One button for every
 * dialog that has to be finished — the crystal's pick, the coin's cards — in
 * the same place: centred on the dialog's top edge, outside the dialog
 * itself, where the eye goes first.
 */
export function PeekButton({ onPeek }: { onPeek: () => void }) {
  return (
    <button type="button" className="peek-button" onClick={onPeek} aria-label="Look at the board" title="Look at the board">
      <EyeIcon />
    </button>
  )
}
