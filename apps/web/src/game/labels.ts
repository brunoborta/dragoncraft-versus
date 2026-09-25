import { key } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'

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
      return `Use ${DRAGON_THEME[action.ability].label} on ${key(action.at)}`
    case 'spendCoin':
      return 'Spend a coin'
    case 'coinDiscard':
      return 'Return these two cards'
    case 'scoreCard':
      return `Score ${action.cardId}`
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
