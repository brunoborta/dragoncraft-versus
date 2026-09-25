export type { Difficulty, Strategy } from './types.js'
export { easy } from './easy.js'

import { easy } from './easy.js'
import type { Difficulty, Strategy } from './types.js'

export function createStrategy(level: Difficulty): Strategy {
  switch (level) {
    case 'easy':
      return easy
    default:
      throw new Error(`unknown difficulty: ${level}`)
  }
}
