import { bankedReputation, forfeitedBy, winnerOfView } from '@dcv/engine'
import type { PlayerView } from '@dcv/engine'
import type { Scorable } from '@dcv/engine'
import { motion } from 'motion/react'
import { useArt } from '../art/ArtContext.js'
import type { GameResult as Result } from '../art/ArtContext.js'
import { useCountUp } from '../game/useCountUp.js'
import { useReducedMotion } from '../motion.js'
import { Avatar } from './Avatar.js'
import { CoinIcon } from './icons.js'

const HEADLINE: Record<Result, string> = { win: 'You win', lose: 'You lose', draw: 'Shared victory' }

const STAR = 'M0 -26 l6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L0 7.2l-13 6.8 2.5-14.5L-21 -10.7l14.5-2.1z'

/**
 * The emblem in the laurels, its own for each result so it reads before the
 * headline: a gold star for a win, the star split gold and silver for a draw,
 * a dull cracked star for a loss.
 */
function Emblem({ result }: { result: Result }) {
  if (result === 'draw') {
    return (
      <g className="crest-emblem">
        <clipPath id="crest-left">
          <rect x="-30" y="-30" width="30" height="50" />
        </clipPath>
        <path className="crest-star" d={STAR} />
        <path className="crest-star crest-star-silver" d={STAR} clipPath="url(#crest-left)" />
        <line className="crest-split" x1="0" y1="-26" x2="0" y2="7.2" />
      </g>
    )
  }
  return (
    <g className="crest-emblem">
      <path className="crest-star" d={STAR} />
      {result === 'lose' ? <path className="crest-crack" d="M1 -20 L-3 -10 L3 -4 L-2 6" /> : null}
    </g>
  )
}

/**
 * A laurel crest: green for a win or a draw, wine for a loss. Painted art for
 * the result replaces it when it exists.
 */
function Crest({ result }: { result: Result }) {
  const art = useArt().crest[result]
  if (art) return <img className="crest crest-art" data-result={result} src={art} alt="" aria-hidden="true" draggable={false} />
  const leaf = 'M0 0 C 6 -5.5 14 -5.5 17 0 C 14 5.5 6 5.5 0 0 Z'
  const leaves = Array.from({ length: 6 }, (_, i) => i)
  return (
    <svg className="crest" data-result={result} viewBox="-50 -42 100 70" aria-hidden="true">
      {[-1, 1].map((side) => (
        <g key={side} transform={`scale(${side} 1)`}>
          {leaves.map((i) => {
            const angle = 200 - i * 22
            const rad = (angle * Math.PI) / 180
            return (
              <path
                key={i}
                className="crest-leaf"
                d={leaf}
                transform={`translate(${Math.cos(rad) * 32} ${Math.sin(rad) * 30 + 4}) rotate(${angle - 90 - 30})`}
              />
            )
          })}
        </g>
      ))}
      <Emblem result={result} />
    </svg>
  )
}

/** When the coins join the sum: after the card points have finished counting. */
const COINS_JOIN_MS = 1900

/**
 * A final total in two counts (M14): up from zero to what the cards banked,
 * a beat, then the coins join one by one — the one moment they turn into
 * points, shown as the turning.
 */
function FinalTotal({ player, delay }: { player: Scorable; delay: number }) {
  const cards = useCountUp(bankedReputation(player), { from: 0, delay, duration: 900 })
  const coins = useCountUp(player.coins, { from: 0, delay: COINS_JOIN_MS, duration: 600 })
  return <dd>{cards + coins}</dd>
}

/** Where the total came from: the cards, and the coins kept to the end. */
function Breakdown({ player }: { player: Scorable }) {
  return (
    <p className="final-breakdown">
      <span>{bankedReputation(player)} cards</span>
      <span className="final-coins">
        <CoinIcon className="final-coin" /> +{player.coins}
      </span>
    </p>
  )
}

/**
 * The end of the game (plan M14): the crest drops in, the result appears,
 * both totals count up from zero, then the buttons. A tap does not skip it:
 * it is short, and it is the one moment the game is about. It opens over the board, and
 * "View board" puts it away to look at the final position — the decision panel
 * then offers it back.
 */
export function GameOver({
  view,
  opponentLabel,
  restartLabel,
  onRestart,
  playAgain,
  onViewBoard,
}: {
  view: PlayerView
  opponentLabel: string
  restartLabel: string
  onRestart: () => void
  /** Another game at this table; `waiting` and `opponentWants` say where the asking stands. */
  playAgain?: { act: () => void; waiting: boolean; opponentWants: boolean; opponentGone: boolean }
  onViewBoard?: () => void
}) {
  const winner = winnerOfView(view)
  const result: Result = winner === 'draw' ? 'draw' : winner === view.seat ? 'win' : 'lose'
  // a game given up keeps the same crest and headline; a line under it says why
  const quitter = forfeitedBy(view.log)
  const reason = quitter === null ? null : quitter === view.seat ? 'You gave up' : `${opponentLabel} gave up`

  const reduced = useReducedMotion()
  // each step after the one before: crest, headline, totals, buttons
  const step = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.35 } }

  return (
    <div className="game-over" role="dialog" aria-label="Final score" data-result={result}>
      <motion.div
        className="crest-wrap"
        initial={reduced ? { opacity: 0 } : { y: -80, scale: 0.5, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 260, damping: 14 }}
      >
        {result !== 'lose' && !reduced ? <span className="crest-rays" /> : null}
        <Crest result={result} />
      </motion.div>
      <motion.h2 {...step(0.35)}>{HEADLINE[result]}</motion.h2>
      {reason ? (
        <motion.p className="game-over-reason" {...step(0.45)}>
          {reason}
        </motion.p>
      ) : null}
      <motion.dl className="final-scores" {...step(0.55)}>
        <div className="final-score" data-side="you">
          <Avatar side="you" active={result !== 'lose'} />
          <dt>You</dt>
          <FinalTotal player={view.you} delay={700} />
        </div>
        <div className="final-score" data-side="opponent">
          <Avatar side="opponent" active={result !== 'win'} />
          <dt>{opponentLabel}</dt>
          <FinalTotal player={view.opponent} delay={700} />
        </div>
      </motion.dl>
      {/* the breakdown appears as the coins join the count, naming what just happened */}
      <motion.div className="final-breakdowns" {...step(COINS_JOIN_MS / 1000)}>
        <Breakdown player={view.you} />
        <Breakdown player={view.opponent} />
      </motion.div>
      <motion.div className="game-over-actions" {...step(2.6)}>
        {playAgain?.opponentWants ? <p className="rematch-note">{opponentLabel} wants to play again</p> : null}
        {playAgain?.waiting ? (
          <p className="rematch-note">
            {playAgain.opponentGone ? `${opponentLabel} left the game` : `Waiting for ${opponentLabel}…`}
          </p>
        ) : null}
        {playAgain ? (
          <button type="button" onClick={playAgain.act} disabled={playAgain.waiting}>
            Play again
          </button>
        ) : null}
        <button type="button" className={playAgain ? 'btn-secondary' : undefined} onClick={onRestart}>
          {restartLabel}
        </button>
        {onViewBoard ? (
          <button type="button" className="btn-secondary" onClick={onViewBoard}>
            View board
          </button>
        ) : null}
      </motion.div>
    </div>
  )
}
