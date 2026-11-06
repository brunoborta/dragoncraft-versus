import type { Difficulty } from '@dcv/ai'
import { useState } from 'react'
import { GameScreen } from './components/GameScreen.js'
import { LEVEL_LABEL, OpponentSetup } from './components/OpponentSetup.js'
import type { OpponentChoice } from './components/OpponentSetup.js'
import { findGame, isDebugEnabled, type Outcome } from './game/debug.js'
import { HUMAN_SEAT } from './game/seats.js'
import { randomSeed } from './game/seed.js'
import { serverUrl } from './game/serverUrl.js'
import { useLocalTable } from './game/useLocalTable.js'

/**
 * `seed` is for tests and for replaying a game someone reported. Left out — as
 * it is in the real app — every game draws its own. `debug` likewise defaults
 * to what the URL fragment says.
 */
export function App({ seed: given, debug }: { seed?: number; debug?: boolean } = {}) {
  const debugging = debug ?? isDebugEnabled(globalThis.location?.hash ?? '')
  // null until chosen: the game does not start, and the machine does not move,
  // before the player has picked who they are playing against
  const [choice, setChoice] = useState<OpponentChoice | null>(null)

  if (choice === 'online') {
    // the remote table arrives with the next task; until then the choice is not offered
    throw new Error('online play is not wired yet')
  }

  return (
    <LocalApp
      seed={given}
      level={choice}
      debugging={debugging}
      onChoose={setChoice}
      onNewGame={() => setChoice(null)}
    />
  )
}

function LocalApp({
  seed: given,
  level,
  debugging,
  onChoose,
  onNewGame,
}: {
  seed?: number
  level: Difficulty | null
  debugging: boolean
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
      {level === null ? <OpponentSetup online={serverUrl() !== null} onChoose={onChoose} /> : null}
    </>
  )
}
