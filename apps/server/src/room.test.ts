import { nextInt } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import type { ServerMessage } from '@dcv/protocol'
import { describe, expect, it } from 'vitest'
import { Room } from './room.js'
import type { Outbound } from './room.js'

let tokenCounter = 0
const newToken = () => `token-${tokenCounter++}`

function makeRoom(seed = 7): Room {
  return new Room('ROOM01', seed, newToken, 0)
}

function to(out: Outbound[], client: string): ServerMessage[] {
  return out.filter((o) => o.to === client).map((o) => o.message)
}

function lastView(messages: ServerMessage[]) {
  const views = messages.filter((m): m is Extract<ServerMessage, { type: 'view' }> => m.type === 'view')
  return views[views.length - 1]
}

function tokenOf(messages: ServerMessage[]): string {
  const seated = messages.find((m) => m.type === 'seated')
  if (!seated || seated.type !== 'seated') throw new Error('not seated')
  return seated.token
}

/** Both seats taken; returns the first views each got. */
function seatBoth(room: Room) {
  const a = room.sit('A')
  const b = room.sit('B')
  return { a, b }
}

describe('Room', () => {
  it("hands the creator's table options to both seats, the joiner's included", () => {
    const options = { bagComposition: true, cardGlow: false, showReputation: false }
    const room = new Room('ROOM02', 7, newToken, 0, options)
    const { a, b } = seatBoth(room)
    for (const messages of [to(a, 'A'), to(b, 'B')]) {
      const seated = messages.find((m) => m.type === 'seated')
      expect(seated && seated.type === 'seated' && seated.options).toEqual(options)
    }
  })

  it('opens with the default options when the creator sent none', () => {
    const seated = to(makeRoom().sit('A'), 'A').find((m) => m.type === 'seated')
    expect(seated && seated.type === 'seated' && seated.options).toEqual(DEFAULT_TABLE_OPTIONS)
  })

  it('seats the creator, tells them to wait, and sends no view until the table is full', () => {
    const room = makeRoom()
    const out = room.sit('A')
    expect(to(out, 'A').map((m) => m.type)).toEqual(['seated', 'waiting'])
    expect(room.started).toBe(false)
  })

  it('starts the game when the second player sits, and each seat gets its own view', () => {
    const room = makeRoom()
    const { a, b } = seatBoth(room)
    expect(room.started).toBe(true)
    // A was already seated, so on B's arrival only a view reaches A
    expect(to(b, 'A').map((m) => m.type)).toEqual(['view'])
    expect(to(b, 'B').map((m) => m.type)).toEqual(['seated', 'view'])
    expect(to(a, 'A').map((m) => m.type)).toEqual(['seated', 'waiting'])

    const viewA = lastView(to(b, 'A')).view
    const viewB = lastView(to(b, 'B')).view
    expect(viewA.seat).toBe(0)
    expect(viewB.seat).toBe(1)
    expect(viewA.current).toBe(viewB.current)
  })

  it('hands the legal actions only to the seat whose turn it is', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const a = lastView(to(b, 'A'))
    const bb = lastView(to(b, 'B'))
    const mover = a.view.current === 0 ? a : bb
    const waiter = a.view.current === 0 ? bb : a
    expect(mover.actions.length).toBeGreaterThan(0)
    expect(waiter.actions).toEqual([])
  })

  it('refuses a third person with room-full, silently to the players', () => {
    const room = makeRoom()
    seatBoth(room)
    const out = room.sit('C')
    expect(out).toEqual([{ to: 'C', message: expect.objectContaining({ type: 'error', code: 'room-full' }) }])
  })

  it('refuses an action from whoever is not the player of the turn, without moving the state', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const idle = viewA.view.current === 0 ? 'B' : 'A'
    const mover = idle === 'A' ? 'B' : 'A'
    const moverView = lastView(to(b, mover))

    const out = room.act(idle, moverView.actions[0])
    expect(to(out, idle).map((m) => m.type)).toEqual(['error', 'view'])
    expect(to(out, idle)[0]).toMatchObject({ code: 'not-your-turn' })
    expect(to(out, mover)).toEqual([])
    // the refusal's view is the same position as before
    expect(lastView(to(out, idle)).view.board).toEqual(moverView.view.board)
  })

  it('refuses an action that is well-formed but not legal here', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'

    const out = room.act(mover, { type: 'endTurn' })
    expect(to(out, mover)[0]).toMatchObject({ type: 'error', code: 'illegal-action' })
    expect(lastView(to(out, mover)).actions.length).toBeGreaterThan(0)
  })

  it('does not fall over on an action shaped like nothing the engine knows', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'

    const weird = { type: 'place', at: { q: 'x', r: [1, 2], nested: { deep: true } } } as unknown as Action
    const out = room.act(mover, weird)
    expect(to(out, mover)[0]).toMatchObject({ type: 'error', code: 'illegal-action' })
  })

  it('refuses an action from someone not seated, or before the game starts', () => {
    const room = makeRoom()
    expect(room.act('nobody', { type: 'endTurn' })[0].message).toMatchObject({ code: 'not-seated' })
    room.sit('A')
    expect(room.act('A', { type: 'endTurn' })[0].message).toMatchObject({ code: 'not-started' })
  })

  it('lets a player back in with their token, on a new connection, and tells the other', () => {
    const room = makeRoom()
    const { a, b } = seatBoth(room)
    const tokenA = tokenOf(to(a, 'A'))

    const gone = room.disconnect('A', 1000)
    expect(gone).toEqual([{ to: 'B', message: { type: 'presence', opponentConnected: false } }])
    expect(room.connectedCount()).toBe(1)

    const back = room.rejoin('A2', tokenA)
    expect(to(back, 'A2').map((m) => m.type)).toEqual(['seated', 'view'])
    expect(lastView(to(back, 'A2')).view.seat).toBe(0)
    expect(to(back, 'B')).toEqual([{ type: 'presence', opponentConnected: true }])
    expect(to(back, 'A')).toEqual([])

    // the new connection is the seat now
    const viewB = lastView(to(b, 'B'))
    const mover = viewB.view.current === 1 ? 'B' : 'A2'
    const moverView = mover === 'B' ? viewB : lastView(to(back, 'A2'))
    const out = room.act(mover, moverView.actions[0])
    expect(to(out, 'A2').map((m) => m.type)).toEqual(['view'])
  })

  it('tells a still-open connection it was replaced when its token is used elsewhere', () => {
    const room = makeRoom()
    const { a } = seatBoth(room)
    const tokenA = tokenOf(to(a, 'A'))

    const out = room.rejoin('A2', tokenA)
    expect(to(out, 'A')).toEqual([expect.objectContaining({ type: 'error', code: 'replaced' })])
    expect(to(out, 'A2').map((m) => m.type)).toEqual(['seated', 'view'])
    expect(room.connectedCount()).toBe(2)
  })

  it('refuses a token it never issued', () => {
    const room = makeRoom()
    seatBoth(room)
    const out = room.rejoin('X', 'forged')
    expect(out).toEqual([{ to: 'X', message: expect.objectContaining({ code: 'bad-token' }) }])
  })

  it('answers a seated player who sits again with where they are', () => {
    const room = makeRoom()
    room.sit('A')
    expect(room.sit('A').map((o) => o.message.type)).toEqual(['waiting'])
  })

  it('offers no undo at the opening of a turn, then offers it once a move is made', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'
    const moverView = mover === 'A' ? viewA : lastView(to(b, 'B'))

    // the turn opened with a draw: there is nothing before it to go back to
    expect(moverView.canUndo).toBe(false)

    const place = moverView.actions.find((a) => a.type === 'place')!
    const out = room.act(mover, place)
    expect(lastView(to(out, mover)).canUndo).toBe(true)
    // the idle seat sees the position move but gets no undo of its own
    expect(lastView(to(out, mover === 'A' ? 'B' : 'A')).canUndo).toBe(false)
  })

  it('takes back the last move and shows both seats the rewound position', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'
    const idle = mover === 'A' ? 'B' : 'A'
    const before = mover === 'A' ? viewA : lastView(to(b, 'B'))

    const place = before.actions.find((a) => a.type === 'place')!
    room.act(mover, place)

    const out = room.undo(mover)
    const rewound = lastView(to(out, mover))
    expect(rewound.view.board).toEqual(before.view.board)
    expect(rewound.actions).toEqual(before.actions)
    expect(rewound.canUndo).toBe(false)
    // the takeback happens in the open: the other seat gets the rewound view too
    expect(lastView(to(out, idle)).view.board).toEqual(before.view.board)
  })

  it('refuses an undo from whoever is not the player of the turn', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'
    const idle = mover === 'A' ? 'B' : 'A'
    const place = lastView(to(b, mover)).actions.find((a) => a.type === 'place')!
    room.act(mover, place)

    const out = room.undo(idle)
    expect(to(out, idle).map((m) => m.type)).toEqual(['error', 'view'])
    expect(to(out, idle)[0]).toMatchObject({ code: 'not-your-turn' })
    expect(to(out, mover)).toEqual([])
  })

  it('refuses an undo with nothing to take back, without moving the state', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'

    const out = room.undo(mover)
    expect(to(out, mover)[0]).toMatchObject({ type: 'error', code: 'cannot-undo' })
    expect(lastView(to(out, mover)).view.board).toEqual(lastView(to(b, mover)).view.board)
  })

  it('refuses an undo from someone not seated, or before the game starts', () => {
    const room = makeRoom()
    expect(room.undo('nobody')[0].message).toMatchObject({ code: 'not-seated' })
    room.sit('A')
    expect(room.undo('A')[0].message).toMatchObject({ code: 'not-started' })
  })

  it('tracks when the room was last empty', () => {
    const room = makeRoom()
    seatBoth(room)
    room.disconnect('A', 500)
    expect(room.idleSince).toBe(0)
    room.disconnect('B', 900)
    expect(room.idleSince).toBe(900)
  })
})

