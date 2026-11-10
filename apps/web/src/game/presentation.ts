import { DECK, findMatch, key } from '@dcv/engine'
import type { Board, DragonType, Hex, LogEntry, PlayerView, Seat, ShopCard, Token } from '@dcv/engine'

/**
 * The presentation layer (v3 plan, section 5). The screen used to paint the
 * latest view directly, so a machine turn — or a chain of plant activations —
 * arrived as one jump. To animate, the screen needs to know what happened, not
 * only how it ended up. The log already says it: the entries that are new
 * between two views are exactly the script to play.
 *
 * Everything in this file is pure. The hook that plays it lives in
 * `usePresentation.ts`.
 */

/** A token on the presented board, with an identity that survives moves. */
export type PresentedToken = { token: Token; id: string }
export type PresentedBoard = Record<string, PresentedToken[]>

/**
 * One step of the script. Every event carries the board as it stands after
 * it, so playing the queue is just walking these snapshots, and an animation
 * knows both ends of its movement.
 */
/** `seq` is the entry's position in the log: the one stable identity an event has. */
export type PresentationEvent = { seat: Seat; entry: LogEntry; seq: number; board: PresentedBoard } & (
  /** `crystal`: one of the three a crystal drew — shown by the Discover, not by the bag. */
  | { kind: 'draw'; token: Token; crystal: boolean }
  | { kind: 'place'; at: Hex; id: string; token: Token }
  /**
   * `at` is the token that fired; null when the script cannot tell (a fire-up
   * before any placement it saw). `from` is the plant a vine grows out of,
   * when the ability was borrowed through one.
   */
  | { kind: 'fireUp'; ability: DragonType; at: Hex | null; from?: Hex }
  | { kind: 'move'; from: Hex; to: Hex; id: string; by: 'meat' | 'iron' }
  | { kind: 'swap'; a: Hex; b: Hex; ids: [string, string] }
  /** The card and the three spaces it matched, found by the engine on the board as it stood. */
  | { kind: 'score'; cardId: string; card: ShopCard | null; hexes: Hex[] }
  | { kind: 'coin' }
  | { kind: 'endTurn' }
  | { kind: 'other' }
)

export type PresentationEventKind = PresentationEvent['kind']

/**
 * The engine gives tokens no identity. To show a token travelling from one
 * space to another — not vanishing here and appearing there — the presented
 * board names each token when it lands and carries the name with it.
 */
export function presentBoard(board: Board, nextId: () => string): PresentedBoard {
  const presented: PresentedBoard = {}
  for (const [space, stack] of Object.entries(board)) {
    if (stack.length > 0) presented[space] = stack.map((token) => ({ token, id: nextId() }))
  }
  return presented
}

/** Back to what the engine and the board component speak. */
export function toBoard(presented: PresentedBoard): Board {
  const board: Board = {}
  for (const [space, stack] of Object.entries(presented)) {
    if (stack.length > 0) board[space] = stack.map((entry) => entry.token)
  }
  return board
}

/** The ids on each space, bottom to top. */
export function idsOf(presented: PresentedBoard): Record<string, string[]> {
  return Object.fromEntries(Object.entries(presented).map(([space, stack]) => [space, stack.map((entry) => entry.id)]))
}

function sameToken(a: Token, b: Token): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** True when two boards hold the same tokens in the same stacks. */
export function sameBoard(a: Board, b: Board): boolean {
  const spaces = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const space of spaces) {
    const x = a[space] ?? []
    const y = b[space] ?? []
    if (x.length !== y.length) return false
    if (x.some((token, index) => !sameToken(token, y[index]))) return false
  }
  return true
}

/**
 * The entries `next` has beyond `previous`, or null when `next` is not a
 * continuation of it — an undo, a reconnection, a new game. Those are not
 * animated: the screen snaps to the new view.
 */
export function newEntries(previous: readonly LogEntry[], next: readonly LogEntry[]): LogEntry[] | null {
  if (next.length < previous.length) return null
  if (previous.length > 0) {
    const last = previous.length - 1
    if (JSON.stringify(previous[last]) !== JSON.stringify(next[last])) return null
  }
  return next.slice(previous.length)
}

