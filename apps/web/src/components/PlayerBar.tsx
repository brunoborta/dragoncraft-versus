import { bankedReputation } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { Avatar } from './Avatar.js'
import { CardIcon, ChevronsIcon, CoinIcon, LockIcon, StarIcon, UndoIcon } from './icons.js'
import { Stat } from './TopBar.js'

/**
 * - `ready`: your turn, and ending it is legal. Gold, lit.
 * - `locked`: your turn, but something is still open — the token is not placed
 *   yet, or an ability has not resolved. The engine only accepts ending the
 *   turn once nothing is pending, and that rule stays (plan 1.1, Spielbrett-5).
 * - `waiting`: not your turn, or the game is over. Grey, no action.
 */
export type EndTurnState = 'ready' | 'locked' | 'waiting'

/**
 * Nothing useful is left: ending the turn is legal, and the only other thing
 * on offer is spending a coin. That is when Hearthstone lights its End Turn
 * button (plan M12) — the turn has been played out.
 */
export function nothingLeft(actions: readonly Action[]): boolean {
  return (
    actions.some((action) => action.type === 'endTurn') &&
    actions.every((action) => action.type === 'endTurn' || action.type === 'spendCoin')
  )
}

export function endTurnState(myTurn: boolean, actions: readonly Action[]): EndTurnState {
  if (!myTurn) return 'waiting'
  return actions.some((action) => action.type === 'endTurn') ? 'ready' : 'locked'
}

/**
 * Your side of the table, at the bottom and quieter than the opponent's plate
 * (plan 3.3): portrait, cards, coins, reputation — then Undo and the End turn
 * button, both always on screen, in the place a thumb finds without looking.
 * Undo used to ride in the decision panel, whose content changes with every
 * decision; here it never moves.
 */
export function PlayerBar({
  view,
  actions,
  myTurn,
  onAct,
  showReputation = true,
  reputationShown,
  canUndo = false,
  onUndo,
}: {
  view: PlayerView
  actions: readonly Action[]
  myTurn: boolean
  onAct: (action: Action) => void
  /** The table option: off, reputation stays hidden until the end. */
  showReputation?: boolean
  /** Your reputation as the screen should show it: behind the real one while your scored card flies (M10). */
  reputationShown?: number
  /** One action back, within your own turn and never across a draw. */
  canUndo?: boolean
  onUndo?: () => void
}) {
  const state = endTurnState(myTurn, actions)
  const endTurn = actions.find((action) => action.type === 'endTurn')
  const reputation = bankedReputation(view.you)

  return (
    <section className="player-bar" aria-label="You">
      <div className="plate" data-side="you">
        <Avatar side="you" active={myTurn} />
        {/* your portrait, at the bottom, is you: the word gives its room to Undo */}
        <span className="plate-name sr-only">You</span>
        <span className="plate-stats">
          <Stat icon={<CardIcon />} value={view.you.hand.length} phrase={`${view.you.hand.length} cards`} />
          <Stat icon={<CoinIcon />} value={view.you.coins} phrase={`${view.you.coins} coins`} />
          {showReputation ? (
            <Stat icon={<StarIcon />} value={reputationShown ?? reputation} phrase={`${reputation} reputation`} countUp={0} />
          ) : null}
        </span>
      </div>
      {onUndo ? (
        <button type="button" className="icon-button undo-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          <UndoIcon />
        </button>
      ) : null}
      <button
        type="button"
        className="end-turn"
        data-state={state}
        data-glow={state === 'ready' && nothingLeft(actions) ? 'true' : undefined}
        disabled={state !== 'ready'}
        title={state === 'locked' ? 'Place your token and finish its abilities first' : undefined}
        onClick={() => {
          if (endTurn) onAct(endTurn)
        }}
      >
        {state === 'locked' ? <LockIcon /> : <ChevronsIcon />}
        <span>End turn</span>
      </button>
    </section>
  )
}
