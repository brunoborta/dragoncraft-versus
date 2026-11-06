import { key } from '@dcv/engine'
import type { Action, Hex, PlayerView } from '@dcv/engine'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { boardTargets, resolveTap } from '../game/selection.js'
import type { Table } from '../game/table.js'
import { Board } from './Board.js'
import { Controls } from './Controls.js'
import { DiscardDialog, keepCount } from './DiscardDialog.js'
import { GameOver } from './GameOver.js'
import { Hand } from './Hand.js'
import type { Highlight } from './HexCell.js'
import { LogDialog } from './LogDialog.js'
import { OpponentThinking, Prompt } from './Prompt.js'
import { StackDetail } from './StackDetail.js'
import { TopBar } from './TopBar.js'

/**
 * A game in progress, drawn from a `Table` and nothing else. Whether the
 * other seat is the machine in this browser or a person on another phone
 * is decided above here; this screen only sees a view and the moves it may
 * make.
 */
export function GameScreen({
  table,
  view,
  label,
  detail,
  restartLabel,
  onRestart,
  extras,
}: {
  table: Table
  /** The table's view, already known not to be null. */
  view: PlayerView
  label: string
  detail: string
  restartLabel: string
  onRestart: () => void
  /** Anything the host wants under the board: the debug hatch, a connection notice. */
  extras?: ReactNode
}) {
  const [selected, setSelected] = useState<Hex | null>(null)
  const [inspecting, setInspecting] = useState<Hex | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [keeping, setKeeping] = useState<string[]>([])

  const ended = view.phase === 'ended'
  const { actions } = table
  const myTurn = actions.length > 0

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
    table.perform(action)
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
    const returned = view.you.hand.filter((card) => !keeping.includes(card.id)).map((card) => card.id)
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
    const stack = view.board[key(hex)] ?? []
    // one token hides nothing: the panel is for seeing what is buried
    setInspecting(stack.length > 1 ? hex : null)
  }

  function undo(): void {
    setSelected(null)
    setInspecting(null)
    // one action at a time, and never across a draw or into the other turn
    table.undo()
  }

  function restart(): void {
    setSelected(null)
    setInspecting(null)
    setKeeping([])
    setLogOpen(false)
    onRestart()
  }

  function decision() {
    if (ended) {
      return (
        <GameOver
          view={view}
          opponentLabel={table.opponentLabel}
          restartLabel={restartLabel}
          onRestart={restart}
        />
      )
    }
    if (!myTurn) return <OpponentThinking />
    return <Prompt view={view} actions={barActions} selected={selected} onAct={handleAct} />
  }

  return (
    <main className="app">
      <TopBar view={view} onOpenLog={() => setLogOpen(true)} />
      <Board
        board={view.board}
        highlights={highlights}
        preview={preview}
        onSelectHex={myTurn ? selectHex : () => {}}
      />
      <footer className="bottom">
        {inspecting ? (
          <StackDetail
            hex={inspecting}
            stack={view.board[key(inspecting)] ?? []}
            onClose={() => setInspecting(null)}
          />
        ) : null}
        {extras}
        <Controls label={label} detail={detail} canUndo={table.canUndo} onUndo={undo} />
        <Hand view={view} actions={actions} onAct={handleAct} />
        {decision()}
      </footer>
      {discarding ? (
        <DiscardDialog hand={view.you.hand} keeping={keeping} onToggle={toggleKeep} onFinish={finishDiscard} />
      ) : null}
      {logOpen ? <LogDialog view={view} onClose={() => setLogOpen(false)} /> : null}
    </main>
  )
}