/** Seats A and B and plays the game out on random legal moves; returns the ending views and tokens. */
function playToEnd(room: Room) {
  const latest: Record<'A' | 'B', Extract<ServerMessage, { type: 'view' }> | undefined> = { A: undefined, B: undefined }
  const take = (out: Outbound[]) => {
    for (const client of ['A', 'B'] as const) {
      const view = lastView(to(out, client))
      if (view) latest[client] = view
    }
  }
  const a = room.sit('A')
  const b = room.sit('B')
  take(a)
  take(b)

  let rng = 1
  let steps = 0
  while (latest.A!.view.phase !== 'ended' && steps < 3000) {
    const mover = latest.A!.actions.length > 0 ? 'A' : 'B'
    const actions = latest[mover]!.actions
    const pick = nextInt(rng, actions.length)
    rng = pick.rng
    take(room.act(mover, actions[pick.value]))
    steps += 1
  }
  return { latest, take, tokens: { A: tokenOf(to(a, 'A')), B: tokenOf(to(b, 'B')) } }
}

describe('playing again', () => {
  it('is refused while the game is still on', () => {
    const room = makeRoom()
    seatBoth(room)
    expect(room.rematch('A')[0].message).toMatchObject({ type: 'error', code: 'not-ended' })
  })

  it('is refused from someone not seated, or before the game starts', () => {
    const room = makeRoom()
    expect(room.rematch('nobody')[0].message).toMatchObject({ code: 'not-seated' })
    room.sit('A')
    expect(room.rematch('A')[0].message).toMatchObject({ code: 'not-started' })
  })

  it('tells both seats who is asking, each from where it sits', () => {
    const room = makeRoom()
    playToEnd(room)
    const out = room.rematch('A')
    expect(to(out, 'A')).toEqual([{ type: 'rematch', youWant: true, opponentWants: false }])
    expect(to(out, 'B')).toEqual([{ type: 'rematch', youWant: false, opponentWants: true }])
  })

  it('starts a fresh game, with a moved game number, when the second seat agrees', () => {
    const room = makeRoom()
    const { latest } = playToEnd(room)
    expect(latest.A!.game).toBe(0)

    room.rematch('A')
    const out = room.rematch('B')
    for (const client of ['A', 'B'] as const) {
      const view = lastView(to(out, client))
      expect(view.view.phase).not.toBe('ended')
      expect(view.game).toBe(1)
      expect(view.view.you.scored).toEqual([])
    }
  })

  it('keeps the asking on the table for a seat that reconnects', () => {
    const room = makeRoom()
    const { tokens } = playToEnd(room)
    room.rematch('A')
    room.disconnect('B', 1000)

    const back = room.rejoin('B2', tokens.B)
    const messages = to(back, 'B2')
    expect(messages.find((m) => m.type === 'rematch')).toEqual({ type: 'rematch', youWant: false, opponentWants: true })

    // and the agreement still counts, from the new connection
    const out = room.rematch('B2')
    expect(lastView(to(out, 'B2')).game).toBe(1)
  })

  it('asking twice is not agreeing with yourself', () => {
    const room = makeRoom()
    playToEnd(room)
    room.rematch('A')
    const out = room.rematch('A')
    expect(to(out, 'A')).toEqual([{ type: 'rematch', youWant: true, opponentWants: false }])
    expect(out.every((o) => o.message.type !== 'view')).toBe(true)
  })

  it('a seat that leaves calls the asking off and tells the other it is alone', () => {
    const room = makeRoom()
    playToEnd(room)
    room.rematch('A')
    const out = room.leave('A', 1000)
    expect(to(out, 'B')).toEqual([{ type: 'opponentLeft' }])
    expect(to(out, 'A')).toEqual([])
    // nobody is left to agree with
    expect(to(room.rematch('B'), 'B')).toEqual([{ type: 'opponentLeft' }])
  })

  it('a seat that left cannot come back, and the one that stayed still hears it after a reconnect', () => {
    const room = makeRoom()
    const { tokens } = playToEnd(room)
    room.leave('B', 1000)
    expect(to(room.rejoin('B2', tokens.B), 'B2')[0]).toMatchObject({ type: 'error', code: 'left' })

    room.disconnect('A', 2000)
    expect(to(room.rejoin('A2', tokens.A), 'A2')).toContainEqual({ type: 'opponentLeft' })
  })
})

