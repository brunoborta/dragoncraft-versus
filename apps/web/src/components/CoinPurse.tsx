import { STARTING_COINS } from '@dcv/engine'
import { CoinIcon } from './icons.js'

/**
 * Your coins as coins, in the corner of the board (plan 3.3): one per coin
 * held, and each one spent leaves a dashed empty slot where it was. The whole
 * group is the button that spends one.
 *
 * It lives here, and not in the fire-up panel, because the engine lets you
 * spend a coin at any point of your turn before ending it. So it needs a fixed
 * place that is always there, lit when spending is allowed and dim when not —
 * not yet your turn, already spent one this turn, or none left.
 */
export function CoinPurse({ coins, canSpend, onSpend }: { coins: number; canSpend: boolean; onSpend: () => void }) {
  const slots = Math.max(STARTING_COINS, coins)
  return (
    <button type="button" className="coin-purse" disabled={!canSpend} onClick={onSpend}>
      <span className="coin-slots" aria-hidden="true">
        {Array.from({ length: slots }, (_, index) =>
          index < coins ? (
            <CoinIcon key={index} className="coin" />
          ) : (
            <span key={index} className="coin-slot" data-empty="true" />
          ),
        )}
      </span>
      <span className="coin-caption">Spend a coin</span>
    </button>
  )
}
