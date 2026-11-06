import type { Difficulty } from '@dcv/ai'
import { useEffect, useState } from 'react'
import { Closed, Connection } from './components/Connection.js'
import { GameScreen } from './components/GameScreen.js'
import { LEVEL_LABEL, OpponentSetup } from './components/OpponentSetup.js'
import type { OpponentChoice } from './components/OpponentSetup.js'
import { RoomLobby } from './components/RoomLobby.js'
import { findGame, isDebugEnabled, type Outcome } from './game/debug.js'
import { parseRoute, roomHash, roomLink } from './game/route.js'
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
  const [choice, setChoice] = useState<OpponentChoice | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function leave(): void {
    setChoice(null)
    if (globalThis.location && location.hash.startsWith('#/room/')) {
      history.replaceState(null, '', location.pathname + location.search)
      setRoute({ kind: 'home' })
    }
  }

  const online = url !== null && (choice === 'online' || route.kind === 'room')
  if (online) {
    return (
      <OnlineApp
        url={url}
        room={route.kind === 'room' ? route.id : null}
        connect={connect}
        onLeave={leave}
      />
    )
  }

  return (
    <LocalApp
      seed={given}
      level={choice === 'online' ? null : choice}
      debugging={debugging}
      online={url !== null}
      onChoose={setChoice}
      onNewGame={() => setChoice(null)}
    />
  )
}

function LocalApp({
  seed: given,
  level,
  debugging,
  online,
  onChoose,
  onNewGame,
}: {
  seed?: number
  level: Difficulty | null
  debugging: boolean
  online: boolean
  onChoose: (choice: OpponentChoice) => void
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
      {level === null ? <OpponentSetup online={online} onChoose={onChoose} /> : null}
    </>
  )
}

/**
 * A game on the server. The room id comes either from the link that was
 * opened or from the server, once it has opened a room for us; in the
 * second case the fragment is updated so a reload lands back in the room.
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
      history.replaceState(null, '', roomHash(roomId))
    }
  }, [roomId])

  if (status.kind === 'closed') return <Closed reason={status.reason} onLeave={onLeave} />

  if (table.view === null) {
    if (status.kind === 'waiting') {
      const link = roomId && globalThis.location ? roomLink(roomId, location) : null
      return <RoomLobby link={link} onLeave={onLeave} />
    }
    return <RoomLobby link={null} onLeave={onLeave} />
  }

  return (
    <GameScreen
      table={table}
      view={table.view}
      label="Opponent: a friend"
      detail={roomId ? `Room ${roomId}` : ''}
      restartLabel="Back to menu"
      onRestart={onLeave}
      extras={<Connection status={status} opponentConnected={table.opponentConnected} />}
    />
  )
}
