import { key, toPlayerView } from '@dcv/engine'
import type { Action, Hex } from '@dcv/engine'
import type { Difficulty } from '@dcv/ai'
import { useState } from 'react'
import { Board } from './components/Board.js'
import { Controls } from './components/Controls.js'
import { DifficultySetup } from './components/DifficultySetup.js'
import { DiscardDialog, keepCount } from './components/DiscardDialog.js'
import { GameOver } from './components/GameOver.js'
import { Hand } from './components/Hand.js'
import { LogDialog } from './components/LogDialog.js'
import type { Highlight } from './components/HexCell.js'
import { OpponentThinking, Prompt } from './components/Prompt.js'
import { StackDetail } from './components/StackDetail.js'
import { TopBar } from './components/TopBar.js'
import { HUMAN_SEAT, MACHINE_SEAT } from './game/seats.js'
import { useGame } from './game/useGame.js'
import { useOpponent } from './game/useOpponent.js'
import { boardTargets, resolveTap } from './game/selection.js'
import { randomSeed } from './game/seed.js'

/**
 * `seed` is for tests and for replaying a game someone reported. Left out — as
 * it is in the real app — every game draws its own.
 */
export function App({ seed: given }: { seed?: number } = {}) {
  const [seed, setSeed] = useState(() => given ?? randomSeed())
  // null until chosen: the game does not start, and the machine does not move,
  // before the player has picked who they are playing against
  const [level, setLevel] = useState<Difficulty | null>(null)
  const game = useGame(seed)
  const [selected, setSelected] = useState<Hex | null>(null)
  const [inspecting, setInspecting] = useState<Hex | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [keeping, setKeeping] = useState<string[]>([])

  // `level ?? 'easy'` is never read: the effect returns on `enabled` first
  useOpponent({
    session: game,
    seat: MACHINE_SEAT,
    level: level ?? 'easy',
    enabled: level !== null,
  })

  const ended = game.state.phase === 'ended'
  const myTurn = level !== null && game.state.current === HUMAN_SEAT && !ended
  // always the human's own view, so the machine's turn never flips the hand shown
  const view = toPlayerView(game.state, HUMAN_SEAT)
  const actions = myTurn ? game.actions : []

  const targets = boardTargets(actions, selected)
  const pending = view.pending[view.pending.length - 1]

  // a coin discard is answered in its own dialog, on the cards themselves, so
  // the bar behind it offers nothing
  const discarding = myTurn && pending?.kind === 'coinDiscard'
  const barActions = discarding ? [] : actions

  // the board marks what is legal, and nothing else: the printed game does not
  // point out where a card would complete, so neither does this one
  const highlights: Record<string, Highlight> = {}
  for (const hex of targets) highlights[key(hex)] = 'legal'
  if (selected) highlights[key(selected)] = 'selected'

  // the spec's preview: the held token, translucent, on the space it would land on
  const preview =
    selected && pending?.kind === 'place' ? { hex: selected, token: pending.token } : undefined

  // every commit, wherever it comes from, closes the preview and the stack inspector
  function handleAct(action: Action): void {
    setSelected(null)
    setInspecting(null)
    setKeeping([])
    game.perform(action)
  }

  function toggleKeep(cardId: string): void {
    const wanted = keepCount(view.you.hand)
    setKeeping((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId)
      // one too many does nothing: release one before picking another
      return current.length < wanted ? [...current, cardId] : current
    })
  }

  /** Whatever was not picked is what goes back — always exactly two cards. */
  function finishDiscard(): void {
    const returned = view.you.hand
      .filter((card) => !keeping.includes(card.id))
      .map((card) => card.id)
    const action = actions.find(
      (candidate) =>
        candidate.type === 'coinDiscard' && candidate.cardIds.every((id) => returned.includes(id)),
    )
    if (action) handleAct(action)
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
    // one token hides nothing: the panel is for seeing what is buried
    setInspecting(stack.length > 1 ? hex : null)
  }

  function undo(): void {
    setSelected(null)
    setInspecting(null)
    // one action at a time, and never across a draw or into the machine's turn
    game.undo()
  }

  function restart(): void {
    // `given` pins the opening game only; every game after it draws its own
    const next = randomSeed()
    setSeed(next)
    game.reset(next)
    setLogOpen(false)
    setKeeping([])
    // a new game asks again: this is the only place the opponent is chosen
    setLevel(null)
  }

  function decision() {
    if (ended) return <GameOver state={game.state} onRestart={restart} />
    if (!myTurn) return <OpponentThinking />
    return <Prompt view={view} actions={barActions} selected={selected} onAct={handleAct} />
  }

  return (
    <main className="app">
      <TopBar view={view} onOpenLog={() => setLogOpen(true)} />
      <Board
        board={game.state.board}
        highlights={highlights}
        preview={preview}
        onSelectHex={myTurn ? selectHex : () => {}}
      />
      <footer className="bottom">
        {inspecting ? (
          <StackDetail
            hex={inspecting}
            stack={game.state.board[key(inspecting)] ?? []}
            onClose={() => setInspecting(null)}
          />
        ) : null}
        <Controls level={level} seed={seed} canUndo={game.canUndo && myTurn} onUndo={undo} />
        <Hand view={view} actions={actions} onAct={handleAct} />
        {decision()}
      </footer>
      {discarding ? (
        <DiscardDialog
          hand={view.you.hand}
          keeping={keeping}
          onToggle={toggleKeep}
          onFinish={finishDiscard}
        />
      ) : null}
      {logOpen ? <LogDialog view={view} onClose={() => setLogOpen(false)} /> : null}
      {level === null ? <DifficultySetup onChoose={setLevel} /> : null}
    </main>
  )
}
