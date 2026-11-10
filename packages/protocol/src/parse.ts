import type { Action } from '@dcv/engine'
import { DEFAULT_TABLE_OPTIONS } from './messages.js'
import type { ClientMessage, TableOptions } from './messages.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The options record, or null if it is not one. Every known option must be a
 * boolean when present; a missing one takes its default (an older client),
 * an unknown one is dropped (a newer one).
 */
export function parseTableOptions(value: unknown): TableOptions | null {
  if (!isRecord(value)) return null
  const options = { ...DEFAULT_TABLE_OPTIONS }
  for (const name of Object.keys(DEFAULT_TABLE_OPTIONS) as (keyof TableOptions)[]) {
    const given = value[name]
    if (given === undefined) continue
    if (typeof given !== 'boolean') return null
    options[name] = given
  }
  return options
}

/**
 * Shape only. An `action` is checked to be an object with a `type`, no more:
 * whether it is a legal move is the engine's call, made against the real
 * state, and repeating half of that here would be a second rulebook.
 */
export function parseClientMessage(text: string): ClientMessage | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data)) return null

  switch (data.type) {
    case 'create': {
      if (data.options === undefined) return { type: 'create' }
      const options = parseTableOptions(data.options)
      return options ? { type: 'create', options } : null
    }
    case 'join': {
      if (typeof data.room !== 'string' || data.room.length === 0) return null
      if (data.token !== undefined && typeof data.token !== 'string') return null
      return data.token === undefined
        ? { type: 'join', room: data.room }
        : { type: 'join', room: data.room, token: data.token }
    }
    case 'action': {
      if (!isRecord(data.action) || typeof data.action.type !== 'string') return null
      // the cast is the whole point of the comment above: shape here, legality in the engine
      return { type: 'action', action: data.action as unknown as Action }
    }
    default:
      return null
  }
}
