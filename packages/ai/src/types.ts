import type { Action, PlayerView, RngState } from '@dcv/engine'

export type Difficulty = 'easy' | 'medium'

/**
 * A strategy only ever sees `PlayerView`: it does not know the opponent hand
 * or the deck order. That guarantee is the signature, not a convention.
 */
export type Strategy = {
  readonly level: Difficulty
  chooseAction(
    view: PlayerView,
    actions: readonly Action[],
    rng: RngState,
  ): { action: Action; rng: RngState }
}
