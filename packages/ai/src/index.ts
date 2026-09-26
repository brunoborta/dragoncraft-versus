export type { Difficulty, Strategy } from './types.js'
export { easy } from './easy.js'
export { medium } from './medium.js'

import { easy } from './easy.js'
import { medium } from './medium.js'
import type { Difficulty, Strategy } from './types.js'

export function createStrategy(level: Difficulty): Strategy {
  switch (level) {
    case 'easy':
      return easy
    case 'medium':
      return medium
    default:
      throw new Error(`unknown difficulty: ${level}`)
  }
}
