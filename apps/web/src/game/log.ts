import type { LogEntry } from '@dcv/engine'
import { tokenLabel } from '../components/TokenGlyph.js'
import { describeAction } from './labels.js'

export function describeLogEntry(entry: LogEntry): string {
  const who = entry.seat === 0 ? 'Player 1' : 'Player 2'
  if (entry.action.type === 'draw') return `${who} drew ${tokenLabel(entry.action.token)}`
  if (entry.action.type === 'gameOver') return 'Game over'
  return `${who}: ${describeAction(entry.action)}`
}
