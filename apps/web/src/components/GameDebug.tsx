import { DRAGON_TYPES } from '@dcv/engine'
import type { DragonType } from '@dcv/engine'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Outcome } from '../game/debug.js'
import type { FuseLight } from '../game/useDebugFuse.js'
import { DRAGON_THEME } from '../theme.js'
import { TokenGlyph } from './TokenGlyph.js'

/**
 * The game's debug panel, with `#debug` in the address (against the machine):
 * floats at the side like the tutorial's, and folds away to a tab. Tricks to
 * reach what is slow to reach by playing: a token of your choice in hand, the
 * turn's fuse (online only, otherwise), the machine held still, a coin, a
 * card to score, the final round, the ending.
 */
export function GameDebug({
  where,
  canHold,
  onHeld,
  onFuse,
  fuseLit,
  onFuseOut,
  machineHeld,
  onMachineHeld,
  onCoin,
  canScorable,
  onScorable,
  canFinalRound,
  onFinalRound,
  onOutcome,
  onLastTokens,
}: {
  /** A line on where the game is: whose turn, what it waits on. */
  where: string
  /** A token is in hand, so it may be swapped. */
  canHold: boolean
  onHeld: (type: DragonType) => void
  onFuse: (how: FuseLight) => void
  fuseLit: boolean
  onFuseOut: () => void
  machineHeld: boolean
  onMachineHeld: (held: boolean) => void
  onCoin: () => void
  /** A card can be handed over that the board fits now: none in hand does, and the board has one. */
  canScorable: boolean
  onScorable: () => void
  /** The end is not set off yet, and the bag holds more than its last token. */
  canFinalRound: boolean
  onFinalRound: () => void
  onOutcome: (outcome: Outcome) => void
  onLastTokens: () => void
}) {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <button type="button" className="tutorial-debug-tab" onClick={() => setOpen(true)}>
        Debug
      </button>
    )
  }

  return (
    <aside className="tutorial-debug game-debug" aria-label="Game debug">
      <div className="tutorial-debug-head">
        <strong>Debug</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fold the debug panel">
          ×
        </button>
      </div>
      <p className="tutorial-debug-where">{where}</p>

      <Section title="You">
        <div className="game-debug-tokens">
          {DRAGON_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              disabled={!canHold}
              title={DRAGON_THEME[type].label}
              aria-label={`Hold ${DRAGON_THEME[type].label}`}
              onClick={() => onHeld(type)}
            >
              <svg viewBox="-12 -13 24 24" aria-hidden="true">
                <TokenGlyph token={{ kind: 'single', type }} radius={10} shadow={false} />
              </svg>
            </button>
          ))}
        </div>
        <button type="button" onClick={onCoin}>
          +1 coin
        </button>
        <button type="button" disabled={!canScorable} onClick={onScorable}>
          A card to score
        </button>
      </Section>

      <Section title="Turn fuse">
        <button type="button" onClick={() => onFuse('last')}>
          Last 30s
        </button>
        <button type="button" onClick={() => onFuse('end')}>
          Last 5s (burst)
        </button>
        <button type="button" onClick={() => onFuse('away')}>
          Away (a touch puts it out)
        </button>
        <button type="button" onClick={() => onFuse('awayAgain')}>
          Away again (15s)
        </button>
        <button type="button" disabled={!fuseLit} onClick={onFuseOut}>
          No clock
        </button>
      </Section>

      <Section title="Machine">
        <button type="button" data-current={machineHeld || undefined} onClick={() => onMachineHeld(!machineHeld)}>
          {machineHeld ? 'Held: let it play' : 'Hold it still'}
        </button>
      </Section>

      <Section title="Ending">
        <button type="button" disabled={!canFinalRound} onClick={onFinalRound}>
          Final round on the next draw
        </button>
        <span className="game-debug-row">
          <button type="button" onClick={() => onOutcome('win')}>
            Win now
          </button>
          <button type="button" onClick={() => onOutcome('lose')}>
            Lose now
          </button>
          <button type="button" onClick={() => onOutcome('draw')}>
            Draw now
          </button>
        </span>
        <button type="button" onClick={onLastTokens}>
          Last tokens
        </button>
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="game-debug-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
