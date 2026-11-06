export type Route = { kind: 'home' } | { kind: 'room'; id: string }

const ROOM = /^#\/room\/([A-Za-z0-9]+)/

/** `#/room/ABC123` is a room; anything else is the front door. `#debug` rides along either. */
export function parseRoute(hash: string): Route {
  const match = ROOM.exec(hash)
  return match ? { kind: 'room', id: match[1].toUpperCase() } : { kind: 'home' }
}

export function roomHash(id: string): string {
  return `#/room/${id}`
}

/** The link to send a friend: this page, with the room in the fragment. */
export function roomLink(id: string, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}${roomHash(id)}`
}
