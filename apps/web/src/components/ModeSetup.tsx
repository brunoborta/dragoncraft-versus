import type { Difficulty } from '@dcv/ai'
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useArt } from '../art/ArtContext.js'
import '@fontsource/cinzel/latin-900.css'
import { loadTableOptions, saveTableOptions, tableOptionsOf } from '../game/settings.js'
import type { GameOptions, TableOptions } from '../game/settings.js'
import { COMETS_LEAVE_MS, CardSparks, FireRing } from './FireFx.js'
import { MenuScene } from './MenuScene.js'
import { ANIMATIONS_OFF, useReducedMotion } from '../motion.js'
import { Picture, frontArt } from './Picture.js'
import type { Art } from './Picture.js'
import { SettingsDialog } from './SettingsDialog.js'

export type Start =
  /** `opponent`: who sits at the top, when it is someone — Professor Maple, for the warm-up after the tutorial. */
  | { kind: 'computer'; level: Difficulty; options: GameOptions; opponent?: string }
  | { kind: 'create'; options: TableOptions }
  | { kind: 'join'; pin: string }
  | { kind: 'tutorial' }

export const LEVELS: { value: Difficulty; label: string; blurb: string }[] = [
  { value: 'easy', label: 'Easy', blurb: 'Plays for the same things as Medium, then fumbles about half of them' },
  { value: 'medium', label: 'Medium', blurb: 'Looks a move ahead and plays to bank reputation' },
  { value: 'hard', label: 'Hard', blurb: 'Plans the whole turn, keeps its coins, and watches what the board gives you' },
]

export const LEVEL_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export const PIN_LENGTH = 6

type Step = 'front' | 'mode' | 'computer' | 'friend' | 'join'

/**
 * The game's name, dropped onto the painting the way a token is dropped onto
 * the board: it falls in large, squashes as it hits, and raises the board's
 * gold dust. Once, as the front door opens.
 */
function FallingLogo() {
  const art = useArt()
  return (
    <div className="menu-logo" role="img" aria-label="Dragoncraft Versus">
      <img className="menu-logo-dust" src={art.puff} alt="" draggable={false} />
      <Picture art={LOGO} className="menu-logo-art" />
    </div>
  )
}

const LOGO = frontArt('logo')
const PLATE = frontArt('menu-play-plate')
const CLAWS = Object.fromEntries((['tl', 'tr', 'bl', 'br'] as const).map((corner) => [corner, frontArt(`menu-play-claw-${corner}`)]))
const TUTORIAL = frontArt('menu-tutorial')
const SETTINGS = frontArt('menu-settings')

/** The longest the entrance waits for its pictures: on a slow line it then goes on without them. */
export const ENTRANCE_WAIT_MS = 2000

/**
 * Whether the front door's pictures and Cinzel are in, so its entrance (the
 * logo's drop, its dust, the claws) is not played over nothing on a slow line.
 * It waits on the images on screen, each in the format its browser took.
 * Gives up waiting after ENTRANCE_WAIT_MS. Under test there is nothing to wait for.
 */
function useLoaded(): boolean {
  const [loaded, setLoaded] = useState(ANIMATIONS_OFF)
  useEffect(() => {
    if (ANIMATIONS_OFF) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setLoaded(true)
    }
    const timer = window.setTimeout(finish, ENTRANCE_WAIT_MS)
    // a picture that fails is not waited for either
    const decoded = [...document.querySelectorAll<HTMLImageElement>('.menu-scene img')].map((image) => image.decode().catch(() => {}))
    const font = document.fonts?.load("900 1em 'Cinzel'").catch(() => {})
    void Promise.all([...decoded, font]).then(finish)
    return () => {
      done = true
      window.clearTimeout(timer)
    }
  }, [])
  return loaded
}

/**
 * Play, the painted button: a gold plate held by four claws, its name written
 * on it in Cinzel, in the middle of the plate. It drops in after the logo, the
 * claws close on it one by one as it lands, and now and then a glint of light
 * runs across the gold.
 */
