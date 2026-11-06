import { describe, expect, it } from 'vitest'
import { IDLE_MS, Rooms, WAITING_MS } from './rooms.js'

function sequentialIds() {
  let n = 0
  return () => `ROOM${String(n++).padStart(2, '0')}`
}

describe('Rooms', () => {
  it('creates rooms with distinct ids, retrying a collision', () => {
    const ids = ['SAME00', 'SAME00', 'OTHER0']
    const rooms = new Rooms({ newId: () => ids.shift() ?? 'FALLBK', newSeed: () => 1 })
    expect(rooms.create(0)?.id).toBe('SAME00')
    expect(rooms.create(0)?.id).toBe('OTHER0')
    expect(rooms.size).toBe(2)
  })

  it('refuses to open a room past the ceiling', () => {
    const rooms = new Rooms({ newId: sequentialIds(), newSeed: () => 1, maxRooms: 2 })
    expect(rooms.create(0)).not.toBeNull()
    expect(rooms.create(0)).not.toBeNull()
    expect(rooms.create(0)).toBeNull()
  })

  it('finds a room by id, and not by a wrong one', () => {
    const rooms = new Rooms({ newId: sequentialIds(), newSeed: () => 1 })
    const room = rooms.create(0)!
    expect(rooms.get(room.id)).toBe(room)
    expect(rooms.get('NOPE00')).toBeUndefined()
  })

  it('sweeps a room with nobody connected for the idle period, and keeps one with a player', () => {
    const rooms = new Rooms({ newId: sequentialIds(), newSeed: () => 1 })
    const empty = rooms.create(0)!
    empty.sit('A')
    empty.sit('B')
    empty.disconnect('A', 10)
    empty.disconnect('B', 20)

    const lively = rooms.create(0)!
    lively.sit('C')
    lively.sit('D')

    expect(rooms.sweep(20 + IDLE_MS - 1)).toEqual([])
    expect(rooms.sweep(20 + IDLE_MS)).toEqual([empty.id])
    expect(rooms.get(empty.id)).toBeUndefined()
    expect(rooms.get(lively.id)).toBe(lively)
  })

  it('sweeps a room whose second seat never filled, even with the creator still connected', () => {
    const rooms = new Rooms({ newId: sequentialIds(), newSeed: () => 1 })
    const lonely = rooms.create(0)!
    lonely.sit('A')
    expect(rooms.sweep(WAITING_MS - 1)).toEqual([])
    expect(rooms.sweep(WAITING_MS)).toEqual([lonely.id])
  })
})