/**
 * Everything a view may not carry. The log is left out of the hand check:
 * a card the opponent returned with a coin and drew again later would be
 * in both, legitimately.
 */
function assertNothingLeaks(view: PlayerView, otherHandIds: string[]): void {
  const text = JSON.stringify({ ...view, log: undefined })
  expect(text).not.toContain('"rng"')
  expect(text).not.toContain('"deck":')
  expect(text).not.toContain('"extras":')
  for (const id of otherHandIds) expect(text).not.toContain(`"${id}"`)
}

describe('a whole game through a room', () => {
  it('is playable from the views alone, with no refused action and nothing leaked', () => {
    for (const seed of [1, 2, 3]) {
      const room = makeRoom(seed)
      const latest: Record<'A' | 'B', Extract<ServerMessage, { type: 'view' }> | undefined> = {
        A: undefined,
        B: undefined,
      }
      const take = (out: Outbound[]) => {
        for (const client of ['A', 'B'] as const) {
          const view = lastView(to(out, client))
          if (view) latest[client] = view
          for (const m of to(out, client)) expect(m.type).not.toBe('error')
        }
      }

      take(room.sit('A'))
      take(room.sit('B'))

      let rng = seed
      let steps = 0
      while (latest.A!.view.phase !== 'ended' && steps < 3000) {
        const mover = latest.A!.actions.length > 0 ? 'A' : 'B'
        const actions = latest[mover]!.actions
        expect(actions.length).toBeGreaterThan(0)
        const pick = nextInt(rng, actions.length)
        rng = pick.rng
        take(room.act(mover, actions[pick.value]))

        assertNothingLeaks(latest.A!.view, latest.B!.view.you.hand.map((c) => c.id))
        assertNothingLeaks(latest.B!.view, latest.A!.view.you.hand.map((c) => c.id))
        steps += 1
      }

      expect(latest.A!.view.phase).toBe('ended')
      expect(latest.B!.view.phase).toBe('ended')
      expect(latest.A!.actions).toEqual([])
      expect(latest.B!.actions).toEqual([])
    }
  })
})

