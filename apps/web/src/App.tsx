import { key, toPlayerView, wouldComplete } from '@dcv/engine'
import type { Action, Hex } from '@dcv/engine'
import type { Difficulty } from '@dcv/ai'
import { useState } from 'react'
import { Board } from './components/Board.js'
import { Controls } from './components/Controls.js'
import { GameOver } from './components/GameOver.js'
import { Hand } from './components/Hand.js'
import type { Highlight } from './components/HexCell.js'
import { Prompt } from './components/Prompt.js'
import { StackDetail } from './components/StackDetail.js'
import { TopBar } from './components/TopBar.js'
import { HUMAN_SEAT, MACHINE_SEAT } from './game/seats.js'
import { useGame } from './game/useGame.js'
import { useOpponent } from './game/useOpponent.js'
import { boardTargets, resolveTap } from './game/selection.js'

// seat 0 (the human) must go first here, since the board and decision bar
// now gate on whose turn it is — seed 1 handed the opening move to seat 1
const OPENING_SEED = 2

export function App() {
  const [seed, setSeed] = useState(OPENING_SEED)
  const [level, setLevel] = useState<Difficulty>('easy')
  const game = useGame(seed)
  const [selected, setSelected] = useState<Hex | null>(null)
  const [inspecting, setInspecting] = useState<Hex | null>(null)

  useOpponent({ session: game, seat: MACHINE_SEAT, level, enabled: true })

  const myTurn = game.state.current === HUMAN_SEAT && game.state.phase !== 'ended'
  // always the human's own view, so the machine's turn never flips the hand shown
  const view = toPlayerView(game.state, HUMAN_SEAT)
  const actions = myTurn ? game.actions : []

  const targets = boardTargets(actions, selected)
  const pending = view.pending[view.pending.length - 1]

  const highlights: Record<string, Highlight> = {}
  for (const hex of targets) {
    const completes =
      pending?.kind === 'place' &&
      view.you.hand.some((card) => wouldComplete(view.board, card, hex, pending.token))
    highlights[key(hex)] = completes ? 'completes' : 'legal'
  }
  if (selected) highlights[key(selected)] = 'selected'

  // every commit, wherever it comes from, closes the preview and the stack inspector
  function handleAct(action: Action): void {
    setSelected(null)
    setInspecting(null)
    game.perform(action)
  }

  function selectHex(hex: Hex): void {
    const outcome = resolveTap(actions, selected, hex)

    if (outcome.action) {
      handleAct(outcome.action)
      return
    }

    setSelected(outcome.select)
    // any tapped space that holds tokens shows what is stacked there
    const stack = game.state.board[key(hex)] ?? []
    setInspecting(stack.length > 0 ? hex : null)
  }

  function undo(): void {
    setSelected(null)
    setInspecting(null)
    // rewind past whatever the machine did, back to your own turn
    game.undoUntil((state) => state.current === HUMAN_SEAT)
  }

  function restart(): void {
    const next = seed + 1
    setSeed(next)
    game.reset(next)
  }

  return (
    <main className="app">
      <TopBar view={view} />
      <Board board={game.state.board} highlights={highlights} onSelectHex={myTurn ? selectHex : () => {}} />
      <footer className="bottom">
        <Controls level={level} onLevel={setLevel} canUndo={game.canUndo && myTurn} onUndo={undo} />
        <Hand view={view} actions={actions} onAct={handleAct} />
        {inspecting ? <StackDetail hex={inspecting} stack={game.state.board[key(inspecting)] ?? []} /> : null}
        {game.state.phase === 'ended' ? (
          <GameOver state={game.state} onRestart={restart} />
        ) : (
          <Prompt view={view} actions={actions} selected={selected} onAct={handleAct} />
        )}
      </footer>
    </main>
  )
}
