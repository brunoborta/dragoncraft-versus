export type Route = { kind: 'home' } | { kind: 'room'; id: string }

const ROOM = /^#\/room\/(\d{6})(?!\d)/

/**
 * `#/room/123456` is the game this tab is in, written there so a reload or
 * a phone waking from sleep lands back in it. It is not how a game is
 * shared — that is the PIN, typed in — but the same number.
 */
export function parseRoute(hash: string): Route {
  const match = ROOM.exec(hash)
  return match ? { kind: 'room', id: match[1] } : { kind: 'home' }
}

export function roomHash(id: string): string {
  return `#/room/${id}`
}