function PlayButton({ lit, onClick }: { lit: boolean; onClick: () => void }) {
  // the glint's mask is the plate in WebP, which every browser here can read
  const shine = `url(${PLATE.webp})`
  return (
    <button type="button" className="menu-play" aria-label="Play" data-lit={lit || undefined} onClick={onClick}>
      {/* pressed, it catches: fire runs round it before the painting darkens */}
      {lit ? <FireRing /> : null}
      <span className="play-art" aria-hidden="true">
        {Object.entries(CLAWS).map(([corner, art]) => (
          <span key={corner} className="play-claw" data-claw={corner}>
            <Picture art={art} />
          </span>
        ))}
        <span className="play-plate">
          <Picture art={PLATE} />
          <span className="play-label">Play</span>
        </span>
        <span className="play-shine" style={{ maskImage: shine, WebkitMaskImage: shine }} />
      </span>
    </button>
  )
}

/** How long Play's fire winds round it before the painting darkens (as the comets leave), and how long the cards take to leave before the next ones come. */
const IGNITE_MS = COMETS_LEAVE_MS
const CARDS_OUT_MS = 300
/** Back to the front door: the floor sinks away as it rose (its rise played backwards), so this takes longer. */
const CLOSE_MS = 450

/** The windows that are cards dealt over the darkened painting; the rest are forms in a window. */
type CardStep = 'mode' | 'computer' | 'friend'
const isCardStep = (step: Step): step is CardStep => step === 'mode' || step === 'computer' || step === 'friend'

/** The cards' pictures (scripts/art.mjs, `choice`). */
const CARD = {
  frame: frontArt('choice-frame'),
  player: { frame: frontArt('choice-frame-player'), arena: frontArt('choice-arena-player'), dragon: frontArt('choice-dragon-player') },
  computer: { frame: frontArt('choice-frame-computer'), arena: frontArt('choice-arena-computer'), dragon: frontArt('choice-dragon-computer') },
}
/** The machine's dragons, one per difficulty, little to large: on the plain frame, in the machine's arena. */
const ROBOT: Record<Difficulty, { frame: Art; arena: Art; dragon: Art }> = Object.fromEntries(
  LEVELS.map((entry) => [entry.value, { frame: CARD.frame, arena: CARD.computer.arena, dragon: frontArt(`choice-robot-${entry.value}`) }]),
) as Record<Difficulty, { frame: Art; arena: Art; dragon: Art }>
/** Create and Join, painted whole. */
const WHOLE = { create: frontArt('choice-card-create'), join: frontArt('choice-card-join') }
const BANNER = frontArt('choice-banner')
const FLOOR = frontArt('choice-floor')

/**
 * One card. `art` names it (its placeholder colour, until it has a painting);
 * `painted`, when it has one, is its frame with its mark, the arena in its
 * window and the dragon standing in it.
 */
interface Choice {
  key: string
  name: string
  effect: string
  art: string
  painted?: { frame: Art; arena: Art; dragon: Art }
  /** A card painted whole: frame, scene and its mark in one picture. */
  whole?: Art
  disabled?: boolean
  pick: () => void
}

/**
 * The title, written along the banner's band: the band arches, highest in the
 * middle, so the words do too. The curve is the band's middle line, measured
 * on the 1080 x 274 picture, lowered by half a capital so the letters sit
 * across it.
 */
function BannerTitle({ title }: { title: string }) {
  const arc = useId()
  return (
    <svg className="choice-banner-text" viewBox="0 0 1080 274">
      <path id={arc} d="M140 132 Q540 68 940 132" fill="none" />
      <text>
        <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">
          {title}
        </textPath>
      </text>
    </svg>
  )
}

/**
 * A card: its arena in the window, its dragon in front of that (its horns may
 * rise past the frame's top), the frame over both, and its name and what it
 * does written on the frame's plate.
 */
