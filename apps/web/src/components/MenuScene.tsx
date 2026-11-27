import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import table from '../art/menu-motion.json'
import { useReducedMotion } from '../motion.js'
import { Picture, frontArt } from './Picture.js'

const SCENE = frontArt('bg-menu')

/** The painting's size in its own pixels: the pieces are placed on it. */
const PAINTING = { width: 1024, height: 1535 }

const CLIPS = import.meta.glob<string>('../assets/motion/*.mp4', { eager: true, query: '?url', import: 'default' })
const MASKS = import.meta.glob<string>('../assets/motion/*-mask.png', { eager: true, query: '?url', import: 'default' })
const asset = (files: Record<string, string>, name: string) => files[`../assets/motion/${name}`]

export interface Piece {
  name: string
  rect: number[]
  loop?: boolean
  every?: number
  jitter?: number
  first?: number
}

/** Seconds from one play of a piece to the next: about `every`, give or take `jitter`. */
export function nextPlayIn(piece: Piece, random = Math.random): number {
  const every = piece.every ?? 10
  const jitter = piece.jitter ?? 0
  return Math.max(0.5, every + (random() * 2 - 1) * jitter)
}

/**
 * One moving corner of the painting: a short clip of just that corner, laid
 * exactly over it and softened at its edges by its mask. A loop (the falls)
 * runs without end; any other piece plays through now and then, on its own
 * clock, and is the still picture in between. Its first and last frames are
 * the painting's own, so it comes and goes unseen.
 */
function MovingPiece({ piece }: { piece: Piece }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [x, y, w, h] = piece.rect
  const mask = `url(${asset(MASKS, `${piece.name}-mask.png`)})`

  useEffect(() => {
    const clip = video.current
    if (!clip) return
    if (piece.loop) {
      clip.play().then(
        () => setPlaying(true),
        () => {},
      )
      return
    }
    let timer = 0
    const play = () => {
      clip.currentTime = 0
      clip.play().then(
        () => setPlaying(true),
        () => {},
      )
    }
    // `every` runs from one start to the next, so the clip's own length comes off the wait
    const ended = () => {
      setPlaying(false)
      timer = window.setTimeout(play, Math.max(0.5, nextPlayIn(piece) - (clip.duration || 0)) * 1000)
    }
    clip.addEventListener('ended', ended)
    timer = window.setTimeout(play, (piece.first ?? 0) * 1000)
    return () => {
      window.clearTimeout(timer)
      clip.removeEventListener('ended', ended)
      clip.pause()
    }
  }, [piece])

  const style: CSSProperties = {
    left: `${(x / PAINTING.width) * 100}%`,
    top: `${(y / PAINTING.height) * 100}%`,
    width: `${(w / PAINTING.width) * 100}%`,
    height: `${(h / PAINTING.height) * 100}%`,
    maskImage: mask,
    WebkitMaskImage: mask,
  }
  return (
    <video
      ref={video}
      className="menu-piece"
      data-piece={piece.name}
      data-playing={playing || undefined}
      src={asset(CLIPS, `${piece.name}.mp4`)}
      style={style}
      muted
      playsInline
      loop={piece.loop}
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
    />
  )
}

/**
 * The front door's painting, alive: the falls run, the dragons and the banners
 * each do their bit now and then, every one on its own clock (the table is
 * art/menu-motion.json). The painting covers the screen; what is laid over it
 * (the logo) is placed by the --scene-w and --scene-h it is drawn at. Where the
 * player asked for less motion, it is just the picture.
 */
export function MenuScene({ children, waiting = false, away = false }: { children?: ReactNode; waiting?: boolean; away?: boolean }) {
  const still = useReducedMotion()
  return (
    // `waiting`: what is laid over it holds its entrance until its pictures are in; `away`: Play's windows are open, and it darkens behind them
    <div className="menu-scene" data-waiting={waiting || undefined} data-away={away || undefined}>
      <div className="menu-scene-frame">
        <Picture art={SCENE} className="menu-scene-art" />
        {still ? null : table.pieces.map((piece) => <MovingPiece key={piece.name} piece={piece} />)}
      </div>
      {children}
    </div>
  )
}
