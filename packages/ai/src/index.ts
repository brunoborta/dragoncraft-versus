export type { Difficulty, Strategy } from './types.js'
export { easy } from './easy.js'
export { medium } from './medium.js'
export { hard } from './hard.js'

import { easy } from './easy.js'
import { hard } from './hard.js'
import { medium } from './medium.js'
import type { Difficulty, Strategy } from './types.js'

export function createStrategy(level: Difficulty): Strategy {
  switch (level) {
    case 'easy':
      return easy
    case 'medium':
      return medium
    case 'hard':
      return hard
    default:
      throw new Error(`unknown difficulty: ${level}`)
  }
}
