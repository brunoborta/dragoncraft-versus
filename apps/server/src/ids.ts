/**
 * Six digits, Kahoot-style: a PIN is read aloud across a room and typed on a
 * phone's number pad, so it is only digits, leading zeros included. A million
 * PINs against a ceiling of a few hundred live rooms keeps both collisions
 * (retried by `Rooms.create`) and lucky guesses rare.
 */
const PIN_LENGTH = 6

export function roomId(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 10 ** PIN_LENGTH).padStart(PIN_LENGTH, '0')
}

/** What proves a seat is yours. The PIN only says which room. */
export function seatToken(): string {
  return crypto.randomUUID()
}
