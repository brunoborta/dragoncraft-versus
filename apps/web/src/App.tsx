import { key } from '@dcv/engine'
import type { Hex } from '@dcv/engine'
import { useState } from 'react'
import { Board } from './components/Board.js'
import { Hand } from './components/Hand.js'
import type { Highlight } from './components/HexCell.js'
import { Prompt } from './components/Prompt.js'
import { TopBar } from './components/TopBar.js'
import { useGame } from './game/useGame.js'

const OPENING_SEED = 1

export function App() {
  const game = useGame(OPENING_SEED)
  const [selected, setSelected] = useState<Hex | null>(null)

  const placements = game.actions.filter((action) => action.type === 'place')

  const highlights: Record<string, Highlight> = {}
  for (const placement of placements) highlights[key(placement.at)] = 'legal'
  if (selected) highlights[key(selected)] = 'selected'

  /** First tap previews, second tap on the same space commits. */
  function selectHex(hex: Hex): void {
    const placement = placements.find((action) => key(action.at) === key(hex))
    if (!placement) return
    if (selected && key(selected) === key(hex)) {
      setSelected(null)
      game.perform(placement)
      return
    }
    setSelected(hex)
  }

  return (
    <main className="app">
      <TopBar view={game.view} />
      <Board board={game.state.board} highlights={highlights} onSelectHex={selectHex} />
      <footer className="bottom">
        <Hand
          view={game.view}
          actions={game.actions}
          onAct={(action) => {
            setSelected(null)
            game.perform(action)
          }}
        />
        <Prompt
          view={game.view}
          actions={game.actions}
          onAct={(action) => {
            setSelected(null)
            game.perform(action)
          }}
        />
      </footer>
    </main>
  )
}