/**
 * What the script needs to remember between entries: which token is in hand
 * (a `place` entry names the space, not the token), and the run of draws just
 * made (a crystal pick names an index into them).
 *
 * The run is the draws since the last other entry, with one exception the
 * engine forces: a plant logs its activation *after* the effects it caused, so
 * a crystal fired through a plant reads draw, draw, draw, plantTarget, pick —
 * the plantTarget must not end the run.
 */
export type ScriptMemory = {
  held: Token | null
  draws: Token[]
  /** Where the last token landed: the one a fire-up refers to. */
  placedAt: Hex | null
  /** The plant whose ability chain is open: where the next vine grows from. */
  plantAt: Hex | null
}

export const EMPTY_MEMORY: ScriptMemory = { held: null, draws: [], placedAt: null, plantAt: null }

/**
 * The memory a view implies on its own, for when the script starts mid-game:
 * the first view, a reconnection, an undo. Whatever was drawn before it is
 * already in the log, but the open decision says what is in hand — a `place`
 * names its token, a crystal pick names its draws.
 */
export function memoryFromView(view: Pick<PlayerView, 'pending'>): ScriptMemory {
  const top = view.pending[view.pending.length - 1]
  const at = top && 'at' in top ? top.at : null
  if (top?.kind === 'place') return { ...EMPTY_MEMORY, held: top.token }
  if (top?.kind === 'crystalPick') return { ...EMPTY_MEMORY, draws: [...top.tokens] }
  if (top?.kind === 'plant') return { ...EMPTY_MEMORY, placedAt: at, plantAt: at }
  return { ...EMPTY_MEMORY, placedAt: at }
}

function push(board: PresentedBoard, at: Hex, entry: PresentedToken): PresentedBoard {
  const space = key(at)
  return { ...board, [space]: [...(board[space] ?? []), entry] }
}

function pop(board: PresentedBoard, at: Hex): { board: PresentedBoard; entry: PresentedToken } {
  const space = key(at)
  const stack = board[space] ?? []
  const entry = stack[stack.length - 1]
  if (!entry) throw new Error(`presentation: nothing to lift at ${space}`)
  const next = { ...board }
  if (stack.length === 1) delete next[space]
  else next[space] = stack.slice(0, -1)
  return { board: next, entry }
}

/**
 * Turns log entries into events, walking the presented board forward one
 * entry at a time — the same operations the engine performs (push, move the
 * top, swap the tops), applied to tokens that carry ids.
 *
 * Throws when an entry does not fit the board (it would mean the script and
 * the view disagree); the caller treats that as "snap to the view".
 */
export function script(
  start: PresentedBoard,
  entries: readonly LogEntry[],
  memory: ScriptMemory,
  nextId: () => string,
  /** Where `entries` start in the full log, for `seq`. */
  offset = 0,
): { events: PresentationEvent[]; board: PresentedBoard; memory: ScriptMemory } {
  let board = start
  let { held, draws, placedAt, plantAt } = memory
  const events: PresentationEvent[] = []
  // the draw events of the current run, to mark as the crystal's when a pick follows
  let runDraws: PresentationEvent[] = []
  let crystalRun = false
  const markCrystal = () => {
    for (const event of runDraws) if (event.kind === 'draw') event.crystal = true
  }

  for (const [index, entry] of entries.entries()) {
    const { seat, action } = entry
    const base = { seat, entry, seq: offset + index }
    switch (action.type) {
      case 'draw': {
        held = action.token
        draws = [...draws, action.token]
        const event: PresentationEvent = { ...base, kind: 'draw', token: action.token, crystal: crystalRun, board }
        runDraws.push(event)
        events.push(event)
        break
      }
      case 'fireUp':
        // logged before its effects: whatever it draws starts a new run
        draws = []
        runDraws = []
        crystalRun = action.ability === 'crystal'
        if (action.ability === 'plant') plantAt = placedAt
        events.push({ ...base, kind: 'fireUp', ability: action.ability, at: placedAt, board })
        break
      case 'plantTarget':
        // logged after its effects: the draws it caused are the run, so keep it
        if (action.ability === 'crystal') markCrystal()
        events.push({ ...base, kind: 'fireUp', ability: action.ability, at: action.at, from: plantAt ?? undefined, board })
        // a plant borrowed through a plant: the chain goes on from the new one
        plantAt = action.ability === 'plant' ? action.at : plantAt
        break
      case 'crystalPick': {
        const kept = draws[action.index]
        if (!kept) throw new Error('presentation: a crystal pick with no draws to pick from')
        markCrystal()
        held = kept
        draws = []
        runDraws = []
        crystalRun = false
        events.push({ ...base, kind: 'other', board })
        break
      }
      case 'place': {
        draws = []
        runDraws = []
        crystalRun = false
        if (!held) throw new Error('presentation: a placement with nothing in hand')
        const placed = { token: held, id: nextId() }
        board = push(board, action.at, placed)
        events.push({ ...base, kind: 'place', at: action.at, id: placed.id, token: held, board })
        held = null
        placedAt = action.at
        break
      }
      case 'meatMove':
      case 'ironMove': {
        const lifted = pop(board, action.from)
        board = push(lifted.board, action.to, lifted.entry)
        events.push({
          ...base,
          kind: 'move',
          from: action.from,
          to: action.to,
          id: lifted.entry.id,
          by: action.type === 'meatMove' ? 'meat' : 'iron',
          board,
        })
        break
      }
      case 'potionSwap': {
        const a = pop(board, action.a)
        const b = pop(a.board, action.b)
        board = push(push(b.board, action.a, b.entry), action.b, a.entry)
        events.push({ ...base, kind: 'swap', a: action.a, b: action.b, ids: [a.entry.id, b.entry.id], board })
        break
      }
      case 'scoreCard': {
        const card = DECK.find((candidate) => candidate.id === action.cardId) ?? null
        const hexes = card ? (findMatch(toBoard(board), card) ?? []) : []
        events.push({ ...base, kind: 'score', cardId: action.cardId, card, hexes, board })
        break
      }
      case 'spendCoin':
        events.push({ ...base, kind: 'coin', board })
        break
      case 'endTurn':
        events.push({ ...base, kind: 'endTurn', board })
        break
      default:
        events.push({ ...base, kind: 'other', board })
    }
  }

  return { events, board, memory: { held, draws, placedAt, plantAt } }
}

