import { areAdjacent, key } from '@dcv/engine'
import type { Action, PatternCell, PlayerView, ShopCard } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'

function isTriangle(pattern: readonly PatternCell[]): boolean {
  const [a, b, c] = pattern.map((cell) => cell.offset)
  return areAdjacent(a, b) && areAdjacent(b, c) && areAdjacent(a, c)
}

/** A readable name built from the pattern, so no card id ever reaches the screen. */
export function cardName(card: ShopCard): string {
  const types = card.pattern.map((cell) => cell.type)
  const unique = [...new Set(types)]

  if (unique.length === 1) {
    const shape = isTriangle(card.pattern) ? 'triangle' : 'line'
    return `Three ${DRAGON_THEME[unique[0]].label} in a ${shape}`
  }

  const repeated = types.find((type, i) => types.indexOf(type) !== i)
  if (!repeated) throw new Error(`mixed card ${card.id} has no repeated type`)
  const odd = unique.find((type) => type !== repeated)
  if (!odd) throw new Error(`mixed card ${card.id} has no odd type`)

  return `Two ${DRAGON_THEME[repeated].label} and one ${DRAGON_THEME[odd].label}`
}

export function describeAction(action: Action): string {
  switch (action.type) {
    case 'place':
      return `Place on ${key(action.at)}`
    case 'fireUp':
      return `Fire up ${DRAGON_THEME[action.ability].label}`
    case 'skipFireUp':
      return 'Do not fire up'
    case 'crystalPick':
      return `Keep token ${action.index + 1}`
    case 'meatMove':
      return `Move ${key(action.from)} to ${key(action.to)}`
    case 'ironMove':
      return `Shift ${key(action.from)} to ${key(action.to)}`
    case 'ironDone':
      return 'Stop moving'
    case 'potionSwap':
      return `Swap ${key(action.a)} with ${key(action.b)}`
    case 'plantTarget':
      // the board already picked the neighbour; a coordinate here means nothing
      return `Use ${DRAGON_THEME[action.ability].label}`
    case 'spendCoin':
      return 'Spend a coin'
    case 'coinDiscard':
      // which two is said by the cards themselves, marked on screen
      return 'Put these two back'
    case 'scoreCard':
      return 'Scored a card'
    case 'endTurn':
      return 'End turn'
  }
}

/** The question the top of the pending stack is asking right now. */
export function promptFor(view: PlayerView): string {
  const pending = view.pending[view.pending.length - 1]
  if (!pending) {
    if (view.phase === 'final-score') return 'Last chance to score'
    if (view.phase === 'ended') return 'Game over'
    return 'Score what you can, then end your turn'
  }

  switch (pending.kind) {
    case 'place':
      return 'Choose where to place the token'
    case 'mayFireUp':
      return 'Fire up this dragon?'
    case 'crystalPick':
      return 'Keep one of these three'
    case 'meat':
      return 'Move one neighbour anywhere'
    case 'iron':
      return `Shift a neighbour one space (${pending.movesLeft} left)`
    case 'potion':
      return 'Swap any two dragons'
    case 'plant':
      return 'Use a neighbouring ability'
    case 'coinDiscard':
      return 'Put two cards at the bottom of the deck'
  }
}
