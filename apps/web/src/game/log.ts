import type { LogEntry, Seat } from '@dcv/engine'
import { tokenLabel } from '../components/TokenGlyph.js'
import { describeAction } from './labels.js'

/** One line with no mention of who did it — the turn heading carries that. */
export function describeLogLine(entry: LogEntry): string {
  if (entry.action.type === 'draw') return `Drew ${tokenLabel(entry.action.token)}`
  if (entry.action.type === 'gameOver') return 'Game over'
  return describeAction(entry.action)
}

/** Named from the reader's seat, so nobody has to translate "Player 2". */
export function whoOf(entry: LogEntry, seat: Seat): string {
  return entry.seat === seat ? 'You' : 'Opponent'
}

export function describeLogEntry(entry: LogEntry, seat: Seat): string {
  if (entry.action.type === 'gameOver') return 'Game over'
  return `${whoOf(entry, seat)}: ${describeLogLine(entry)}`
}

export type LogTurn = { who: string; lines: string[]; at: number }

/**
 * Consecutive entries by the same seat are one turn. A single machine turn runs
 * to five entries or more — draw, place, fire up, move, end — so grouping is
 * what lets the reader tell their own moves from the opponent's at a glance
 * instead of reading a name on every line.
 */
export function groupLog(log: readonly LogEntry[], seat: Seat): LogTurn[] {
  const turns: LogTurn[] = []

  log.forEach((entry, index) => {
    const current = turns[turns.length - 1]
    if (current && log[index - 1]?.seat === entry.seat) {
      current.lines.push(describeLogLine(entry))
      return
    }
    turns.push({ who: whoOf(entry, seat), lines: [describeLogLine(entry)], at: index })
  })

  return turns
}

export type LogRound = { number: number; turns: LogTurn[] }

/**
 * A round is one turn from each side. Turns already alternate — a turn ends
 * when the seat changes — so a round is simply the next two of them, which
 * makes whoever opened the game open every round in it. When the Fire Up
 * Chart hands the machine the first turn, its rounds read Opponent then You,
 * and no round is ever half a round for structural reasons.
 *
 * The round being played is the exception: it holds one turn until the reply.
 */
export function groupRounds(log: readonly LogEntry[], seat: Seat): LogRound[] {
  const turns = groupLog(log, seat)
  const rounds: LogRound[] = []

  for (let index = 0; index < turns.length; index += 2) {
    rounds.push({ number: rounds.length + 1, turns: turns.slice(index, index + 2) })
  }

  return rounds
}
