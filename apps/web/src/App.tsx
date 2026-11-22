import type { Difficulty } from '@dcv/ai'
import { useEffect, useState } from 'react'
import { Closed, Connection } from './components/Connection.js'
import { GameScreen } from './components/GameScreen.js'
import { LEVEL_LABEL, ModeSetup } from './components/ModeSetup.js'
import type { Start } from './components/ModeSetup.js'
import { RoomLobby } from './components/RoomLobby.js'
import { findGame, findNearEnd, isDebugEnabled, type Outcome } from './game/debug.js'
import { parseRoute, roomHash } from './game/route.js'
import { HUMAN_SEAT } from './game/seats.js'
import { randomSeed } from './game/seed.js'
import { loadTableOptions } from './game/settings.js'
import type { GameOptions, TableOptions } from './game/settings.js'
import { serverUrl } from './game/serverUrl.js'
import { useLocalTable } from './game/useLocalTable.js'
import { useRemoteTable } from './game/useRemoteTable.js'
import { useTutorialTable } from './game/tutorial/useTutorialTable.js'
import { Coach } from './components/Coach.js'
import { TutorialDebug } from './components/TutorialDebug.js'
import { LESSONS } from './game/tutorial/lessons.js'
import { useArt } from './art/ArtContext.js'
import type { Lesson } from './game/tutorial/script.js'
import type { Connect } from './game/useRemoteTable.js'

/**
 * `seed` is for tests and for replaying a game someone reported. Left out — as
 * it is in the real app — every game draws its own. `debug` likewise defaults
 * to what the URL fragment says. `server` and `connect` let a test stand in
 * for the build-time server address and the browser's WebSocket.
 */
export function App({
  seed: given,
  debug,
  server,
  connect,
  lessons,
}: {
  seed?: number
  debug?: boolean
  server?: string | null
  connect?: Connect
  /** A shorter course than Maple's, for a test to reach the end of. */
  lessons?: readonly Lesson[]
} = {}) {
  const debugging = debug ?? isDebugEnabled(globalThis.location?.hash ?? '')
  const url = server === undefined ? serverUrl() : server
  const [route, setRoute] = useState(() => parseRoute(globalThis.location?.hash ?? ''))
  // null until chosen: the game does not start, and the machine does not move,
  // before the player has picked who they are playing against
  const [start, setStart] = useState<Start | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function leave(): void {
    setStart(null)
    if (globalThis.location && location.hash.startsWith('#/room/')) {
      history.replaceState(null, '', location.pathname + location.search)
      setRoute({ kind: 'home' })
    }
  }

  if (start?.kind === 'tutorial') {
    return (
      <TutorialApp
        lessons={lessons}
        debugging={debugging}
        onExit={() => setStart(null)}
        onWarmUp={() =>
          setStart({
            kind: 'computer',
            level: 'easy',
            options: { ...loadTableOptions(), cardGlow: true },
            opponent: MAPLE,
          })
        }
      />
    )
  }

  if (url !== null) {
    // a reload inside a game goes back to it; otherwise the choice says where to go
    const room =
      route.kind === 'room' ? route.id : start?.kind === 'join' ? start.pin : start?.kind === 'create' ? null : undefined
    if (room !== undefined) {
      // keyed so leaving one game and opening another starts a fresh connection
      return (
        <OnlineApp
          key={room ?? 'new'}
          url={url}
          room={room}
          options={start?.kind === 'create' ? start.options : undefined}
          connect={connect}
          onLeave={leave}
        />
      )
    }
  }

  return (
    <LocalApp
      seed={given}
      level={start?.kind === 'computer' ? start.level : null}
      chosenOptions={start?.kind === 'computer' ? start.options : null}
      opponentName={start?.kind === 'computer' ? start.opponent : undefined}
      debugging={debugging}
      online={url !== null}
      onStart={setStart}
      onNewGame={() => setStart(null)}
    />
  )
}

function LocalApp({
  seed: given,
  level,
  chosenOptions,
  debugging,
  online,
  onStart,
  onNewGame,
  opponentName,
}: {
  opponentName?: string
  seed?: number
  level: Difficulty | null
  /** What the options screen gave; editable during the game, against the machine. */
  chosenOptions: GameOptions | null
  debugging: boolean
  online: boolean
  onStart: (start: Start) => void
  onNewGame: () => void
}) {
  const [seed, setSeed] = useState(() => given ?? randomSeed())
  // the game holds its own copy: changed from the settings dialog, reset by the next options screen
  const [options, setOptions] = useState<GameOptions>(() => chosenOptions ?? loadTableOptions())
  useEffect(() => {
    if (chosenOptions) setOptions(chosenOptions)
  }, [chosenOptions])
  const table = useLocalTable({ seed, level, pace: options.opponentThinks ? 'thinking' : 'instant' })
  const art = useArt()

  /**
   * Jumps to a finished game with the outcome asked for, so the final screen
   * can be looked at without playing a hundred moves. The game it lands on is
   * one the rules really produce — see `findGame`.
   */
  function jumpTo(outcome: Outcome): void {
    const found = findGame(outcome, HUMAN_SEAT, randomSeed())
    if (!found) return
    setSeed(found.seed)
    table.load(found.state)
  }

  /** Your turn, a few tokens before the bag runs out: the Final Round banner is a draw or two away. */
  function jumpToLastTokens(): void {
    const found = findNearEnd(HUMAN_SEAT, randomSeed())
    if (!found) return
    setSeed(found.seed)
    table.load(found.state)
  }

  function restart(): void {
    // `given` pins the opening game only; every game after it draws its own
    const next = randomSeed()
    setSeed(next)
    table.reset(next)
    // a new game asks again: this is the only place the opponent is chosen
    onNewGame()
  }

  /** The same opponent, another game: a fresh seed and nothing asked. */
  function playAgain(): void {
    const next = randomSeed()
    setSeed(next)
    table.reset(next)
  }

  const debugHatch = debugging ? (
    <div className="debug">
      <button type="button" onClick={() => jumpTo('win')}>
        Win now
      </button>
      <button type="button" onClick={() => jumpTo('lose')}>
        Lose now
      </button>
      <button type="button" onClick={() => jumpTo('draw')}>
        Draw now
      </button>
      <button type="button" onClick={jumpToLastTokens}>
        Last tokens
      </button>
    </div>
  ) : null

  return (
    <>
      {table.view ? (
        <GameScreen
          table={table}
          view={table.view}
          label={level ? LEVEL_LABEL[level] : ''}
          detail={`Seed ${seed}`}
          restartLabel="New game"
          onRestart={restart}
          playAgain={{ act: playAgain }}
          extras={debugHatch}
          paused={level === null}
          options={options}
          onOptionsChange={setOptions}
          opponentName={opponentName}
          // someone in particular in the seat is Maple, after the tutorial
          opponentAvatar={opponentName === MAPLE ? art.mapleAvatar : undefined}
        />
      ) : null}
      {level === null ? <ModeSetup online={online} onStart={onStart} /> : null}
    </>
  )
}

