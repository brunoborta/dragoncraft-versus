import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import type { TableOptions } from '@dcv/protocol'

export type { TableOptions }
export { DEFAULT_TABLE_OPTIONS }

/**
 * The table's options plus what only matters against the machine — which
 * never goes to a server: online there is no machine to pace.
 */
export type GameOptions = TableOptions & {
  /** The machine pauses as if thinking before its moves; off, it plays at once. */
  opponentThinks: boolean
}

export const DEFAULT_GAME_OPTIONS: GameOptions = { ...DEFAULT_TABLE_OPTIONS, opponentThinks: true }

/** The part of the options a room is opened with. */
export function tableOptionsOf({ opponentThinks: _, ...table }: GameOptions): TableOptions {
  return table
}

/**
 * The table's options are chosen per game, on the screen after the difficulty
 * (against the machine) or after Create (online, by the host). What was
 * chosen last is remembered on this device and offered as the starting point
 * next time; the game itself holds the options it was started with.
 */
const KEY = 'dcv:table-options'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadTableOptions(): GameOptions {
  try {
    const raw = storage()?.getItem(KEY)
    return { ...DEFAULT_GAME_OPTIONS, ...(raw ? (JSON.parse(raw) as Partial<GameOptions>) : {}) }
  } catch {
    return { ...DEFAULT_GAME_OPTIONS }
  }
}

export function saveTableOptions(options: GameOptions): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(options))
  } catch {
    // no storage (private mode, a test): nothing remembered, nothing lost
  }
}
