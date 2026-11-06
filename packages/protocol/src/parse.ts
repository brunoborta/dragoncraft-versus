import type { Action } from '@dcv/engine'
import type { ClientMessage } from './messages.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
    case 'create':
      return { type: 'create' }
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
