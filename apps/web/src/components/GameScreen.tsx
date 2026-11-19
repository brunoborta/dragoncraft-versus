import { bankedReputation, hexEq, key, wouldComplete } from '@dcv/engine'
import type { Action, Hex, PlayerView } from '@dcv/engine'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { promptFor } from '../game/labels.js'
import { boardTargets, resolveTap } from '../game/selection.js'
import type { Table } from '../game/table.js'
import { ANIMATIONS_OFF, useReducedMotion } from '../motion.js'
import { DEFAULT_TABLE_OPTIONS } from '../game/settings.js'
import type { GameOptions, TableOptions } from '../game/settings.js'
import { usePresentation } from '../game/usePresentation.js'
import { HOLD } from '../game/presentation.js'
import { Ambience } from './Ambience.js'
import { Bag, BagDialog, DeckCount } from './Bag.js'
import { Board } from './Board.js'
import { CoinPurse } from './CoinPurse.js'
import { CrystalDiscover } from './CrystalDiscover.js'
import { GameOver } from './GameOver.js'
import { Hand } from './Hand.js'
import { keepCount } from './CardView.js'
import type { Highlight } from './HexCell.js'
import { LogDialog } from './LogDialog.js'
import { CoinMoment, DrawFlight, PlaceFlight, ScoreMoment, UNDO_REVEAL_MS, UndoMoment, landingDelay } from './Moments.js'
import { FireChoice } from './FireChoice.js'
import { HeldSlot } from './HeldToken.js'
import { PlayerBar } from './PlayerBar.js'
import { OpponentThinking, Prompt } from './Prompt.js'
import { HelpDialog } from './HelpDialog.js'
import { SettingsDialog } from './SettingsDialog.js'
import { StackPeek } from './StackPeek.js'
import { TurnBanner, useTurnBanner } from './TurnBanner.js'
import { TopBar } from './TopBar.js'

/** What a tap can land on and mean something: the rest of the screen is "beside the board". */
const ANSWERS_A_TAP = '.hex-cell, button, [role="button"], .fire-choice, .stack-peek, .modal'

/**
 * A game in progress, drawn from a `Table` and nothing else. Whether the
 * other seat is the machine in this browser or a person on another phone
 * is decided above here; this screen only sees a view and the moves it may
 * make.
 */
