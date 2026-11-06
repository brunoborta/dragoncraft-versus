import { roomId, seatToken } from './ids.js'
import { Room } from './room.js'

/** A room nobody is connected to for this long is gone. Phones sleep; half an hour is not a dropped wifi. */
export const IDLE_MS = 30 * 60 * 1000
/** A room whose second seat never filled. */
export const WAITING_MS = 2 * 60 * 60 * 1000
export const MAX_ROOMS = 500

type Options = {
  newId?: () => string
  newToken?: () => string
  newSeed?: () => number
  maxRooms?: number
}

/**
 * Every live game, in memory. Nothing survives a restart, which the spec
 * accepts; what this guards against is the memory growing forever, so a
 * sweep runs on a timer and there is a ceiling.
 */
export class Rooms {
  private readonly rooms = new Map<string, Room>()
  private readonly newId: () => string
  private readonly newToken: () => string
  private readonly newSeed: () => number
  private readonly maxRooms: number

  constructor(options: Options = {}) {
    this.newId = options.newId ?? roomId
    this.newToken = options.newToken ?? seatToken
    this.newSeed = options.newSeed ?? (() => Math.floor(Math.random() * 0x7fffffff))
    this.maxRooms = options.maxRooms ?? MAX_ROOMS
  }

  get size(): number {
    return this.rooms.size
  }

  /** `null` when the ceiling is reached: the caller answers `busy`. */
  create(now: number): Room | null {
    if (this.rooms.size >= this.maxRooms) return null
    let id = this.newId()
    while (this.rooms.has(id)) id = this.newId()
    const room = new Room(id, this.newSeed(), this.newToken, now)
    this.rooms.set(id, room)
    return room
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id)
  }

  /** Removes what nobody will come back to, and hands them over so anyone still in one can be told. */
  sweep(now: number): Room[] {
    const gone: Room[] = []
    for (const room of this.rooms.values()) {
      const abandoned = room.connectedCount() === 0 && now - room.idleSince >= IDLE_MS
      const neverFilled = !room.started && now - room.createdAt >= WAITING_MS
      if (abandoned || neverFilled) gone.push(room)
    }
    for (const room of gone) this.rooms.delete(room.id)
    return gone
  }
}
