import type { Difficulty } from '@dcv/ai'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useArt } from '../art/ArtContext.js'
import '@fontsource/cinzel/latin-900.css'
import { loadTableOptions, saveTableOptions, tableOptionsOf } from '../game/settings.js'
import type { GameOptions, TableOptions } from '../game/settings.js'
import { MenuScene } from './MenuScene.js'
import { ANIMATIONS_OFF } from '../motion.js'
import { OptionsForm } from './OptionsForm.js'
import { Picture, frontArt } from './Picture.js'
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

type Step = 'front' | 'mode' | 'computer' | 'friend' | 'join' | 'options'

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
function PlayButton({ onClick }: { onClick: () => void }) {
  // the glint's mask is the plate in WebP, which every browser here can read
  const shine = `url(${PLATE.webp})`
  return (
    <button type="button" className="menu-play" aria-label="Play" onClick={onClick}>
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
  const frontButtons = useRef<HTMLElement>(null)
  // React 18 does not know `inert`: set on the element, it keeps taps and focus out while a window is open
  useEffect(() => {
    if (frontButtons.current) frontButtons.current.inert = step !== 'front'
  }, [step])
  const [pin, setPin] = useState('')
  // the table's options, offered after the difficulty or after Create
  const [options, setOptions] = useState<GameOptions>(loadTableOptions)
  const [level, setLevel] = useState<Difficulty | null>(null)

  function begin(): void {
    saveTableOptions(options)
    onStart(level ? { kind: 'computer', level, options } : { kind: 'create', options: tableOptionsOf(options) })
  }

  const back = (to: Step) => (
    <button type="button" aria-label="Back" onClick={() => setStep(to)}>
      ←
    </button>
  )

  function submitPin(event: FormEvent): void {
    event.preventDefault()
    if (pin.length === PIN_LENGTH) onStart({ kind: 'join', pin })
  }

  return (
    <MenuScene waiting={!loaded}>
      <FallingLogo />
      {/* always there, so they do not leave and come back: under Play's windows, seen through the dark but not to be pressed */}
      <nav ref={frontButtons} className="menu-actions" aria-label="Main menu">
        {/* first in line: someone opening the game for the first time should meet the lesson */}
        <button type="button" className="menu-round" aria-label="Tutorial" onClick={() => onStart({ kind: 'tutorial' })}>
          <Picture art={TUTORIAL} />
        </button>
        <PlayButton onClick={() => setStep('mode')} />
        <button type="button" className="menu-round" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <Picture art={SETTINGS} />
        </button>
      </nav>
      {step === 'front' ? null : (
        <div className="modal-backdrop menu-scene-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Choose your opponent">
            {step === 'mode' ? (
              <>
                <div className="modal-head">
                  <h2>Who are you playing?</h2>
                  {back('front')}
                </div>
                <button type="button" className="level-choice" onClick={() => setStep('computer')}>
                  <span className="action-name">Against the computer</span>
                  <span className="action-effect">Pick a difficulty and play on this device</span>
                </button>
                <button
                  type="button"
                  className="level-choice"
                  disabled={!online}
                  onClick={() => setStep('friend')}
                >
                  <span className="action-name">Against a player</span>
                  <span className="action-effect">
                    {online ? 'Play a friend on another device with a PIN' : 'Not available in this build'}
                  </span>
                </button>
              </>
            ) : null}

            {step === 'computer' ? (
              <>
                <div className="modal-head">
                  <h2>Choose a difficulty</h2>
                  {back('mode')}
                </div>
                <p className="modal-note">Fixed for the whole game.</p>
                {LEVELS.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    className="level-choice"
                    onClick={() => {
                      setLevel(entry.value)
                      setStep('options')
                    }}
                  >
                    <span className="action-name">{entry.label}</span>
                    <span className="action-effect">{entry.blurb}</span>
                  </button>
                ))}
              </>
            ) : null}

            {step === 'friend' ? (
              <>
                <div className="modal-head">
                  <h2>Against a player</h2>
                  {back('mode')}
                </div>
                <button
                  type="button"
                  className="level-choice"
                  onClick={() => {
                    setLevel(null)
                    setStep('options')
                  }}
                >
                  <span className="action-name">Create</span>
                  <span className="action-effect">Get a PIN to give your friend</span>
                </button>
                <button type="button" className="level-choice" onClick={() => setStep('join')}>
                  <span className="action-name">Join</span>
                  <span className="action-effect">Enter the PIN your friend gave you</span>
                </button>
              </>
            ) : null}

            {step === 'options' ? (
              <>
                <div className="modal-head">
                  <h2>{level ? 'How the table looks' : 'Your table'}</h2>
                  {back(level ? 'computer' : 'friend')}
                </div>
                <p className="modal-note">
                  {level
                    ? 'You can change these during the game too.'
                    : 'Your friend plays with the same ones, and nobody can change them once the game starts.'}
                </p>
                {/* online there is no machine: its option is left out */}
                {level ? (
                  <OptionsForm options={options} onChange={setOptions} />
                ) : (
                  <OptionsForm options={tableOptionsOf(options)} onChange={(next) => setOptions({ ...options, ...next })} />
                )}
                <button type="button" className="primary" onClick={begin}>
                  {level ? 'Start game' : 'Create game'}
                </button>
              </>
            ) : null}

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
      )}
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