function ChoiceCard({
  card,
  index,
  leaving,
  active,
  onClick,
  button,
}: {
  card: Choice
  index: number
  leaving: boolean
  active: boolean
  onClick: () => void
  button: (element: HTMLButtonElement | null) => void
}) {
  const painted = card.painted
  return (
    <button
      ref={button}
      type="button"
      className="choice-card"
      data-art={card.art}
      // a mark on the plate (the swords, the monitor) puts the name under it
      data-marked={card.whole || (painted && painted.frame !== CARD.frame) ? true : undefined}
      aria-current={active || undefined}
      // only the card in front is in the tab order: the arrows bring the others to it
      tabIndex={active ? 0 : -1}
      style={{ '--i': index } as CSSProperties}
      disabled={card.disabled || leaving}
      onClick={onClick}
    >
      {card.whole ? (
        <Picture art={card.whole} className="choice-layer" />
      ) : (
        <>
          {painted ? <Picture art={painted.arena} className="choice-layer" /> : <span className="choice-blank" aria-hidden="true" />}
          {painted ? (
            <span className="choice-window" aria-hidden="true">
              <Picture art={painted.dragon} className="choice-dragon" />
            </span>
          ) : null}
          <Picture art={painted?.frame ?? CARD.frame} className="choice-layer" />
        </>
      )}
      <span className="choice-text">
        <span className="choice-name">{card.name}</span>
        {card.effect ? <span className="choice-effect">{card.effect}</span> : null}
      </span>
    </button>
  )
}

const ARROW = { left: frontArt('choice-arrow-left'), right: frontArt('choice-arrow-right') }
/** How far a finger has to slide across the cards to turn them. */
const SWIPE_PX = 40

/**
 * The cards as a carousel: one in front, lit, and its neighbours behind it to
 * either side, smaller and in shadow. The arrows, a swipe
 * or the arrow keys bring another to the front (at either end, that arrow is out); a tap on one behind does too,
 * and a tap on the one in front picks it.
 */
function Carousel({ cards, start, leaving }: { cards: Choice[]; start?: number; leaving: boolean }) {
  const [at, setAt] = useState(() => start ?? Math.max(0, cards.findIndex((card) => !card.disabled)))
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const swipe = useRef<{ x: number; turned: boolean } | null>(null)
  const turn = (to: number, focus = false) => {
    const next = Math.max(0, Math.min(cards.length - 1, to))
    setAt(next)
    // turned from the keyboard, the focus goes with the card to the front
    if (focus) requestAnimationFrame(() => buttons.current[next]?.focus())
  }
  return (
    <div
      className="choice-carousel"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        turn(at + (event.key === 'ArrowLeft' ? -1 : 1), true)
      }}
    >
      <div
        className="choice-row"
        onPointerDown={(event) => {
          swipe.current = { x: event.clientX, turned: false }
        }}
        onPointerMove={(event) => {
          const slide = swipe.current
          if (!slide || slide.turned || Math.abs(event.clientX - slide.x) < SWIPE_PX) return
          slide.turned = true
          turn(at + (event.clientX < slide.x ? 1 : -1))
        }}
        // a swipe that ends on a card does not also tap it
        onClickCapture={(event) => {
          if (swipe.current?.turned) {
            event.stopPropagation()
            event.preventDefault()
          }
          swipe.current = null
        }}
      >
        <button type="button" className="choice-arrow" data-side="left" aria-label="Previous" disabled={at === 0 || leaving} onClick={() => turn(at - 1)}>
          <Picture art={ARROW.left} />
        </button>
        <div className="choice-track">
          {cards.map((card, index) => {
            const offset = index - at
            return (
              <span
                key={card.key}
                className="choice-slot"
                data-active={offset === 0 || undefined}
                data-far={Math.abs(offset) > 1 || undefined}
                style={{ '--o': offset, '--d': Math.abs(offset) } as CSSProperties}
              >
                <ChoiceCard
                  card={card}
                  index={index}
                  leaving={leaving}
                  active={offset === 0}
                  onClick={offset === 0 ? card.pick : () => turn(index)}
                  button={(element) => {
                    buttons.current[index] = element
                  }}
                />
              </span>
            )
          })}
        </div>
        <button
          type="button"
          className="choice-arrow"
          data-side="right"
          aria-label="Next"
          disabled={at === cards.length - 1 || leaving}
          onClick={() => turn(at + 1)}
        >
          <Picture art={ARROW.right} />
        </button>
      </div>
    </div>
  )
}