/**
 * Marks the last `count` draw events as a crystal's. For when the pick is still
 * open in the view (the player's own crystal): the draws arrived in this batch,
 * the pick has not happened yet, and the Discover is their moment — the bag
 * must not announce them one by one.
 */
export function markCrystalDraws(events: PresentationEvent[], count: number): void {
  let left = count
  for (let i = events.length - 1; i >= 0 && left > 0; i--) {
    const event = events[i]
    if (event.kind === 'draw') {
      event.crystal = true
      left--
    }
  }
}

/** The slots of the choreography, in milliseconds: how long each moment holds the screen. */
export const HOLD = {
  draw: 1300,
  drawTheirs: 900,
  place: 450,
  move: 450,
  swap: 600,
  fireUp: 650,
  vine: 850,
  score: 1400,
  coin: 800,
  reduced: 160,
} as const

/** How much of a moment's time the opponent's version takes (M13). */
export const THEIRS = 0.8

/**
 * How long an event holds the screen before the next one plays (plan M2, M4,
 * M5, M7–M9). Under reduced motion every moment is a short crossfade. Events
 * that have no moment of their own (yet) take no time.
 */
export function eventDuration(
  event: Pick<PresentationEvent, 'kind'> & Partial<PresentationEvent>,
  seat: Seat,
  reduced: boolean,
): number {
  const mine = event.seat === undefined || event.seat === seat
  // M13: the opponent's moments are the same, a little quicker — you watch, you do not act
  const theirs = (ms: number) => (mine ? ms : Math.round(ms * THEIRS))
  switch (event.kind) {
    case 'draw':
      if (event.crystal) return 0
      return reduced ? HOLD.reduced * 2 : mine ? HOLD.draw : HOLD.drawTheirs
    case 'place':
      return reduced ? HOLD.reduced : theirs(HOLD.place)
    case 'move':
      return reduced ? HOLD.reduced : theirs(HOLD.move)
    case 'swap':
      return reduced ? HOLD.reduced : theirs(HOLD.swap)
    case 'fireUp':
      if (event.at === null) return 0
      return reduced ? HOLD.reduced : theirs(event.from ? HOLD.vine : HOLD.fireUp)
    case 'score':
      return reduced ? HOLD.reduced * 3 : theirs(HOLD.score)
    case 'coin':
      return reduced ? HOLD.reduced * 2 : theirs(HOLD.coin)
    default:
      return 0
  }
}
