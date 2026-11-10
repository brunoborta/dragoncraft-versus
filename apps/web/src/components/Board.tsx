import { BOARD, MAX_STACK, hexEq, key } from '@dcv/engine'
import type { Board as BoardState, Hex, Token } from '@dcv/engine'
import { useArt } from '../art/ArtContext.js'
import { BOARD_OUTLINE, BOARD_VIEWBOX, HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import type { PresentationEvent } from '../game/presentation.js'
import { HexCell, STONE_SCALE, TOKEN_RADIUS, type Highlight } from './HexCell.js'
import { BoardMoment, arrivals } from './Moments.js'
import { DEF } from './SvgDefs.js'
import { THICKNESS, TokenGlyph } from './TokenGlyph.js'

/**
 * Paint order, weakest first. A ring drawn earlier loses its shared edges to
 * whatever is drawn after it, so the selection has to come last or a neighbour
 * that merely offers a move covers two of its sides.
 */
const RING_ORDER: readonly Highlight[] = ['legal', 'selected']

/** Size of one tile of the stone texture, in board units (a space is 20 wide). */
const STONE_TILE = 32

/** How high the preview hovers over an empty space, as a share of its radius. */
const HOVER = 0.55

/**
 * The held token on the space it would land on, before the second tap. Solid,
 * not translucent: it hovers above the space with a blue ring and its shadow on
 * the ground. Over a stack it hovers higher, nothing underneath moves, and a
 * seal says which level of the stack it would take.
 */
function Preview({ hex, token, height }: { hex: Hex; token: Token; height: number }) {
  const center = hexCenter(hex)
  const lift = TOKEN_RADIUS * (HOVER + height * THICKNESS * 2)
  const level = Math.min(height + 1, MAX_STACK)
  return (
    <g className="token-preview" data-hex={key(hex)} transform={`translate(${center.x} ${center.y})`}>
      <TokenGlyph token={token} radius={TOKEN_RADIUS} lift={lift} />
      <circle className="token-preview-ring" cy={-lift} r={TOKEN_RADIUS * 1.12} filter={`url(#${DEF.glow})`} />
      {height > 0 ? (
        <g className="token-preview-level" transform={`translate(${-TOKEN_RADIUS * 1.15} ${-lift - TOKEN_RADIUS * 0.7})`}>
          <rect x={-HEX_SIZE * 0.42} y={-HEX_SIZE * 0.2} width={HEX_SIZE * 0.84} height={HEX_SIZE * 0.4} rx={HEX_SIZE * 0.2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={HEX_SIZE * 0.26}>
            {`${level} of ${level}`}
          </text>
        </g>
      ) : null}
    </g>
  )
}

export function Board({
  board,
  ids = {},
  event = null,
  glows = {},
  highlights,
  preview,
  onSelectHex,
}: {
  board: BoardState
  /** Token identities per space, bottom to top, from the presentation queue. */
  ids?: Record<string, string[]>
  /** The event the presentation is playing: moves, flames and vines are drawn for it. */
  event?: PresentationEvent | null
  /**
   * Tokens with a glow of their own: `gold` for the one just placed while the
   * fire-up decision is open, `ember` for the one whose ability is resolving.
   */
  glows?: Record<string, 'gold' | 'ember'>
  highlights: Record<string, Highlight>
  /** What the spec calls the preview: the held token, shown on the space it would land on. */
  preview?: { hex: Hex; token: Token }
  onSelectHex: (hex: Hex) => void
}) {
  const art = useArt()
  const stoneId = 'dcv-stone-tex'
  const arriving = arrivals(event)
  return (
    <svg
      className="board"
      viewBox={BOARD_VIEWBOX}
      role="group"
      aria-label="Game board"
      style={{ '--stone-fill': `url(#${stoneId})` } as React.CSSProperties}
    >
      <defs>
        {/* the painted stone, one tile spanning about a space and a half */}
        <pattern id={stoneId} patternUnits="userSpaceOnUse" width={STONE_TILE} height={STONE_TILE}>
          <image href={art.stone} width={STONE_TILE} height={STONE_TILE} preserveAspectRatio="none" />
        </pattern>
      </defs>
      {/*
        The frame: the board's thickness, the gold rim, then the dark joint the
        stone tiles sit in. One outline for the whole board, so the gold runs
        round it in a single sweep.
      */}
      <g className="board-frame" aria-hidden="true">
        <path className="board-side" d={BOARD_OUTLINE} transform="translate(0 2.2)" />
        <path className="board-rim" d={BOARD_OUTLINE} stroke={`url(#${DEF.frame})`} />
        <path className="board-joint" d={BOARD_OUTLINE} />
      </g>
      {BOARD.map((hex) => (
        <HexCell
          key={key(hex)}
          hex={hex}
          stack={board[key(hex)] ?? []}
          topId={ids[key(hex)]?.at(-1)}
          arrival={arriving[key(hex)]}
          highlight={highlights[key(hex)]}
          onSelect={onSelectHex}
        />
      ))}
      {/*
        Drawn after every cell, so nothing can paint over it. Rings and badges
        rendered inside their own cell lose whatever a later neighbour covers,
        and the hovering preview rises into the space above its own.
        `pointer-events: none` keeps the cells underneath clickable.
      */}
      <g className="board-overlay" aria-hidden="true">
        {RING_ORDER.flatMap((kind) =>
          BOARD.filter((hex) => highlights[key(hex)] === kind).map((hex) => (
            <g key={`ring-${key(hex)}`}>
              {/* a dark edge under the glow, which on pale stone would melt away */}
              <polygon className="hex-ring-edge" data-highlight={kind} points={hexPoints(hex, STONE_SCALE)} />
              {/*
                Only the selection is blurred into a glow. The legal rings pulse
                for as long as a decision is open, and a blur filter under an
                animation is re-rendered every frame — on up to 19 rings, that is
                the one continuous cost a cheap phone would feel (F11).
              */}
              <polygon
                className="hex-ring"
                data-highlight={kind}
                points={hexPoints(hex, STONE_SCALE)}
                filter={kind === 'selected' ? `url(#${DEF.glow})` : undefined}
              />
            </g>
          )),
        )}
        {/* the glows under the moments: a lit ring around the token in question */}
        {Object.entries(glows).map(([space, kind]) => {
          const [q, r] = space.split(',').map(Number)
          const center = hexCenter({ q, r })
          return (
            <circle
              key={`glow-${space}`}
              className="token-glow"
              data-glow={kind}
              cx={center.x}
              cy={center.y}
              r={TOKEN_RADIUS * 1.18}
              filter={`url(#${DEF.glow})`}
            />
          )
        })}
        <BoardMoment event={event} />
        {BOARD.map((hex) => {
          const stack = board[key(hex)] ?? []
          // one token buries nothing, so there is no count worth showing
          if (stack.length < 2) return null
          const center = hexCenter(hex)
          return (
            <g
              // keyed on the count too: a new count is a new badge, and bumps (M4)
              key={`badge-${key(hex)}-${stack.length}`}
              transform={`translate(${center.x + HEX_SIZE * 0.5} ${center.y - HEX_SIZE * 0.5})`}
            >
              {/* the bump animates this inner group: a CSS transform would override the attribute above */}
              <g className="stack-badge">
                <circle r={HEX_SIZE * 0.28} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={HEX_SIZE * 0.34}>
                  {stack.length}
                </text>
              </g>
            </g>
          )
        })}
        {preview ? (
          <Preview hex={preview.hex} token={preview.token} height={(board[key(preview.hex)] ?? []).length} />
        ) : null}
      </g>
    </svg>
  )
}
