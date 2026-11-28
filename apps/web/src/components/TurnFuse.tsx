import { FUSE_MS } from '@dcv/protocol'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { BOARD_LOOP } from '../geometry.js'
import type { TableClock } from '../game/table.js'
import { useReducedMotion } from '../motion.js'
import { drawSparks } from './FireFx.js'
import type { Ember } from './FireFx.js'

type Point = { x: number; y: number }

/** The rope lies just outside the board's gold frame, all the way round. */
const OUTSIDE = 1.09

/** The fuse's course, in board units: the board's outline pushed out, from the middle of its right side down round and back. */
const COURSE: Point[] = [...BOARD_LOOP, BOARD_LOOP[0]].map((point) => ({ x: point.x * OUTSIDE, y: point.y * OUTSIDE }))
const ALONG = COURSE.reduce<number[]>((sums, point, i) => {
  sums.push(i === 0 ? 0 : sums[i - 1] + Math.hypot(point.x - COURSE[i - 1].x, point.y - COURSE[i - 1].y))
  return sums
}, [])
const LENGTH = ALONG[ALONG.length - 1]
const PATH = `M${COURSE.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' L')}`

/** Where on the course a fraction of it falls. */
function pointAt(fraction: number): Point {
  const target = Math.min(1, Math.max(0, fraction)) * LENGTH
  let i = 1
  while (i < ALONG.length - 1 && ALONG[i] < target) i++
  const t = (target - ALONG[i - 1]) / (ALONG[i] - ALONG[i - 1] || 1)
  return { x: COURSE[i - 1].x + (COURSE[i].x - COURSE[i - 1].x) * t, y: COURSE[i - 1].y + (COURSE[i].y - COURSE[i - 1].y) * t }
}

/**
 * How far the fuse has burnt, 0 to 1, with `remaining` ms left of a turn
 * `total` long: it is lit for the last FUSE_MS, or the whole turn when that is
 * shorter (someone away again has a fuse of 15s, and it still goes all round).
 */
export function fuseBurnt(remaining: number, total: number = FUSE_MS): number {
  return Math.min(1, Math.max(0, 1 - remaining / Math.min(FUSE_MS, total)))
}

/** How board units land in the area: px per unit, and where the board's origin is. */
type Mapping = { unit: number; x: number; y: number; width: number; height: number }

/**
 * The turn's fuse (online): for the last FUSE_MS of a turn a lit fuse runs
 * round the board from the middle of its right side, downwards (so its last
 * half crosses the top left to right), sputtering sparks and
 * leaving ash, and when it is back where it began it bursts, and the turn is
 * played out. A player who was away begins their turn with it already lit;
 * touching the screen puts it out (the clock grows, and it is gone).
 *
 * HTML over the board (`area`): the rope is an SVG laid over the board in its
 * own units, the sparks a canvas; both are driven frame by frame from the
 * clock, without React.
 */
