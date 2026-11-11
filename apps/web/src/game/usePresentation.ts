import type { Board, LogEntry, PlayerView } from '@dcv/engine'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ANIMATIONS_OFF, useReducedMotion } from '../motion.js'
import { describeLogEntry } from './log.js'
import {
  eventDuration,
  heldFromView,
  idsOf,
  markCrystalDraws,
  memoryFromView,
  newEntries,
  presentBoard,
  sameBoard,
  script,
  toBoard,
} from './presentation.js'
import type { Held, PresentationEvent, PresentedBoard, ScriptMemory } from './presentation.js'

export type Presentation = {
  /** The board to draw: the real one, or a step behind it while the queue plays. */
  board: Board
  /** Token identities on that board, bottom to top per space. */
  ids: Record<string, string[]>
  /** The event on screen right now: what the choreography is playing. */
  event: PresentationEvent | null
  /** The event on screen and everything still queued behind it. */
  remaining: PresentationEvent[]
  /** True while there is still something to play. */
  playing: boolean
  /** Plays everything left at once: a tap anywhere does this. */
  skip: () => void
  /** The latest of the opponent's moves, worded for a screen reader. */
  announcement: string
  /**
   * The token in hand as the screen shows it, and whose: it reaches the tray
   * or slot with the draw that brought it and leaves with the placement — a
   * step behind the view, like the board.
   */
  held: Held | null
}

type State = {
  shown: PresentedBoard
  held: Held | null
  queue: PresentationEvent[]
  event: PresentationEvent | null
  announcement: string
}

export type PresentationOptions = {
  /**
   * Asked before each event goes up; true holds it back. The turn banner uses
   * this to keep the new turn's moves behind the banner that announces it.
   */
  gate?: (event: PresentationEvent) => boolean
  /** Any value whose change means the gate should be asked again. */
  wake?: unknown
}

/**
 * Plays the difference between views as a queue of events.
 *
 * The truth — what can be tapped, what the game accepts — is always the
 * current view; this only decides how the board gets there. Undo, a
 * reconnection or anything the script cannot explain snaps straight to the
 * view. Under test every event takes no time, so the board is always the real
 * one and nothing a test does has to wait.
 */
export function usePresentation(view: PlayerView, options: PresentationOptions = {}): Presentation {
  const reduced = useReducedMotion()
  const counter = useRef(0)
  const nextId = useCallback(() => `p${++counter.current}`, [])
  const gate = useRef(options.gate)
  gate.current = options.gate

  // what the script has consumed so far, and where it left the board
  const consumed = useRef<{ log: LogEntry[]; board: PresentedBoard; memory: ScriptMemory } | null>(null)
  if (consumed.current === null) {
    consumed.current = { log: view.log, board: presentBoard(view.board, nextId), memory: memoryFromView(view) }
  }

  // skip snaps the hand to the view as well, and runs outside the effect that sees it
  const latest = useRef(view)
  latest.current = view

  const [state, setState] = useState<State>(() => ({
    shown: consumed.current!.board,
    held: heldFromView(view),
    queue: [],
    event: null,
    announcement: '',
  }))

  useEffect(() => {
    const before = consumed.current!
    const added = newEntries(before.log, view.log)

    const snap = () => {
      const board = presentBoard(view.board, nextId)
      consumed.current = { log: view.log, board, memory: memoryFromView(view) }
      setState({ shown: board, held: heldFromView(view), queue: [], event: null, announcement: '' })
    }

    if (added === null) return snap()
    if (added.length === 0) return

    let played: ReturnType<typeof script>
    try {
      played = script(before.board, added, before.memory, nextId, before.log.length)
    } catch {
      return snap()
    }
    // the script must land exactly where the view is, or it is not to be trusted
    if (!sameBoard(toBoard(played.board), view.board)) return snap()

    // the player's own crystal: its pick is still open, its draws belong to the Discover
    const top = view.pending[view.pending.length - 1]
    if (top?.kind === 'crystalPick') markCrystalDraws(played.events, top.tokens.length)

    consumed.current = { log: view.log, board: played.board, memory: played.memory }
    const theirs = added.filter((entry) => entry.seat !== view.seat)
    const announcement = theirs.length ? theirs.map((entry) => describeLogEntry(entry, view.seat)).join('. ') : ''

    setState((current) => {
      if (ANIMATIONS_OFF) {
        return {
          shown: played.board,
          held: heldFromView(view),
          queue: [],
          event: null,
          announcement: announcement || current.announcement,
        }
      }
      return { ...current, queue: [...current.queue, ...played.events], announcement: announcement || current.announcement }
    })
  }, [view, nextId])

  /*
   * The player: with nothing on screen, put the next event up (its board
   * becomes the shown board) unless the gate holds it; with an event on
   * screen, hold it for its slot, then take it down — which puts up the next.
   */
  useEffect(() => {
    if (state.event === null) {
      const next = state.queue[0]
      if (!next || gate.current?.(next)) return
      setState((current) => {
        const [first, ...rest] = current.queue
        if (!first) return current
        // a crystal's draws belong to its Discover: the hand does not change until the pick
        const changesHand = first.held !== undefined && !(first.kind === 'draw' && first.crystal)
        const held = changesHand ? (first.held ? { seat: first.seat, token: first.held } : null) : current.held
        return { ...current, shown: first.board, held, event: first, queue: rest }
      })
      return
    }
    const timer = setTimeout(
      () => setState((current) => ({ ...current, event: null })),
      eventDuration(state.event, view.seat, reduced),
    )
    return () => clearTimeout(timer)
  }, [state.event, state.queue, reduced, view.seat, options.wake])

  const skip = useCallback(() => {
    setState((current) => {
      if (current.queue.length === 0 && !current.event) return current
      return { ...current, shown: consumed.current!.board, held: heldFromView(latest.current), queue: [], event: null }
    })
  }, [])

  return {
    board: toBoard(state.shown),
    ids: idsOf(state.shown),
    event: state.event,
    remaining: state.event ? [state.event, ...state.queue] : state.queue,
    playing: state.queue.length > 0 || state.event !== null,
    skip,
    announcement: state.announcement,
    held: state.held,
  }
}
