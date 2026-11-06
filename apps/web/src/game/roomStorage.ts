import type { Seat } from '@dcv/engine'

export type SeatMemory = { token: string; seat: Seat }

export type RoomStorage = {
  remember: (roomId: string, memory: SeatMemory) => void
  recall: (roomId: string) => SeatMemory | null
}

const PREFIX = 'dcv:room:'

/**
 * The token that proves a seat is ours, kept per room so a phone that
 * drops out comes back as the same player. `localStorage` can refuse to
 * work (private browsing, full quota); then we simply cannot reconnect,
 * which is no worse than before.
 */
export const roomStorage: RoomStorage = {
  remember(roomId, memory) {
    try {
      globalThis.localStorage?.setItem(PREFIX + roomId, JSON.stringify(memory))
    } catch {
      // nothing to do: reconnection will ask for a fresh seat and be refused
    }
  },
  recall(roomId) {
    try {
      const raw = globalThis.localStorage?.getItem(PREFIX + roomId)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<SeatMemory>
      if (typeof parsed.token !== 'string' || (parsed.seat !== 0 && parsed.seat !== 1)) return null
      return { token: parsed.token, seat: parsed.seat }
    } catch {
      return null
    }
  },
}