export function TurnFuse({ clock, area }: { clock: TableClock; area: RefObject<HTMLElement> }) {
  const still = useReducedMotion()
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const rope = useRef<SVGGElement>(null)
  const unburnt = useRef<SVGPathElement>(null)
  const edge = useRef<SVGPathElement>(null)
  const ash = useRef<SVGPathElement>(null)
  const sparks = useRef<HTMLCanvasElement>(null)
  // the frame reads the latest clock without starting over
  const latest = useRef(clock)
  latest.current = clock

  useLayoutEffect(() => {
    const box = area.current
    const measure = () => {
      const board = box?.querySelector<SVGSVGElement>('svg.board')
      const ctm = board?.getScreenCTM?.()
      if (!box || !ctm || ctm.a <= 0) {
        setMapping(null)
        return
      }
      const rect = box.getBoundingClientRect()
      const next = { unit: ctm.a, x: ctm.e - rect.left, y: ctm.f - rect.top, width: box.clientWidth, height: box.clientHeight }
      // only a real change starts the drawing over: a resize that moved nothing would wipe the sparks
      setMapping((current) =>
        current && (Object.keys(next) as (keyof Mapping)[]).every((name) => Math.abs(current[name] - next[name]) < 0.5) ? current : next,
      )
    }
    measure()
    const watch = box && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (box) watch?.observe(box)
    window.addEventListener('resize', measure)
    return () => {
      watch?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [area])

  useEffect(() => {
    if (!mapping) return
    const canvas = sparks.current
    const ctx = canvas?.getContext('2d') ?? null
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas) {
      canvas.width = Math.round(mapping.width * ratio)
      canvas.height = Math.round(mapping.height * ratio)
    }
    // board units to the canvas's pixels
    const toCanvas = (point: Point) => ({ x: (mapping.x + point.x * mapping.unit) * ratio, y: (mapping.y + point.y * mapping.unit) * ratio })
    const scale = mapping.unit * ratio
    let embers: Ember[] = []
    let burst = false
    // when it burst, for its flash
    let burstAt = -Infinity
    let last = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const burnt = fuseBurnt(latest.current.deadline - now, latest.current.totalMs)
      const lit = burnt > 0
      rope.current?.setAttribute('opacity', lit ? '1' : '0')
      for (const cord of [edge.current, unburnt.current]) {
        cord?.setAttribute('stroke-dasharray', `${(1 - burnt).toFixed(4)} 2`)
        cord?.setAttribute('stroke-dashoffset', `${(-burnt).toFixed(4)}`)
      }
      ash.current?.setAttribute('stroke-dasharray', `${burnt.toFixed(4)} 2`)
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (lit && burnt < 1 && !still) {
          const head = toCanvas(pointAt(burnt))
          // the burning end: a hot glow, and sparks sputtering off it
          const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, scale * 4.5)
          glow.addColorStop(0, 'rgba(255,250,220,0.95)')
          glow.addColorStop(0.25, 'rgba(255,190,80,0.6)')
          glow.addColorStop(1, 'rgba(255,90,20,0)')
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(head.x, head.y, scale * 4.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
          for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = (5 + Math.random() * 14) * scale
            embers.push({
              x: head.x,
              y: head.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 3 * scale,
              life: 0.2 + Math.random() * 0.35,
              age: 0,
              size: scale * (0.2 + Math.random() * 0.25),
            })
          }
        }
        // back where it began: it bursts
        if (burnt >= 1 && !burst && !still) {
          burst = true
          burstAt = now
          const origin = toCanvas(COURSE[0])
          for (let i = 0; i < 90; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = (8 + Math.random() * 26) * scale
            embers.push({
              x: origin.x,
              y: origin.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 6 * scale,
              life: 0.4 + Math.random() * 0.6,
              age: 0,
              size: scale * (0.2 + Math.random() * 0.35),
            })
          }
        }
        if (burnt < 1) burst = false
        // the burst's flash: a ball of light swelling and fading
        const flash = (now - burstAt) / 450
        if (flash >= 0 && flash < 1) {
          const origin = toCanvas(COURSE[0])
          const radius = scale * (4 + 14 * Math.sqrt(flash))
          const light = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, radius)
          light.addColorStop(0, `rgba(255,250,225,${0.95 * (1 - flash)})`)
          light.addColorStop(0.35, `rgba(255,170,60,${0.7 * (1 - flash)})`)
          light.addColorStop(1, 'rgba(255,80,20,0)')
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = light
          ctx.beginPath()
          ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
        }
        embers = drawSparks(ctx, embers, dt, 18 * scale)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [mapping, still])

  if (!mapping) return null
  const transform = `matrix(${mapping.unit} 0 0 ${mapping.unit} ${mapping.x} ${mapping.y})`
  return (
    <div className="turn-fuse" aria-hidden="true">
      <svg className="turn-fuse-rope" width={mapping.width} height={mapping.height}>
        <defs>
          {/* the cord's twist: slanting strands, in board units */}
          <pattern id="turn-fuse-twist" patternUnits="userSpaceOnUse" width={1.4} height={1.4} patternTransform="rotate(40)">
            <rect width={1.4} height={1.4} fill="#b08049" />
            <rect width={0.6} height={1.4} fill="#6e4a26" />
          </pattern>
        </defs>
        <g ref={rope} transform={transform} opacity={0}>
          {/* what has burnt: a trail of ash */}
          <path ref={ash} className="turn-fuse-ash" d={PATH} pathLength={1} />
          {/* what is left: a twisted cord, from the burning end round to where it began */}
          <path ref={edge} className="turn-fuse-edge" d={PATH} pathLength={1} />
          <path ref={unburnt} className="turn-fuse-cord" d={PATH} pathLength={1} />
        </g>
      </svg>
      <canvas ref={sparks} className="turn-fuse-sparks" />
    </div>
  )
}
