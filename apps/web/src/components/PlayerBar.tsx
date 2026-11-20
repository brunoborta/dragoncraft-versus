import { bankedReputation } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { Avatar } from './Avatar.js'
import { CardIcon, ChevronsIcon, CoinIcon, LockIcon, StarIcon, UndoIcon } from './icons.js'
import { Stat } from './TopBar.js'

/**
 * - `ready`: your turn, and the button can end it. Gold — green once the turn
 *   is played out (`nothingLeft`).
 * - `locked`: your turn, but something is still open — the token is not placed
 *   yet, or an ability has not resolved. The engine only accepts ending the
 *   turn once nothing is pending, and that rule stays (plan 1.1, Spielbrett-5).
 * - `waiting`: not your turn, or the game is over. Grey, no action.
 */
export type EndTurnState = 'ready' | 'locked' | 'waiting'

/**
 * What a tap on End turn plays, or null while it cannot end the turn.
 *
 * Ending is legal once nothing is pending. And as in Hearthstone, where a
 * turn can be ended with things still unplayed, it opens as soon as the
 * token is placed: while "Fire up this token?" is the only thing open, the
 * tap answers it — no — and ends the turn, which the log reads as just that:
 * "don't fire up", then "end turn". Inside a chain (the second token of a
 * bread, say) declining leaves the chain open, so there it stays locked.
 */
export function endTurnActions(view: Pick<PlayerView, 'pending'>, actions: readonly Action[]): Action[] | null {
  const endTurn = actions.find((action) => action.type === 'endTurn')
  if (endTurn) return [endTurn]
  const skip = actions.find((action) => action.type === 'skipFireUp')
  const onlyQuestion = view.pending.length === 1 && view.pending[0]?.kind === 'mayFireUp'
  return skip && onlyQuestion ? [skip, { type: 'endTurn' }] : null
}

/**
 * The turn is played out: the fire-up is answered, and no card is left that
 * could be scored. That is when the button turns green, as Hearthstone's does
 * (plan M12). A coin does not count — spending one is never needed.
 *
 * With the cards' hints off (`revealsScoring` false) the screen does not say
 * which cards can be scored, and the button must not say it either: it stays
 * gold, and turns green only once the hand is empty — both cards scored —
 * when there is nothing left to give away.
 */
export function nothingLeft(view: Pick<PlayerView, 'you'>, actions: readonly Action[], revealsScoring = true): boolean {
  if (!actions.some((action) => action.type === 'endTurn')) return false
  if (!revealsScoring) return view.you.hand.length === 0
  return actions.every((action) => action.type === 'endTurn' || action.type === 'spendCoin')
}

export function endTurnState(myTurn: boolean, view: Pick<PlayerView, 'pending'>, actions: readonly Action[]): EndTurnState {
  if (!myTurn) return 'waiting'
  return endTurnActions(view, actions) ? 'ready' : 'locked'
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
  reputationShown,
  canUndo = false,
  onUndo,
  revealsScoring = true,
}: {
  view: PlayerView
  actions: readonly Action[]
  myTurn: boolean
  onAct: (action: Action) => void
  /** Your reputation as the screen should show it: behind the real one while your scored card flies (M10). */
  reputationShown?: number
  /** One action back, within your own turn and never across a draw. */
  canUndo?: boolean
  onUndo?: () => void
  /** The table shows which cards can be scored (the card-glow option): only then may the button react to them. */
  revealsScoring?: boolean
}) {
  const state = endTurnState(myTurn, view, actions)
  const ending = endTurnActions(view, actions)
  // the tap would also decline the fire-up: say so to whoever hovers or reads it
  const declining = ending?.length === 2
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
          {/* always yours to see: the reputation option hides only the opponent's */}
          <Stat icon={<StarIcon />} value={reputationShown ?? reputation} phrase={`${reputation} reputation`} countUp={0} />
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
        data-done={state === 'ready' && nothingLeft(view, actions, revealsScoring) ? 'true' : undefined}
        disabled={state !== 'ready'}
        title={
          state === 'locked'
            ? 'Place your token and finish its abilities first'
            : declining
              ? 'End your turn without firing up this token'
              : undefined
        }
        onClick={() => {
          for (const action of ending ?? []) onAct(action)
        }}
      >
        {state === 'locked' ? <LockIcon /> : <ChevronsIcon />}
        <span>End turn</span>
      </button>
    </section>
  )
}