/**
 * The front door, over the living painting: the logo, and under it the
 * tutorial, Play and the settings. Play asks the rest one question per window:
 * who you are playing, then the detail of that — how hard the machine is, or
 * whether you are opening a game or joining one by PIN. Every window has a way
 * back.
 *
 * The opponent is fixed once chosen: changing it mid-game would let a losing
 * position be walked back by lowering the difficulty.
 */
export function ModeSetup({ online, onStart }: { online: boolean; onStart: (start: Start) => void }) {
  const [step, setStep] = useState<Step>('front')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const loaded = useLoaded()
  const still = useReducedMotion()
  // Play burning, and the cards on their way out
  const [lit, setLit] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // leaving for the front door: the whole window goes, not just its cards
  const [closing, setClosing] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const frontButtons = useRef<HTMLElement>(null)
  // React 18 does not know `inert`: set on the element, it keeps taps and focus out while a window is open
  useEffect(() => {
    if (frontButtons.current) frontButtons.current.inert = step !== 'front'
  }, [step])
  const [pin, setPin] = useState('')
  // the table's options, as set under the cog: every game is played with them, none asked before it
  const [options, setOptions] = useState<GameOptions>(loadTableOptions)

  /** To another window: the cards leave first, then the next ones are dealt. */
  function go(to: Step): void {
    if (to === 'front') setLit(false)
    if (still) {
      setStep(to)
      return
    }
    window.clearTimeout(timer.current)
    setLeaving(true)
    setClosing(to === 'front')
    timer.current = window.setTimeout(
      () => {
        setLeaving(false)
        setClosing(false)
        setStep(to)
      },
      to === 'front' ? CLOSE_MS : CARDS_OUT_MS,
    )
  }

  /** Play catches fire, and only then does the painting darken for the cards. */
  function play(): void {
    if (lit) return
    if (still) {
      setStep('mode')
      return
    }
    setLit(true)
    timer.current = window.setTimeout(() => setStep('mode'), IGNITE_MS)
  }

  const back = (to: Step) => (
    <button type="button" aria-label="Back" onClick={() => go(to)}>
      ←
    </button>
  )

  // `start`: the card in front when the window opens (else the first that can be chosen)
  const choices: Record<CardStep, { title: string; note?: string; back: Step; start?: number; cards: Choice[] }> = {
    mode: {
      title: 'Choose game mode',
      back: 'front',
      cards: [
        {
          key: 'computer',
          name: 'Vs. Computer',
          // its picture says it: only a card that cannot be chosen says why
          effect: '',
          art: 'computer',
          painted: CARD.computer,
          pick: () => go('computer'),
        },
        {
          key: 'player',
          name: 'Vs. Player',
          effect: online ? '' : 'Not available in this build',
          art: 'player',
          painted: CARD.player,
          disabled: !online,
          pick: () => go('friend'),
        },
      ],
    },
    computer: {
      title: 'Choose a difficulty',
      note: 'Fixed for the whole game.',
      back: 'mode',
      cards: LEVELS.map((entry) => ({
        key: entry.value,
        name: entry.label,
        effect: entry.blurb,
        art: entry.value,
        painted: ROBOT[entry.value],
        pick: () => onStart({ kind: 'computer', level: entry.value, options }),
      })),
    },
    friend: {
      title: 'Vs. Player',
      back: 'mode',
      cards: [
        {
          key: 'create',
          name: 'Create',
          effect: 'Get a PIN to give your friend',
          art: 'create',
          whole: WHOLE.create,
          // the friend plays by the same options, the ones under the cog
          pick: () => onStart({ kind: 'create', options: tableOptionsOf(options) }),
        },
        { key: 'join', name: 'Join', effect: 'Enter the PIN your friend gave you', art: 'join', whole: WHOLE.join, pick: () => go('join') },
      ],
    },
  }

  function submitPin(event: FormEvent): void {
    event.preventDefault()
    if (pin.length === PIN_LENGTH) onStart({ kind: 'join', pin })
  }

  // closing, the painting brightens and the logo goes back down as the floor sinks
  return (
    <MenuScene waiting={!loaded} away={step !== 'front' && !closing}>
      <FallingLogo />
      {/* always there: Play's windows draw them away, and Back brings them in again */}
      <nav ref={frontButtons} className="menu-actions" aria-label="Main menu">
        {/* first in line: someone opening the game for the first time should meet the lesson */}
        <button type="button" className="menu-round" aria-label="Tutorial" onClick={() => onStart({ kind: 'tutorial' })}>
          <Picture art={TUTORIAL} />
        </button>
        <PlayButton lit={lit} onClick={play} />
        <button type="button" className="menu-round" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <Picture art={SETTINGS} />
        </button>
      </nav>
      {isCardStep(step) ? (
        <section className="menu-choice" role="dialog" aria-modal="true" aria-label="Choose your opponent" data-leaving={leaving || undefined} data-closing={closing || undefined}>
          {/* the stone floor the cards are dealt onto, its barrels and crates at the ends */}
          <Picture art={FLOOR} className="choice-floor" />
          <button type="button" className="choice-back" aria-label="Back" onClick={() => go(choices[step].back)}>
            ←
          </button>
          {/* keyed by the window, so each one's banner and cards are dealt afresh */}
          <div key={step} className="choice-stage">
            <h2 className="choice-banner">
              <Picture art={BANNER} className="choice-banner-art" />
              <BannerTitle title={choices[step].title} />
            </h2>
            {choices[step].note ? <p className="choice-note">{choices[step].note}</p> : null}
            <Carousel cards={choices[step].cards} start={choices[step].start} leaving={leaving} />
          </div>
          {/* the sparks the cards throw as they are dealt: a fresh hand, fresh sparks */}
          {still ? null : <CardSparks key={`sparks-${step}`} deal={step} />}
        </section>
      ) : null}
      {step === 'join' ? (
        <div className="modal-backdrop menu-scene-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Choose your opponent">
            {step === 'join' ? (
              <form className="pin-form" onSubmit={submitPin}>
                <div className="modal-head">
                  <h2>Join a game</h2>
                  {back('friend')}
                </div>
                <label className="modal-note" htmlFor="pin">
                  Game PIN
                </label>
                <input
                  id="pin"
                  className="pin-input"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="000000"
                  maxLength={PIN_LENGTH}
                  size={PIN_LENGTH}
                  value={pin}
                  // digits only, whatever the keyboard or a paste brings
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                />
                <button type="submit" className="primary" disabled={pin.length !== PIN_LENGTH}>
                  Join
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
      {/* the cards' pictures, fetched once the front door is in, to be there when Play is pressed */}
      {loaded && step === 'front' ? (
        <div hidden>
          {[BANNER, FLOOR, CARD.frame, ARROW.left, ARROW.right, ...Object.values(CARD.player), ...Object.values(CARD.computer), ...Object.values(ROBOT).map((robot) => robot.dragon), WHOLE.create, WHOLE.join].map((art) => (
            <Picture key={art.webp} art={art} />
          ))}
        </div>
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          options={options}
          onChange={(next) => {
            setOptions(next)
            saveTableOptions(next)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </MenuScene>
  )
}