export function GameScreen({
  table,
  view: liveView,
  label,
  detail,
  restartLabel,
  onRestart,
  playAgain,
  extras,
  paused = false,
  options = DEFAULT_TABLE_OPTIONS,
  onOptionsChange,
}: {
  table: Table
  /** The table's view, already known not to be null. */
  view: PlayerView
  /** Under "Opponent" on its plate: the level against the machine, "Friend" online. */
  label: string
  detail: string
  restartLabel: string
  onRestart: () => void
  /**
   * Another game at the same table. Against the machine `act` starts it;
   * online it asks the opponent, and `waiting`/`opponentWants` say where
   * that asking stands.
   */
  playAgain?: { act: () => void; waiting?: boolean; opponentWants?: boolean; opponentLeft?: boolean }
  /** Anything the host wants under the board: the debug hatch, a connection notice. */
  extras?: ReactNode
  /**
   * True while something covers the game before it starts (choosing the
   * opponent). The opening turn banner waits for it, or it plays unseen.
   */
  paused?: boolean
  /** How the table is shown: bag composition, card glow, reputation. */
  options?: TableOptions | GameOptions
  /** Present against the machine; absent online, where the host's choice holds for both. */
  onOptionsChange?: (next: GameOptions) => void
}) {
  const [selected, setSelected] = useState<Hex | null>(null)
  const [inspecting, setInspecting] = useState<Hex | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // a choice put aside to look at the board (the eye); it comes back with the next commit at the latest
  const [peeking, setPeeking] = useState(false)
  // the end screen opens over the board; this puts it away to look at the board
  const [viewingBoard, setViewingBoard] = useState(false)
  // the cards marked to stay in hand after a coin: the rest, always two, go back under the deck
  const [keeping, setKeeping] = useState<string[]>([])

  /*
   * A takeback, whoever made it, plays like a spent coin: the Undo arrow
   * leaves its button (the opponent's plate, when it was theirs), turns
   * backwards in the middle of the board, and only then does the board go
   * back. Until then the screen keeps the board as it was before the undo and
   * offers nothing: the arrow is the news, the board its result. Keyed by the
   * count, so two quick ones play twice; the count a screen opens with is
   * history, not news. Read during render, so not one frame shows the board
   * already back before the arrow.
   */
  const [undosSeen, setUndosSeen] = useState(table.undos)
  const [undoArrow, setUndoArrow] = useState<{ key: number; mine: boolean } | null>(null)
  const [undoHeld, setUndoHeld] = useState<PlayerView | null>(null)
  const lastView = useRef(liveView)
  if (table.undos !== undosSeen) {
    setUndosSeen(table.undos)
    if (!ANIMATIONS_OFF) {
      // after a takeback the turn is the one who took it back
      setUndoArrow({ key: table.undos, mine: liveView.current === liveView.seat })
      setUndoHeld((held) => held ?? lastView.current)
    }
  }
  useEffect(() => {
    lastView.current = liveView
  })
  useEffect(() => {
    if (!undoArrow) return
    const timer = setTimeout(() => setUndoHeld(null), UNDO_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [undoArrow])
  const undoDone = useCallback(() => setUndoArrow(null), [])
  const view = undoHeld ?? liveView

  const ended = view.phase === 'ended'
  // a new turn starts with every stack shut: what was looked at belonged to the last one
  useEffect(() => setInspecting(null), [view.current])

  /*
   * The board as it is being shown: the real one, or a step behind it while
   * moves play. The turn banner and the queue take turns: the banner waits for
   * the previous turn's moves to land, and the new turn's moves wait behind the
   * banner. `gate` reads the banner through a ref, since each hook needs the
   * other's result.
   */
  const bannerPending = useRef(false)
  const [wake, setWake] = useState(0)
  /*
   * A menu (settings, help, log, bag) covers the whole game. Against the
   * machine the game freezes under it: the machine stops, and what was still
   * playing waits, all of it resuming when the menu closes. Online nobody can
   * stop the other player, so the game goes on under the cover.
   */
  const menuOpen = settingsOpen || helpOpen || logOpen || bagOpen
  const canFreeze = table.setScreenBusy !== undefined
  const menuOver = paused || (menuOpen && canFreeze)
  const presentation = usePresentation(view, {
    gate: (event) => menuOver || (event.seat === view.current && bannerPending.current),
    wake: wake,
  })
  const turnBanner = useTurnBanner({
    current: view.current,
    seat: view.seat,
    ended: view.phase === 'ended',
    blocked: menuOver || presentation.remaining.some((event) => event.seat !== view.current),
  })
  bannerPending.current = turnBanner.pending
  useEffect(() => setWake((n) => n + 1), [turnBanner.pending, menuOver])
  /*
   * The screen catches up before it offers anything. While the opponent's
   * moves are still landing, while a turn banner is up, and while your own
   * token is still coming out of the bag, the real view may already be your
   * turn — but the panel says what the screen shows, and offers nothing yet.
   * Under test nothing is ever staged, so nothing is ever held.
   */
  const theirsLanding = presentation.remaining.some((queued) => queued.seat !== view.seat)
  const yourDrawLanding = presentation.remaining.some(
    (queued) => queued.seat === view.seat && queued.kind === 'draw' && !queued.crystal,
  )
  const catchingUp = !ANIMATIONS_OFF && (theirsLanding || yourDrawLanding || turnBanner.pending || undoHeld !== null)
  const actions = catchingUp ? [] : table.actions
  const myTurn = actions.length > 0

  // the machine waits for the screen: it never moves under a banner, a landing move or a menu
  const busy = menuOpen || (!ANIMATIONS_OFF && (presentation.playing || turnBanner.pending || undoHeld !== null))
  useEffect(() => table.setScreenBusy?.(busy), [busy, table.setScreenBusy])

  const targets = boardTargets(actions, selected)
  const pending = view.pending[view.pending.length - 1]

  /*
   * A coin discard is answered on the cards in your hand: you mark the ones
   * you keep, and the two left unmarked go back under the deck. The bar
   * carries only the confirmation, once exactly that many are marked. M11: the
   * cards are picked only after the coin has landed and the two new ones have
   * arrived.
   */
  const discarding = myTurn && pending?.kind === 'coinDiscard'
  const coinLanding = presentation.remaining.some((queued) => queued.kind === 'coin')
  const keepWanted = keepCount(view.you.hand)
  const returned = view.you.hand.filter((card) => !keeping.includes(card.id)).map((card) => card.id)
  const returnAction = actions.find(
    (candidate) =>
      candidate.type === 'coinDiscard' &&
      keeping.length === keepWanted &&
      candidate.cardIds.every((id) => returned.includes(id)),
  )
  // the crystal's choice is made on the tokens themselves (the Discover), so the bar offers nothing
  const discovering = myTurn && pending?.kind === 'crystalPick'
  const barActions = discarding ? (returnAction ? [returnAction] : []) : discovering ? [] : actions

  // the board marks what is legal, and nothing else: the printed game does not
  // point out where a card would complete, so neither does this one
  const highlights: Record<string, Highlight> = {}
  for (const hex of targets) highlights[key(hex)] = 'legal'
  if (selected) highlights[key(selected)] = 'selected'
  // the stack being peeked at keeps a quiet ring, so the corner points somewhere
  if (inspecting && !highlights[key(inspecting)]) highlights[key(inspecting)] = 'inspected'

  /*
   * The token the open decision is about glows (M4, M5): gold with sparks while
   * "Fire up this token?" is open, embers while its ability is resolving. The
   * potion's pending names no space, so it gets none.
   */
  const glows: Record<string, 'gold' | 'ember'> = {}
  if (myTurn && pending && 'at' in pending) {
    if (pending.kind === 'mayFireUp') glows[key(pending.at)] = 'gold'
    if (pending.kind === 'meat' || pending.kind === 'iron' || pending.kind === 'plant') glows[key(pending.at)] = 'ember'
  }

  // the board trembles when a token lands (M4): a one-off, driven from the event
  const boardArea = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const event = presentation.event
  useEffect(() => {
    if (reduced || event?.kind !== 'place') return
    // as the token hits: after its flight from the slot, when it is the opponent's
    boardArea.current?.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(0)' }],
      { duration: 220, delay: landingDelay(event.seat === view.seat) - 60, easing: 'ease-out' },
    )
  }, [event, reduced, view.seat])

  /*
   * M10: a plate's reputation stays behind the real figure while a scored card
   * is still to land on it — queued or flying — and counts up when it does.
   */
  const unlanded = (seat: number) =>
    presentation.remaining.reduce(
      (sum, queued) => (queued.kind === 'score' && queued.seat === seat ? sum + (queued.card?.reputation ?? 0) : sum),
      0,
    )
  const opponentSeat = (1 - view.seat) as 0 | 1

  // the spec's preview: the held token, hovering over the space it would land on
  const preview =
    selected && pending?.kind === 'place' ? { hex: selected, token: pending.token } : undefined

  /*
   * The token each side holds, as the screen shows it: yours in the tray under
   * the board, the opponent's in the slot under their portrait. It reaches its
   * home at the end of the draw's flight, so while that flight is on it waits.
   */
  const held = presentation.held
  const yourHeld = held?.seat === view.seat ? held.token : null
  const theirHeld = held?.seat === opponentSeat ? held.token : null
  const drawingFor = event?.kind === 'draw' && !event.crystal ? event.seat : null
  const arrivingIn = (seat: number) =>
    drawingFor === seat && !reduced ? (seat === view.seat ? HOLD.draw : HOLD.drawTheirs) : 0

  // "Fire up this token?" is asked on the board, around the token that just landed
  const firing = myTurn && !peeking && pending?.kind === 'mayFireUp' ? pending : null
  /*
   * A plant's chosen neighbour gets the fire-up treatment over it: a fire per
   * ability it could lend, the same I or Y as "Fire up this token?".
   */
  const borrowing =
    myTurn && !peeking && pending?.kind === 'plant' && selected
      ? { at: selected, token: view.board[key(selected)]?.at(-1) }
      : null
  const firedToken = firing ? view.board[key(firing.at)]?.at(-1) : undefined

  /*
   * The card-glow option (plan 1.1, Konzepttafel): with a token hovering over
   * a space, the cards in hand it would complete there light up. The engine
   * decides, so the glow never disagrees with what Score will accept.
   */
  const completing =
    options.cardGlow && preview
      ? new Set(
          view.you.hand.filter((card) => wouldComplete(view.board, card, preview.hex, preview.token)).map((card) => card.id),
        )
      : new Set<string>()

  // every commit, wherever it comes from, closes the preview and the stack inspector
  function handleAct(action: Action): void {
    setSelected(null)
    setInspecting(null)
    setKeeping([])
    setPeeking(false)
    table.perform(action)
  }

  function toggleKeep(cardId: string): void {
    setKeeping((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId)
      // one too many does nothing: exactly two go back, so unmark one first
      return current.length < keepWanted ? [...current, cardId] : current
    })
  }

  /**
   * A stack, opened or shut by a tap. Only a space with something buried has
   * anything to show — unless your token is about to land there, when a single
   * token is already a stack of two in the making and the corner shows both.
   */
  function lookAt(hex: Hex, landing = false): void {
    const open = inspecting !== null && hexEq(inspecting, hex)
    const height = (view.board[key(hex)] ?? []).length
    setInspecting(!open && height >= (landing ? 1 : 2) ? hex : null)
  }

  function selectHex(hex: Hex): void {
    const outcome = resolveTap(actions, selected, hex)

    if (outcome.action) {
      handleAct(outcome.action)
      return
    }

    setSelected(outcome.select)
    /*
     * Whatever the board is being used for, a tap on a stack also shows what
     * is buried in it: choosing a space to place on, picking a token up to
     * move, or only looking. Knowing what lies underneath is never wrong,
     * and hiding it cost more games than it saved taps.
     */
    const landing = pending?.kind === 'place' && outcome.select !== null && hexEq(outcome.select, hex)
    lookAt(hex, landing)
  }

  function undo(): void {
    setSelected(null)
    setInspecting(null)
    // one play at a time, and never across a draw or into the other turn
    table.undo()
  }

  /** Clears everything this screen was holding, for whatever comes next. */
  function freshStart(next: () => void): void {
    setSelected(null)
    setInspecting(null)
    setKeeping([])
    setLogOpen(false)
    setBagOpen(false)
    setSettingsOpen(false)
    setPeeking(false)
    setViewingBoard(false)
    next()
  }

  function decision() {
    if (ended) {
      // the result itself is a dialog over the board; this is what is left under it
      return (
        <section className="prompt" aria-label="Current decision">
          <div className="prompt-head">
            <p className="prompt-text">Game over</p>
            {viewingBoard ? (
              <button type="button" className="btn-secondary" onClick={() => setViewingBoard(false)}>
                Show result
              </button>
            ) : null}
          </div>
        </section>
      )
    }
    if (!myTurn) {
      // the real turn may be yours already; this says what the screen is showing
      const theirCoin = view.current !== view.seat && pending?.kind === 'coinDiscard'
      // a takeback says so until the board goes back; then the panel is the play before it
      if (undoHeld) return <OpponentThinking mode="undoing" side={undoArrow?.mine === false ? 'opponent' : 'you'} />
      const mode = theirsLanding
        ? 'playing'
        : catchingUp && view.current === view.seat
          ? 'drawing'
          : theirCoin
            ? 'choosingCards'
            : 'thinking'
      return <OpponentThinking mode={mode} />
    }
    if (peeking) {
      // the board is being looked at; the only way on is back to the choice
      return (
        <section className="prompt" aria-label="Current decision">
          <div className="prompt-head">
            <p className="prompt-text">{promptFor(view)}</p>
            <button type="button" className="btn-secondary peek-back" onClick={() => setPeeking(false)}>
              Back to your choice
            </button>
          </div>
        </section>
      )
    }
    return <Prompt view={view} actions={barActions} onAct={handleAct} />
  }

  const spendCoin = actions.find((action) => action.type === 'spendCoin')

  return (
    // a tap anywhere plays whatever is left of the queue at once: nothing waits on an animation
    <main
      ref={screenRef}
      className="app"
      data-playing={presentation.playing || undefined}
      data-event={event?.kind}
      onPointerDownCapture={() => {
        if (presentation.playing) presentation.skip()
        if (turnBanner.banner) turnBanner.dismiss()
      }}
      // a tap beside the board, where nothing answers it, lets go of a picked-up token or a chosen space
      onClick={(event) => {
        if (selected && !(event.target as Element).closest(ANSWERS_A_TAP)) setSelected(null)
      }}
    >
      <p className="sr-only" aria-live="polite">
        {presentation.announcement}
      </p>
      <Ambience />
      <TopBar
        view={view}
        label={label}
        detail={detail}
        onOpenLog={() => setLogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        showReputation={options.showReputation}
        reputation={bankedReputation(view.opponent) - unlanded(opponentSeat)}
      />
      {/*
        The coins and the bag sit in the board's lower corners, which the
        hexagon leaves empty. They are absolutely placed inside this row, so
        they never take height from the board.
      */}
      <div className="board-area" ref={boardArea}>
        <Board
          board={presentation.board}
          ids={presentation.ids}
          event={presentation.event}
          glows={glows}
          highlights={highlights}
          preview={preview}
          viewer={view.seat}
          onSelectHex={myTurn && !peeking ? selectHex : lookAt}
        />
        {/* what the tapped stack holds, in the corner the hexagon leaves empty; keyed so a new stack deals in afresh */}
        {inspecting ? (
          <StackPeek
            key={key(inspecting)}
            hex={inspecting}
            stack={view.board[key(inspecting)] ?? []}
            // the held token, while this is the space it would land on: the corner agrees with the hover
            ghost={preview && hexEq(preview.hex, inspecting) ? preview.token : undefined}
          />
        ) : null}
        {/* under their portrait, in the corner the hexagon leaves empty */}
        <HeldSlot side="opponent" token={theirHeld} arriving={arrivingIn(opponentSeat)} />
        {firing && firedToken ? (
          <FireChoice key={key(firing.at)} at={firing.at} token={firedToken} actions={actions} onAct={handleAct} area={boardArea} />
        ) : null}
        {borrowing?.token ? (
          <FireChoice
            key={`plant-${key(borrowing.at)}`}
            at={borrowing.at}
            token={borrowing.token}
            actions={actions}
            onAct={handleAct}
            area={boardArea}
          />
        ) : null}
      </div>
      <footer className="bottom">
        {extras}
        {/* one line under the board: the coin, your token's home, the bag */}
        <div className="tray-row">
          <CoinPurse
            coins={view.you.coins}
            canSpend={spendCoin !== undefined && !discarding}
            onSpend={() => {
              if (spendCoin) handleAct(spendCoin)
            }}
          />
          <HeldSlot side="you" token={yourHeld} arriving={arrivingIn(view.seat)} away={preview !== undefined} />
          {/* the two things that run out and end the game: the bag, the deck under it */}
          <div className="bag-corner">
            <Bag bag={view.bag} onOpen={options.bagComposition ? () => setBagOpen(true) : undefined} drawing={drawingFor !== null} />
            <DeckCount count={view.deckCount} />
          </div>
        </div>
        <Hand
          view={view}
          actions={actions}
          onAct={handleAct}
          completing={completing}
          highlightScoreable={options.cardGlow}
          picking={discarding && !coinLanding ? { picked: keeping, onToggle: toggleKeep } : undefined}
        />
        {decision()}
        <PlayerBar
          reputationShown={bankedReputation(view.you) - unlanded(view.seat)}
          view={view}
          actions={actions}
          myTurn={myTurn && !ended}
          onAct={handleAct}
          canUndo={table.canUndo && undoHeld === null}
          onUndo={undo}
        />
      </footer>
      {helpOpen ? <HelpDialog onClose={() => setHelpOpen(false)} /> : null}
      {settingsOpen ? (
        <SettingsDialog
          options={options}
          onChange={onOptionsChange}
          onForfeit={
            ended || paused
              ? undefined
              : () => {
                  setSettingsOpen(false)
                  setSelected(null)
                  setInspecting(null)
                  table.forfeit()
                }
          }
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {logOpen ? <LogDialog view={view} onClose={() => setLogOpen(false)} /> : null}
      {bagOpen ? <BagDialog bag={view.bag} onClose={() => setBagOpen(false)} /> : null}
      {discovering && !peeking && pending?.kind === 'crystalPick' ? (
        <CrystalDiscover tokens={pending.tokens} actions={actions} onAct={handleAct} onPeek={() => setPeeking(true)} />
      ) : null}
      {/* the flights between the bag, the hands and the board cross rows, so they are drawn over the whole screen */}
      {event?.kind === 'draw' && !event.crystal ? (
        <DrawFlight key={event.seq} event={event} seat={view.seat} within={screenRef.current} />
      ) : null}
      {event?.kind === 'place' && event.seat !== view.seat ? (
        <PlaceFlight key={event.seq} event={event} within={screenRef.current} />
      ) : null}
      {event?.kind === 'score' ? <ScoreMoment key={event.seq} event={event} seat={view.seat} within={screenRef.current} /> : null}
      {event?.kind === 'coin' ? <CoinMoment key={event.seq} event={event} seat={view.seat} within={screenRef.current} /> : null}
      {undoArrow !== null ? (
        <UndoMoment key={undoArrow.key} within={screenRef.current} mine={undoArrow.mine} onDone={undoDone} />
      ) : null}
      <TurnBanner banner={turnBanner.banner} onDismiss={turnBanner.dismiss} />
      {ended && !viewingBoard ? (
        // a tap outside the result puts it away, the same as its X
        <div
          className="modal-backdrop game-over-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewingBoard(true)
          }}
        >
          <GameOver
            view={view}
            opponentLabel={table.opponentLabel}
            restartLabel={restartLabel}
            onRestart={() => freshStart(onRestart)}
            playAgain={
              playAgain
                ? {
                    act: () => freshStart(playAgain.act),
                    waiting: playAgain.waiting ?? false,
                    opponentWants: playAgain.opponentWants ?? false,
                    opponentLeft: playAgain.opponentLeft ?? false,
                    opponentGone: !table.opponentConnected,
                  }
                : undefined
            }
            onClose={() => setViewingBoard(true)}
          />
        </div>
      ) : null}
    </main>
  )
}
