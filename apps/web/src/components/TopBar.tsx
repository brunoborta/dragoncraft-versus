import { bankedReputation } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import { describeLogEntry } from '../game/log.js'
import { useCountUp } from '../game/useCountUp.js'
import { Avatar } from './Avatar.js'
import { CardIcon, CoinIcon, GearIcon, HelpIcon, LogIcon, StarIcon } from './icons.js'

/**
 * One line, at a fixed height. The top bar is an `auto` row in the app grid,
 * so a log that grows shrinks the board and moves every hex centre — the same
 * reflow that once turned the two-tap confirm into a mis-tap. Anything longer
 * belongs in the dialog behind the log button.
 */
const LOG_LINES = 1

/** Whose move it is, said out loud: the pending stack is shared. */
function turnLine(view: PlayerView): string {
  if (view.phase === 'ended') return 'Game over'
  return view.current === view.seat ? 'Your turn' : "Opponent's turn"
}

/**
 * A number with an icon, as on the plates: the icon and figure are what the eye
 * reads, the hidden phrase ("3 coins") is what a screen reader says.
 */
export function Stat({
  icon,
  value,
  phrase,
  countUp,
}: {
  icon: React.ReactNode
  value: number
  phrase: string
  /** Count up to a higher value after this many ms (reputation, when a scored card lands). */
  countUp?: number
}) {
  const shown = useCountUp(value, { delay: countUp ?? 0, duration: countUp === undefined ? 0 : 600 })
  return (
    <span className="stat" data-counting={shown !== value || undefined}>
      {icon}
      <span className="stat-value" aria-hidden="true">
        {countUp === undefined ? value : shown}
      </span>
      <span className="sr-only">{phrase}</span>
    </span>
  )
}

/**
 * Everything above the board: the opponent's plate, with the log and settings
 * buttons beside it, and the latest move under it. No title — the game's name
 * belongs to the screens before the game. Nothing in here changes height
 * during a game.
 *
 * The turn is not a line of text any more: the turn banner is an overlay, and
 * between banners the turn is told by the End turn button, the glow on your
 * avatar and "Opponent is thinking…" — with the sentence kept for screen
 * readers.
 */
export function TopBar({
  view,
  onOpenLog,
  onOpenSettings,
  onOpenHelp,
  showReputation = true,
  reputation,
  label = '',
  detail = '',
}: {
  view: PlayerView
  onOpenLog: () => void
  onOpenSettings?: () => void
  onOpenHelp?: () => void
  /** The table option: off, reputation stays hidden until the end. */
  showReputation?: boolean
  /**
   * The opponent's reputation as the screen should show it: behind the real
   * figure while a scored card is still to land (M10). Defaults to the real one.
   */
  reputation?: number
  /** "Opponent: Medium", or empty before the choice is made. */
  label?: string
  /** The seed against the machine, the room code online: what names this game. */
  detail?: string
}) {
  const recent = view.log.slice(-LOG_LINES).reverse()
  const theirTurn = view.phase !== 'ended' && view.current !== view.seat

  return (
    <header className="top-bar">
      <p className="turn sr-only" aria-live="polite">
        {turnLine(view)}
      </p>
      <div className="top-row">
        <section className="plate" data-side="opponent" aria-label="Opponent">
          <Avatar side="opponent" active={theirTurn} />
          <div className="plate-body">
            <span className="plate-name">Opponent</span>
            {/* who this is and which game: the second line of the plate */}
            <p className="level">
              {label ? <span>{label}</span> : null}
              {detail ? <span className="seed">{detail}</span> : null}
            </p>
          </div>
          {/* centred in the room the plate has left */}
          <span className="plate-stats">
            <Stat icon={<CardIcon />} value={view.opponent.handCount} phrase={`${view.opponent.handCount} cards`} />
            <Stat icon={<CoinIcon />} value={view.opponent.coins} phrase={`${view.opponent.coins} coins`} />
            {showReputation ? (
              <Stat
                icon={<StarIcon />}
                value={reputation ?? bankedReputation(view.opponent)}
                phrase={`${bankedReputation(view.opponent)} reputation`}
                countUp={0}
              />
            ) : null}
          </span>
        </section>
        <div className="top-buttons">
          <button type="button" className="icon-button" onClick={onOpenLog}>
            <LogIcon />
            <span className="sr-only">Full log</span>
          </button>
          {onOpenHelp ? (
            <button type="button" className="icon-button" onClick={onOpenHelp}>
              <HelpIcon />
              <span className="sr-only">How to play</span>
            </button>
          ) : null}
          {onOpenSettings ? (
            <button type="button" className="icon-button" onClick={onOpenSettings}>
              <GearIcon />
              <span className="sr-only">Settings</span>
            </button>
          ) : null}
        </div>
      </div>
      <ol className="log" aria-label="Recent moves">
        {recent.map((entry, index) => (
          <li key={view.log.length - index}>{describeLogEntry(entry, view.seat)}</li>
        ))}
      </ol>
    </header>
  )
}