describe('Room: a play at a time, and giving up', () => {
  /** Seats both, and returns who moves first and the view they opened with. */
  function opening() {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const mover = lastView(to(b, 'A')).view.current === 0 ? 'A' : 'B'
    const idle = mover === 'A' ? 'B' : 'A'
    return { room, mover, idle, before: lastView(to(b, mover)) }
  }

  it('takes back an answer together with the placement it answered, in one undo', () => {
    const { room, mover, before } = opening()
    let out = room.act(mover, before.actions.find((a) => a.type === 'place')!)
    // placed; whether there is a fire-up question depends on the token, so answer it if asked
    const answer = lastView(to(out, mover)).actions.find((a) => a.type === 'skipFireUp')
    if (answer) out = room.act(mover, answer)

    out = room.undo(mover)
    const rewound = lastView(to(out, mover))
    expect(rewound.view.board).toEqual(before.view.board)
    expect(rewound.view.pending).toEqual(before.view.pending)
  })

  it('lets either seat give up, and gives the game to the other', () => {
    const { room, idle, mover } = opening()
    const out = room.forfeit(idle)
    for (const client of [mover, idle]) {
      const view = lastView(to(out, client))
      expect(view.view.phase).toBe('ended')
      expect(view.actions).toEqual([])
      expect(view.view.log[view.view.log.length - 1]).toMatchObject({ action: { type: 'forfeit' } })
    }
  })

  it('refuses to give up a game already over, or before it starts', () => {
    const { room, mover, idle } = opening()
    room.forfeit(mover)
    expect(to(room.forfeit(idle), idle)[0]).toMatchObject({ type: 'error', code: 'already-ended' })

    const early = makeRoom()
    expect(early.forfeit('nobody')[0].message).toMatchObject({ code: 'not-seated' })
    early.sit('A')
    expect(early.forfeit('A')[0].message).toMatchObject({ code: 'not-started' })
  })

  it('takes no undo after a game given up', () => {
    const { room, mover } = opening()
    room.forfeit(mover)
    expect(to(room.undo(mover), mover)[0]).toMatchObject({ type: 'error' })
  })
})
