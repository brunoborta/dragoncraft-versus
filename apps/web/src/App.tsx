import { key, wouldComplete } from '@dcv/engine'
import type { Action, Hex } from '@dcv/engine'
import { useState } from 'react'
import { Board } from './components/Board.js'
import { Hand } from './components/Hand.js'
import type { Highlight } from './components/HexCell.js'
import { Prompt } from './components/Prompt.js'
import { StackDetail } from './components/StackDetail.js'
import { TopBar } from './components/TopBar.js'
import { useGame } from './game/useGame.js'
import { boardTargets, resolveTap } from './game/selection.js'

const OPENING_SEED = 1

export function App() {
  const game = useGame(OPENING_SEED)
  const [selected, setSelected] = useState<Hex | null>(null)
  const [inspecting, setInspecting] = useState<Hex | null>(null)

  const targets = boardTargets(game.actions, selected)
  const pending = game.view.pending[game.view.pending.length - 1]

  const highlights: Record<string, Highlight> = {}
  for (const hex of targets) {
    const completes =
      pending?.kind === 'place' &&
      game.view.you.hand.some((card) => wouldComplete(game.view.board, card, hex, pending.token))
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
    const outcome = resolveTap(game.actions, selected, hex)

    if (outcome.action) {
      handleAct(outcome.action)
      return
    }

    setSelected(outcome.select)
    // any tapped space that holds tokens shows what is stacked there
    const stack = game.state.board[key(hex)] ?? []
    setInspecting(stack.length > 0 ? hex : null)
  }

  return (
    <main className="app">
      <TopBar view={game.view} />
      <Board board={game.state.board} highlights={highlights} onSelectHex={selectHex} />
      <footer className="bottom">
        <Hand view={game.view} actions={game.actions} onAct={handleAct} />
        {inspecting ? <StackDetail hex={inspecting} stack={game.state.board[key(inspecting)] ?? []} /> : null}
        <Prompt view={game.view} actions={game.actions} selected={selected} onAct={handleAct} />
      </footer>
    </main>
  )
}