const MAPLE = 'Professor Maple'

/**
 * Professor Maple's lesson: the real game screen on the tutorial's table, with
 * her coach over it. Nothing in it is a real game until the warm-up, which
 * leaves for an ordinary one against the machine on Easy, with her name on
 * the plate.
 */
function TutorialApp({
  lessons = LESSONS,
  onExit,
  onWarmUp,
  debugging = false,
}: {
  lessons?: readonly Lesson[]
  onExit: () => void
  onWarmUp: () => void
  /** `#debug`: a panel at the side to jump between chapters. */
  debugging?: boolean
}) {
  const tutorial = useTutorialTable(onExit, lessons)
  const art = useArt()
  // the lesson shows what it teaches: the cards rise, the bag can be opened, the professor does not dawdle
  const [options, setOptions] = useState<GameOptions>(() => ({
    ...loadTableOptions(),
    cardGlow: true,
    bagComposition: true,
    opponentThinks: false,
  }))
  const { view } = tutorial.table
  // in the class the seat at the top is an ordinary opponent's; Maple takes it when he flies there
  const seated = tutorial.act !== 1
  return (
    <>
      {view ? (
        <GameScreen
          key={tutorial.lessonKey}
          table={tutorial.table}
          view={view}
          label={seated ? 'Your teacher' : ''}
          detail=""
          restartLabel="Leave the tutorial"
          onRestart={onExit}
          options={options}
          onOptionsChange={setOptions}
          opponentName={seated ? MAPLE : undefined}
          opponentAvatar={seated ? art.mapleAvatar : undefined}
          // the chapter's card first, then "Your Turn": the banner waits while the card is up
          paused={tutorial.card !== null}
          coaching={{
            onUi: tutorial.ui,
            // no banner in the class, nor on a screen rebuilt by Back: it comes back as the page left it
            opening: tutorial.act !== 1 && tutorial.fresh,
            // after a Back, what that page had open opens again
            reopen: tutorial.reopen,
          }}
        />
      ) : null}
      <Coach
        act={tutorial.act}
        step={tutorial.step}
        busy={tutorial.busy}
        onNext={tutorial.next}
        onSkip={onExit}
        onPlay={onWarmUp}
        onMenu={onExit}
        page={tutorial.page}
        canBack={tutorial.canBack}
        onBack={tutorial.back}
        card={tutorial.card}
        onDismissCard={tutorial.dismissCard}
        departing={tutorial.departing}
        onLanded={tutorial.land}
      />
      {debugging ? (
        <TutorialDebug lessons={lessons} lessonIndex={tutorial.lessonIndex} page={tutorial.page} onJump={tutorial.jump} />
      ) : null}
    </>
  )
}

/**
 * A game on the server. The PIN comes either from what was typed in Join or
 * from the server, once it has opened a room for us. Either way it is written
 * into the fragment, so a reload lands back in the same game.
 */
function OnlineApp({
  url,
  room,
  options,
  connect,
  onLeave,
}: {
  url: string
  room: string | null
  /** A new room's options; a joined room brings its own. */
  options?: TableOptions
  connect?: Connect
  onLeave: () => void
}) {
  const table = useRemoteTable({ url, room, connect, options })
  const { roomId, status } = table

  useEffect(() => {
    if (roomId && globalThis.location && parseRoute(location.hash).kind !== 'room') {
      // replace, not push: Back should leave the game, not step into the lobby
      history.replaceState(null, '', roomHash(roomId))
    }
  }, [roomId])

  if (status.kind === 'closed') return <Closed reason={status.reason} started={table.view !== null} onLeave={onLeave} />

  if (table.view === null) {
    return <RoomLobby pin={status.kind === 'waiting' ? roomId : null} onLeave={onLeave} />
  }

  return (
    // keyed by the game number: a rematch starts the screen over, queues and all
    <GameScreen
      key={table.game}
      table={table}
      view={table.view}
      label="Friend"
      detail={roomId ? `PIN ${roomId}` : ''}
      restartLabel="New game"
      onRestart={() => {
        // the other seat hears it at once: no rematch here, and they are alone
        table.rematch.leave()
        onLeave()
      }}
      playAgain={{
        act: table.rematch.request,
        waiting: table.rematch.youWant && !table.rematch.opponentWants,
        opponentWants: table.rematch.opponentWants,
        opponentLeft: table.rematch.opponentLeft,
      }}
      extras={<Connection status={status} opponentConnected={table.opponentConnected} />}
      options={table.options}
    />
  )
}
