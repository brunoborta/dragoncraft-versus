import { AWAY_AGAIN_MS, AWAY_TURNS, FUSE_MS, TURN_MS } from '@dcv/protocol'
import type { ServerMessage } from '@dcv/protocol'
import { describe, expect, it } from 'vitest'
import { Room } from './room.js'
import type { Outbound } from './room.js'

let tokens = 0

/** A full table on a clock of our own: `time.now` is what the room reads. */
function table() {
  const time = { now: 1_000 }
  const room = new Room('CLOCK1', 7, () => `t${tokens++}`, 0, undefined, () => 7, () => time.now)
  room.sit('A')
  const out = room.sit('B')
  const view = lastView(out, 'A')!
  const mover = view.view.current === 0 ? 'A' : 'B'
  const other = mover === 'A' ? 'B' : 'A'
  return { room, time, mover, other, first: view }
}

function lastView(out: Outbound[], client: string) {
  const views = out
    .filter((o) => o.to === client && o.message.type === 'view')
    .map((o) => o.message as Extract<ServerMessage, { type: 'view' }>)
  return views[views.length - 1]
}

describe('the turn clock', () => {
  it('gives the player whose turn it is three minutes, and tells both seats', () => {
    const { first } = table()
    expect(first.clock).toEqual({ seat: first.view.current, remainingMs: TURN_MS, totalMs: TURN_MS })
  })

  it('says how much is left with every view', () => {
    const { room, time, mover } = table()
    time.now += 60_000
    // a seat already sitting that sits again is handed the game as it stands
    const view = lastView(room.sit(mover), mover)
    expect(view?.clock?.remainingMs).toBe(TURN_MS - 60_000)
  })

  it('does nothing before the deadline', () => {
    const { room, time } = table()
    time.now += TURN_MS - 1
    expect(room.tick().timedOut).toBeNull()
  })

  it("plays a slow player's turn out at the deadline and hands it on, the next turn with its full time", () => {
    const { room, time, mover, first } = table()
    room.awake(mover)
    time.now += TURN_MS
    const { out, timedOut } = room.tick()
    expect(timedOut).toMatchObject({ seat: first.view.current, away: false, forfeited: false })
    const view = lastView(out, mover)!
    expect(view.view.current).toBe(1 - first.view.current)
    expect(view.view.log.some((entry) => entry.action.type === 'timeOut')).toBe(true)
    expect(view.clock).toMatchObject({ seat: 1 - first.view.current, totalMs: TURN_MS })
  })

  it('a move counts as being there', () => {
    const { room, time, mover, first } = table()
    const place = lastView(room.sit(mover), mover)!.actions.find((action) => action.type === 'place')!
    room.act(mover, place)
    time.now += TURN_MS
    expect(room.tick().timedOut).toMatchObject({ seat: first.view.current, away: false })
  })

  it('starts the next turn of a player who was away with only a fuse, and puts it out when they touch the screen', () => {
    const { room, time, mover, other } = table()
    // the mover never touches: away
    time.now += TURN_MS
    expect(room.tick().timedOut).toMatchObject({ away: true })
    // the other plays a whole turn out, though present
    room.awake(other)
    time.now += TURN_MS
    const back = lastView(room.tick().out, mover)!
    expect(back.clock).toEqual({ seat: back.view.current, remainingMs: FUSE_MS, totalMs: FUSE_MS })
    time.now += 5_000
    const lit = room.awake(mover)
    const clock = lit.find((o) => o.to === mover)?.message
    expect(clock).toEqual({ type: 'clock', clock: { seat: back.view.current, remainingMs: TURN_MS - 5_000, totalMs: TURN_MS } })
    // a second touch changes nothing more
    expect(room.awake(mover)).toEqual([])
  })

  it(`gives the game up for a player away ${AWAY_TURNS} turns in a row, and only then`, () => {
    const { room, time, mover, other } = table()
    const results = []
    for (let turn = 0; turn < AWAY_TURNS * 2; turn++) {
      const { timedOut } = room.tick()
      if (timedOut) results.push(timedOut)
      // the other seat is there each time its turn comes
      room.awake(other)
      time.now += TURN_MS
    }
    const mine = results.filter((each) => each.seat === (mover === 'A' ? 0 : 1))
    expect(mine.map((each) => each.forfeited)).toEqual([false, false, true])
    expect(lastView(room.sit(mover), mover)!.view.phase).toBe('ended')
  })

  it('hurries a player away again: the turn after the first is a fuse of 30s, after the second one of 15s', () => {
    const { room, time, mover, other } = table()
    const clockOf = () => lastView(room.sit(other), other)!.clock
    // the mover's whole turn untouched: away once
    time.now += TURN_MS
    expect(room.tick().timedOut).toMatchObject({ away: true, forfeited: false })
    // the other seat's turn, there but slow
    room.awake(other)
    time.now += TURN_MS
    room.tick()
    expect(clockOf()).toMatchObject({ remainingMs: FUSE_MS, totalMs: FUSE_MS })
    // the fuse burns out untouched: away twice
    time.now += FUSE_MS
    expect(room.tick().timedOut).toMatchObject({ away: true, forfeited: false })
    room.awake(other)
    time.now += TURN_MS
    room.tick()
    expect(clockOf()).toMatchObject({ remainingMs: AWAY_AGAIN_MS, totalMs: AWAY_AGAIN_MS })
    // a third: the game is given up
    time.now += AWAY_AGAIN_MS
    expect(room.tick().timedOut).toMatchObject({ away: true, forfeited: true })
    expect(lastView(room.sit(mover), mover)!.view.phase).toBe('ended')
  })

  it('never takes the game from a slow player, however many turns they run out', () => {
    const { room, time, mover, other } = table()
    for (let turn = 0; turn < AWAY_TURNS * 4; turn++) {
      room.awake(mover)
      room.awake(other)
      time.now += TURN_MS
      expect(room.tick().timedOut?.forfeited).toBe(false)
    }
  })

  it('stops once the game is over', () => {
    const { room, time, mover } = table()
    room.forfeit(mover)
    time.now += TURN_MS * 2
    expect(room.tick().timedOut).toBeNull()
    expect(lastView(room.sit(mover), mover)!.clock).toBeUndefined()
  })
})
