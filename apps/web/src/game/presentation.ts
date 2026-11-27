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
/**
 * `seq` is the entry's position in the log: the one stable identity an event has.
 * A takeback's events get negative ones, since the log positions they play
 * back are about to be reused by whatever is played next.
 * `held` is the token the acting seat holds once the event is done — what its
 * tray or slot shows from then on; absent where the script did not say.
 * `undo` marks the events of a takeback: the arrow, and the play run backwards.
 */
export type PresentationEvent = {
  seat: Seat
  entry: LogEntry
  seq: number
  board: PresentedBoard
  held?: Token | null
  undo?: true
} & (
  /**
   * `crystal`: one of the three a crystal drew — it flies to the arch of
   * choices over the board, not to the tray. `drawIndex` is its place in the
   * run of draws, which for a crystal's is its slot in that arch.
   */
  | { kind: 'draw'; token: Token; crystal: boolean; drawIndex: number }
  /**
   * The crystal's pick resolving: the kept token (`tokens[index]`) slides from
   * its arch slot onto the tray's cushion, the others shrink back into the bag.
   */
  | { kind: 'crystalKeep'; tokens: Token[]; index: number }
  /**
   * The crystal's pick taken back — `crystalKeep` run backwards: the kept
   * token (`tokens[index]`) leaves the cushion for its slot in the arch, and
   * the others come out of the bag back to theirs. The pick is open again.
   */
  | { kind: 'crystalUnkeep'; tokens: Token[]; index: number }
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
  /**
   * A takeback announced: the Undo arrow turns once on the pillow of whoever
   * asked. The board stays as it was until the arrow is gone.
   */
  | { kind: 'undo' }
  /** A placement taken back: the token lifts off `at` and flies home to its owner's pillow. */
  | { kind: 'unplace'; at: Hex; id: string; token: Token }
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

/**
 * The same board, named against one already on screen: a token that has not
 * moved keeps the name it had.
 *
 * `presentBoard` alone names every token anew, and a name is what the board
 * draws a token by — so a fresh set of names rebuilds every token on the
 * board, and the whole board blinks. That is what an undo looked like. Stacks
 * only ever grow and shrink at the top, so the tokens that stayed are the ones
 * matching from the bottom up: those keep their names, and only what the
 * takeback actually changed is new.
 */
export function renameBoard(shown: PresentedBoard, board: Board, nextId: () => string): PresentedBoard {
  const presented: PresentedBoard = {}
  for (const [space, stack] of Object.entries(board)) {
    if (stack.length === 0) continue
    const before = shown[space] ?? []
    // from the first token that differs, everything above it is new
    let matching = true
    presented[space] = stack.map((token, index) => {
      const was = before[index]
      matching = matching && !!was && sameToken(was.token, token)
      return matching ? was! : { token, id: nextId() }
    })
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
 * the plantTarget must not end the run. (Its event is shown before those draws.)
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
        const event: PresentationEvent = {
          ...base,
          kind: 'draw',
          token: action.token,
          crystal: crystalRun,
          drawIndex: draws.length - 1,
          board,
        }
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
      case 'plantTarget': {
        // logged after its effects: the draws it caused are the run, so keep it
        if (action.ability === 'crystal') markCrystal()
        // but shown before them, as it happened: the vine reaches the token and it catches, then it draws
        const fire: PresentationEvent = { ...base, kind: 'fireUp', ability: action.ability, at: action.at, from: plantAt ?? undefined, board }
        const first = runDraws.length > 0 ? events.indexOf(runDraws[0]) : -1
        if (first >= 0) events.splice(first, 0, fire)
        else events.push(fire)
        // a plant borrowed through a plant: the chain goes on from the new one
        plantAt = action.ability === 'plant' ? action.at : plantAt
        break
      }
      case 'crystalPick': {
        const kept = draws[action.index]
        if (!kept) throw new Error('presentation: a crystal pick with no draws to pick from')
        markCrystal()
        held = kept
        events.push({ ...base, kind: 'crystalKeep', tokens: draws, index: action.index, board })
        draws = []
        runDraws = []
        crystalRun = false
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
    // every entry pushes exactly one event: tell it what is in hand now
    events[events.length - 1].held = held
  }

  return { events, board, memory: { held, draws, placedAt, plantAt } }
}

/**
 * The entries a takeback removed: `next` is `previous` cut short, the rest of
 * it intact. Null when the log did not shrink, or shrank into something else —
 * a new game, a reconnection to another table. Only the last kept entry is
 * compared, as `newEntries` does: a log is never rewritten in the middle.
 */
export function takenBack(previous: readonly LogEntry[], next: readonly LogEntry[]): LogEntry[] | null {
  if (next.length >= previous.length) return null
  const last = next.length - 1
  if (last >= 0 && JSON.stringify(previous[last]) !== JSON.stringify(next[last])) return null
  return previous.slice(next.length)
}

/**
 * A play run backwards: the entries a takeback removed, last first, each
 * undone on the presented board with the same push and pop the script uses —
 * so every token keeps its name, and the board goes back exactly as it came.
 *
 * - a placement lifts off its space and goes back to its owner's hand;
 * - a move slides back where it came from (`from` and `to` exchanged);
 * - a swap swaps back;
 * - a crystal's pick goes back to the arch it was made from: `draws` are the
 *   tokens it offered, which the log does not repeat — the view the takeback
 *   lands on has them, in its open pick.
 *
 * Everything else leaves the board alone — the answers (fire up or not, done
 * moving, which neighbour a plant borrows), a discard — and plays nothing. A
 * draw is never taken back, nor a scored card: undo stops at either.
 *
 * Throws when an entry does not fit the board, like `script`.
 */
export function unscript(
  start: PresentedBoard,
  undone: readonly LogEntry[],
  nextSeq: () => number,
  draws: readonly Token[] = [],
): { events: PresentationEvent[]; board: PresentedBoard } {
  let board = start
  const events: PresentationEvent[] = []

  for (let index = undone.length - 1; index >= 0; index -= 1) {
    const entry = undone[index]
    const { seat, action } = entry
    const base = { seat, entry, undo: true as const }
    switch (action.type) {
      case 'place': {
        const lifted = pop(board, action.at)
        board = lifted.board
        const { id, token } = lifted.entry
        events.push({ ...base, seq: nextSeq(), kind: 'unplace', at: action.at, id, token, board, held: token })
        break
      }
      case 'meatMove':
      case 'ironMove': {
        const lifted = pop(board, action.to)
        board = push(lifted.board, action.from, lifted.entry)
        const by = action.type === 'meatMove' ? 'meat' : 'iron'
        events.push({ ...base, seq: nextSeq(), kind: 'move', from: action.to, to: action.from, id: lifted.entry.id, by, board })
        break
      }
      case 'potionSwap': {
        // a swap is its own inverse
        const a = pop(board, action.a)
        const b = pop(a.board, action.b)
        board = push(push(b.board, action.a, b.entry), action.b, a.entry)
        events.push({ ...base, seq: nextSeq(), kind: 'swap', a: action.a, b: action.b, ids: [a.entry.id, b.entry.id], board })
        break
      }
      case 'crystalPick': {
        if (!draws[action.index]) throw new Error('presentation: a pick taken back with nothing to pick from')
        // the kept token leaves the hand: the cushion is empty again, the choice open
        events.push({ ...base, seq: nextSeq(), kind: 'crystalUnkeep', tokens: [...draws], index: action.index, board, held: null })
        break
      }
      default:
        break
    }
  }

  return { events, board }
}

/**
 * A takeback as the screen tells it. First the Undo arrow turns, over the
 * board as it was. Then the play runs backwards (`unscript`). Last, a step
 * with no time of its own puts the hand where the view says it is, and lands
 * the board exactly on the view.
 *
 * `to` is that view: its board, the token in hand, and the crystal's draws
 * when the takeback reopens a pick.
 *
 * When the play cannot be run backwards onto the view, the arrow still turns,
 * and then the board simply goes back: named against the board on screen
 * (`renameBoard`), so only what changed is redrawn.
 */
export function takeBack(
  start: PresentedBoard,
  undone: readonly LogEntry[],
  to: { board: Board; held: Token | null; draws: readonly Token[] },
  nextId: () => string,
  nextSeq: () => number,
): { events: PresentationEvent[]; board: PresentedBoard } {
  const last = undone[undone.length - 1]
  if (!last) return { events: [], board: start }
  const base = { seat: last.seat, entry: last, undo: true as const }
  const announced = nextSeq()

  let backwards: ReturnType<typeof unscript> | null
  try {
    backwards = unscript(start, undone, nextSeq, to.draws)
  } catch {
    backwards = null
  }
  if (backwards && !sameBoard(toBoard(backwards.board), to.board)) backwards = null

  const steps = backwards?.events ?? []
  const board = backwards?.board ?? renameBoard(start, to.board, nextId)
  return {
    board,
    events: [
      { ...base, seq: announced, kind: 'undo', board: start },
      ...steps,
      { ...base, seq: nextSeq(), kind: 'other', board, held: to.held },
    ],
  }
}

/**
 * Marks the last `count` draw events as a crystal's. For when the pick is still
 * open in the view (the player's own crystal): the draws arrived in this batch,
 * the pick has not happened yet, and they belong to the arch of choices — they
 * must fly there, not to the tray.
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

/**
 * The token in someone's hand: in your tray under the board, or in the
 * opponent's slot under their portrait. What the view says, before any event
 * has played or after the screen snaps to it.
 */
export type Held = { seat: Seat; token: Token }

export function heldFromView(view: Pick<PlayerView, 'pending' | 'current'>): Held | null {
  const top = view.pending[view.pending.length - 1]
  return top?.kind === 'place' ? { seat: view.current, token: top.token } : null
}

/**
 * How long the opponent's token takes to fly from their slot to the space it
 * lands on, before it drops. Yours needs no flight: it is already hovering over
 * the space from your first tap.
 */
export const FLIGHT = 480

/** The slots of the choreography, in milliseconds: how long each moment holds the screen. */
export const HOLD = {
  draw: 1300,
  drawTheirs: 900,
  /** One of a crystal's three, bag to arch: quicker than a lone draw, there are three in a row. */
  crystalDraw: 800,
  /** The pick resolving: the kept token to the cushion, the others back into the bag. */
  crystalKeep: 650,
  place: 450,
  move: 450,
  swap: 600,
  fireUp: 650,
  vine: 850,
  score: 1400,
  coin: 1200,
  /** The Undo arrow's turn, before the play runs backwards. */
  undo: 680,
  /**
   * A placement taken back: the flight home, then the pillow's own landing
   * (260ms, `held-arrive`) finishing before anything else moves.
   */
  unplace: FLIGHT + 300,
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
      // a crystal's draws fly to its arch on the drawer's own screen; the other side sees only the pick
      if (event.crystal) return mine && !reduced ? HOLD.crystalDraw : 0
      return reduced ? HOLD.reduced * 2 : mine ? HOLD.draw : HOLD.drawTheirs
    case 'crystalKeep':
    case 'crystalUnkeep':
      // only the drawer's screen has an arch to resolve; the other side sees the pick in the slot
      return mine && !reduced ? HOLD.crystalKeep : 0
    case 'place':
      // theirs flies in from the slot first, then lands like yours, a little quicker
      return reduced ? HOLD.reduced : mine ? HOLD.place : FLIGHT + theirs(HOLD.place)
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
      // the same length for both sides: the opponent's coin is easy to miss, and it changes their hand
      return reduced ? HOLD.reduced * 2 : HOLD.coin
    case 'undo':
      // the same for both sides: it is the one sign that the next moves are a takeback, not a play
      return reduced ? HOLD.reduced * 2 : HOLD.undo
    case 'unplace':
      return reduced ? HOLD.reduced : HOLD.unplace
    default:
      return 0
  }
}
