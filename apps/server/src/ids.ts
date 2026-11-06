/**
 * No 0/O, 1/I/l: a room code gets read aloud across a table and typed on a
 * phone. Six characters of 32 is a billion rooms, plenty for a map that
 * holds a few hundred.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_ID_LENGTH = 6

export function roomId(): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** What proves a seat is yours. The link only says which room. */
export function seatToken(): string {
  return crypto.randomUUID()
}
