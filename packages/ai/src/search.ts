import { actionKey, applyAction, determinize, legalActions, shuffle } from '@dcv/engine'
import type { Action, GameState, PlayerView, RngState, Seat } from '@dcv/engine'
import { leafScore, positionScore } from './score.js'

export type SearchConfig = {
  /** How many lines survive each round of pruning. */
  width: number
  /** Most actions examined at any one decision. Potion alone offers over 170. */
  candidateCap: number
  /** Independent guesses at the hidden state, averaged over. */
  samples: number
  /** Safety rail: a bread chain can keep a turn open for a long time. */
  maxDepth: number
}

/** A line of play under consideration, tagged with the move that opened it. */
type Node = { state: GameState; first: Action }

function best<T>(items: readonly T[], count: number, scoreOf: (item: T) => number): T[] {
  if (items.length <= count) return [...items]
  return [...items].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, count)
}

/**
 * Plays the turn out to its end and scores the position it finishes in.
 *
 * The engine models a turn as a stack of decisions — place, then maybe fire
 * up, then resolve whatever that ability opened, then score — and asks the
 * strategy for one decision at a time. Medium answers each in isolation, which
 * means it chooses where to put a token while the fire-up that follows is
 * still an open question. This searches the rest of the turn instead and
 * returns the first move of the best line it found, so a placement is judged
 * by the turn it leads to rather than by the half-finished position it leaves.
 *
 * `endTurn` is never applied: the state in front of it is the last one that
 * rests on facts rather than on guesses, because ending a turn refreshes the
 * hand from a deck whose order we invented.
 */
function searchFromGuess(
  root: GameState,
  rootActions: readonly Action[],
  seat: Seat,
  config: SearchConfig,
): Node[] {
  const leaves: Node[] = []
  let frontier: Node[] = []

  for (const action of rootActions.slice(0, config.candidateCap)) {
    if (action.type === 'endTurn') leaves.push({ state: root, first: action })
    else frontier.push({ state: applyAction(root, action), first: action })
  }

  for (let depth = 0; depth < config.maxDepth && frontier.length > 0; depth++) {
    const grown: Node[] = []

    for (const node of frontier) {
      if (node.state.phase === 'ended' || node.state.current !== seat) {
        leaves.push(node)
        continue
      }

      const options = legalActions(node.state)
      const open = options.filter((action) => action.type !== 'endTurn')
      // Where stopping is legal, stopping is a line in its own right: this is
      // what lets the search compare "score this card and stop" against
      // "spend a coin first".
      if (open.length < options.length) leaves.push(node)
      if (open.length === 0) continue

      for (const action of open.slice(0, config.candidateCap)) {
        grown.push({ state: applyAction(node.state, action), first: node.first })
      }
    }

    // Pruning uses the cheap score. The deck scan behind `leafScore` is worth
    // paying for a surviving line and not for every twig.
    frontier = best(grown, config.width, (node) => positionScore(node.state, seat))
  }

  leaves.push(...frontier)
  return leaves
}

/**
 * Chooses among `actions` by searching each sampled determinization to the end
 * of the turn.
 *
 * A move is judged on the best finished turn found that starts with it. Moves
 * pruned before reaching the end of a turn are not chosen — they were pruned
 * because the position they left behind was worse, which is the search doing
 * its job.
 */
export function searchTurn(
  view: PlayerView,
  actions: readonly Action[],
  rng: RngState,
  config: SearchConfig,
): { action: Action; rng: RngState } {
  if (actions.length === 0) throw new Error('chooseAction called with no legal actions')
  if (actions.length === 1) return { action: actions[0], rng }

  type Tally = { action: Action; total: number; samples: number }
  const tallies = new Map<string, Tally>()
  let state = rng

  for (let sample = 0; sample < config.samples; sample++) {
    // Shuffled so that genuinely equal moves are not always resolved towards
    // the same corner of the board.
    const order = shuffle(actions, state)
    const guess = determinize(view, order.rng)
    state = guess.rng

    // Best line per opening move *within this guess*, so that one lucky guess
    // cannot be counted twice for the same move.
    const bySample = new Map<string, { action: Action; score: number }>()
    for (const leaf of searchFromGuess(guess.state, order.items, view.seat, config)) {
      const score = leafScore(leaf.state, view.seat)
      const key = actionKey(leaf.first)
      const current = bySample.get(key)
      if (!current || score > current.score) bySample.set(key, { action: leaf.first, score })
    }

    for (const [key, entry] of bySample) {
      const tally = tallies.get(key)
      if (tally) {
        tally.total += entry.score
        tally.samples += 1
      } else {
        tallies.set(key, { action: entry.action, total: entry.score, samples: 1 })
      }
    }
  }

  /**
   * Mean across the guesses that kept this move alive. A move that survived
   * more guesses wins a tie: holding up under several guesses at the hidden
   * state is itself evidence, and it keeps the choice from turning on one
   * optimistic deal.
   */
  let chosen: Tally | undefined
  for (const tally of tallies.values()) {
    if (!chosen) {
      chosen = tally
      continue
    }
    const mean = tally.total / tally.samples
    const bestMean = chosen.total / chosen.samples
    if (mean > bestMean || (mean === bestMean && tally.samples > chosen.samples)) chosen = tally
  }
  if (!chosen) throw new Error('search produced no line')

  return { action: chosen.action, rng: state }
}
