import type { Difficulty } from '@dcv/ai'
import { useEffect, useState } from 'react'
import { Closed, Connection } from './components/Connection.js'
import { GameScreen } from './components/GameScreen.js'
import { LEVEL_LABEL, ModeSetup } from './components/ModeSetup.js'
import type { Start } from './components/ModeSetup.js'
import { RoomLobby } from './components/RoomLobby.js'
import { findGame, isDebugEnabled, type Outcome } from './game/debug.js'
import { parseRoute, roomHash } from './game/route.js'
import { HUMAN_SEAT } from './game/seats.js'
import { randomSeed } from './game/seed.js'
import { serverUrl } from './game/serverUrl.js'
import { useLocalTable } from './game/useLocalTable.js'
import { useRemoteTable } from './game/useRemoteTable.js'
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
}: { seed?: number; debug?: boolean; server?: string | null; connect?: Connect } = {}) {
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

  if (url !== null) {
    // a reload inside a game goes back to it; otherwise the choice says where to go
    const room =
      route.kind === 'room' ? route.id : start?.kind === 'join' ? start.pin : start?.kind === 'create' ? null : undefined
    if (room !== undefined) {
      // keyed so leaving one game and opening another starts a fresh connection
      return <OnlineApp key={room ?? 'new'} url={url} room={room} connect={connect} onLeave={leave} />
    }
  }

  return (
    <LocalApp
      seed={given}
      level={start?.kind === 'computer' ? start.level : null}
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
  debugging,
  online,
  onStart,
  onNewGame,
}: {
  seed?: number
  level: Difficulty | null
  debugging: boolean
  online: boolean
  onStart: (start: Start) => void
  onNewGame: () => void
}) {
  const [seed, setSeed] = useState(() => given ?? randomSeed())
  const table = useLocalTable({ seed, level })

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

  function restart(): void {
    // `given` pins the opening game only; every game after it draws its own
    const next = randomSeed()
    setSeed(next)
    table.reset(next)
    // a new game asks again: this is the only place the opponent is chosen
    onNewGame()
  }

  const debugHatch = debugging ? (
    <div className="debug">
      <button type="button" onClick={() => jumpTo('win')}>
        Win now
      </button>
      <button type="button" onClick={() => jumpTo('lose')}>
        Lose now
      </button>
    </div>
  ) : null

  return (
    <>
      {table.view ? (
        <GameScreen
          table={table}
          view={table.view}
          label={level ? `Opponent: ${LEVEL_LABEL[level]}` : ''}
          detail={`Seed ${seed}`}
          restartLabel="New game"
          onRestart={restart}
          extras={debugHatch}
        />
      ) : null}
      {level === null ? <ModeSetup online={online} onStart={onStart} /> : null}
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
  connect,
  onLeave,
}: {
  url: string
  room: string | null
  connect?: Connect
  onLeave: () => void
}) {
  const table = useRemoteTable({ url, room, connect })
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
    <GameScreen
      table={table}
      view={table.view}
      label="Opponent: a player"
      detail={roomId ? `PIN ${roomId}` : ''}
      restartLabel="Back to menu"
      onRestart={onLeave}
      extras={<Connection status={status} opponentConnected={table.opponentConnected} />}
    />
  )
}
