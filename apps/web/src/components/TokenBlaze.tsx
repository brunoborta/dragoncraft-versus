import type { DragonType, Hex } from '@dcv/engine'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type { PresentationEvent } from '../game/presentation.js'
import { hexOnScreen } from '../geometry.js'
import { useReducedMotion } from '../motion.js'
import { HEAT_COLOUR, NOISE, VERTEX, compile, drawSparks } from './FireFx.js'
import type { Ember } from './FireFx.js'
import { TOKEN_RADIUS } from './HexCell.js'
import { DRAGON_THEME } from '../theme.js'

/*
 * A token catching fire, in seconds from the start: the flames leap up round
 * it, burn tall a moment, and die as fire does, its tongues lifting off and
 * thinning away (not sinking back into it); its embers rise a little longer.
 */
const CATCH = 0.12
const BURN = 0.55
const OUT = 1.15
/** The last embers, thrown just before it is out, cool for up to a second more: kept drawn until then. */
const EMBERS_OUT = OUT + 1.05
/** How long a smouldering token takes to go out once its target is chosen. */
const SMOULDER_OUT_MS = 600
/** When the ability came through a plant, its vine reaches the token first. */
const VINE_MS = 400

/** The canvas round the token, in token radii: wide enough for the flames to sway, tall enough for them to rise. */
const SPAN = { width: 6, height: 8.5, below: 2.5 }

/*
 * Fire rising off a token: every pixel looks for the token some way below it,
 * by a rising noise, so tongues of every length leap up from its rim and keep
 * moving. Hottest round its edge, gentler over its face, so its glyph still
 * shows through; and as it catches, a ring of heat runs out from it.
 */
const FRAGMENT = `
precision mediump float;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform float uLife;
uniform float uFlash;
uniform float uFade;
uniform vec3 uTint;

${NOISE}
${HEAT_COLOUR}

void main() {
  vec2 px = gl_FragCoord.xy;
  float r = uRadius;
  vec2 p = px / (r * 2.2);

  // finer across than up: several tongues side by side round the token, each rising on its own
  float rise = fbm(vec2(p.x * 3.6, p.y * 1.6 - uTime * 3.4));
  float lick = fbm(vec2(p.x * 3.4 + 7.0, p.y * 3.4 - uTime * 5.5));
  float lift = r * 4.6 * uLife * pow(rise, 1.4);
  vec2 q = px - vec2((lick - 0.5) * r * 0.7, lift);

  float d = length(q - uCenter);
  float heat = smoothstep(r * 1.5, r * 0.55, d) * 1.3;
  // over the token's face the fire is thin: what it is still reads
  heat *= mix(0.4, 1.0, smoothstep(r * 0.35, r * 0.95, length(px - uCenter)));
  // the higher a tongue reaches, the cooler it is
  heat *= 1.0 - smoothstep(0.0, r * 4.6, lift) * 0.55;
  heat *= (0.75 + 0.5 * lick) * uLife;
  // and it hugs the token's rim, all the way round
  float rim = length(px - uCenter);
  heat = max(heat, smoothstep(r * 1.45, r * 1.0, rim) * smoothstep(r * 0.7, r * 1.0, rim) * (0.55 + 0.5 * lick) * uLife);
  // dying: it thins away, its wisps first and its heart last
  // (a low fire has less to lose, so it is worn away in proportion)
  heat = max(0.0, heat * (1.0 - 0.45 * uFade) - uFade * 0.75 * min(uLife, 1.0));

  // catching: a ring of heat running out across the stone
  float ring = length(px - uCenter) - r * (1.0 + 1.8 * uFlash);
  heat += exp(-ring * ring / (r * r * 0.06)) * (1.0 - uFlash) * step(0.001, uFlash) * 0.9;

  // white-hot at its heart; the rest of it burns in the ability's colour
  vec4 colour = heatColour(heat);
  float cool = (1.0 - smoothstep(0.55, 1.15, heat)) * 0.85;
  colour.rgb = mix(colour.rgb, min(uTint * colour.a * 1.3, vec3(1.0)), cool);
  gl_FragColor = colour;
}
`

const smooth = (x: number) => x * x * (3 - 2 * x)

/** How tall it burns `t` seconds in (up fast, a moment at full height, then a little higher as it lifts off), and how far it has died away. */
function lifeAt(t: number): { height: number; fade: number } {
  if (t < CATCH) return { height: smooth(t / CATCH), fade: 0 }
  if (t < BURN) return { height: 1, fade: 0 }
  const v = Math.min(1, (t - BURN) / (OUT - BURN))
  return { height: 1 + 0.25 * v, fade: smooth(v) }
}

export type BlazeSpot = { at: Hex; ability: DragonType; seq: number; delay: number }

/** An ability's colour as a flame's: as bright as it can be at its own hue, so it shows when added to what is under it. */
function flameTint(ability: DragonType): [number, number, number] {
  const hex = DRAGON_THEME[ability].color
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const top = Math.max(...rgb) || 1
  return rgb.map((c) => Math.min(1, (c / top) * 0.85 + 0.15)) as [number, number, number]
}

/**
 * The latest fire-up, kept after its event: the event holds the screen for
 * less time than the fire takes to burn out, and a fire cut off mid-leap looks
 * like a glitch.
 */
export function useBlaze(event: PresentationEvent | null): BlazeSpot | null {
  const [spot, setSpot] = useState<BlazeSpot | null>(null)
  useEffect(() => {
    if (event?.kind === 'fireUp' && event.at) setSpot({ at: event.at, ability: event.ability, seq: event.seq, delay: event.from ? VINE_MS : 0 })
  }, [event])
  useEffect(() => {
    if (!spot) return
    const timer = setTimeout(() => setSpot(null), spot.delay + EMBERS_OUT * 1000)
    return () => clearTimeout(timer)
  }, [spot])
  return spot
}

/**
 * A smouldering token, kept a moment after it is no longer wanted (`out`), so
 * it dies down rather than vanishing.
 */
export function useSmoulder(spot: { at: Hex; ability: DragonType } | null): { at: Hex; ability: DragonType; out: boolean } | null {
  const [shown, setShown] = useState<{ at: Hex; ability: DragonType; out: boolean } | null>(null)
  const q = spot?.at.q
  const r = spot?.at.r
  const ability = spot?.ability
  useEffect(() => {
    if (q !== undefined && r !== undefined && ability) {
      setShown({ at: { q, r }, ability, out: false })
      return
    }
    setShown((previous) => (previous ? { ...previous, out: true } : null))
    const timer = setTimeout(() => setShown(null), SMOULDER_OUT_MS + 100)
    return () => clearTimeout(timer)
  }, [q, r, ability])
  return shown
}

/**
 * The token that fired up last, and with what: the crystal's pick and the
 * potion's swap do not say which token opened them, so it is remembered here,
 * to keep it burning while they are open.
 */
export function useLastFire(event: PresentationEvent | null): { at: Hex; ability: DragonType } | null {
  const [fire, setFire] = useState<{ at: Hex; ability: DragonType } | null>(null)
  useEffect(() => {
    if (event?.kind === 'fireUp' && event.at) setFire({ at: event.at, ability: event.ability })
  }, [event])
  return fire
}

/**
 * A token firing up, set alight in its ability's colour: flames leap from it and burn a moment, a ring
 * of heat runs out over the stone, and embers rise off it; or, smouldering, burning low
 * while its ability waits on a target. HTML over the board
 * (`area`), placed by measuring where the board drew the space; nothing where
 * the player asked for less motion, or where there is no WebGL.
 */
export function TokenBlaze({
  at,
  ability,
  delay,
  area,
  smoulder = false,
  out = false,
}: {
  at: Hex
  ability: DragonType
  delay: number
  area: RefObject<HTMLElement>
  /** Burning low and on, for as long as it is drawn, rather than blazing up and out. */
  smoulder?: boolean
  /** A smouldering token going out: it dies down, as a blaze does. */
  out?: boolean
}) {
  const still = useReducedMotion()
  const flame = useRef<HTMLCanvasElement>(null)
  const embers = useRef<HTMLCanvasElement>(null)
  const [where, setWhere] = useState<{ x: number; y: number; r: number } | null>(null)
  // read by the running fire, which is not started again for it
  const going = useRef(out)
  going.current = out

  useLayoutEffect(() => {
    const box = area.current
    const found = hexOnScreen(box?.querySelector<SVGSVGElement>('svg.board'), box, at)
    if (found && found.unit > 0) setWhere({ x: found.x, y: found.y, r: TOKEN_RADIUS * found.unit })
  }, [area, at])

  useEffect(() => {
    const canvas = flame.current
    const sparkCanvas = embers.current
    if (!where || !canvas || !sparkCanvas) return
    // the fire is soft: it needs fewer pixels than the screen has
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.round(where.r * SPAN.width * ratio)
    const height = Math.round(where.r * SPAN.height * ratio)
    for (const each of [canvas, sparkCanvas]) {
      each.width = width
      each.height = height
    }
    const r = where.r * ratio
    const tint = flameTint(ability)
    // the token's middle, in the canvas's pixels (y down for the embers, up for WebGL)
    const cx = width / 2
    const cy = height - SPAN.below * r

    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    const vertex = gl && compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = gl && compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl?.createProgram() ?? null
    const buffer = gl?.createBuffer() ?? null
    const ready = Boolean(gl && vertex && fragment && program)
    let life: WebGLUniformLocation | null = null
    let time: WebGLUniformLocation | null = null
    let flash: WebGLUniformLocation | null = null
    let fade: WebGLUniformLocation | null = null
    if (gl && ready && program && vertex && fragment) {
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const a = gl.getAttribLocation(program, 'a')
      gl.enableVertexAttribArray(a)
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
      gl.viewport(0, 0, width, height)
      gl.uniform2f(gl.getUniformLocation(program, 'uCenter'), cx, SPAN.below * r)
      gl.uniform1f(gl.getUniformLocation(program, 'uRadius'), r)
      gl.uniform3f(gl.getUniformLocation(program, 'uTint'), ...tint)
      life = gl.getUniformLocation(program, 'uLife')
      time = gl.getUniformLocation(program, 'uTime')
      flash = gl.getUniformLocation(program, 'uFlash')
      fade = gl.getUniformLocation(program, 'uFade')
    }

    const ctx = sparkCanvas.getContext('2d')
    let sparks: Ember[] = []
    let start = 0
    let last = 0
    let frame = 0
    // when a smouldering fire was told to go out, in its own seconds
    let outAt: number | null = null
    const tick = (now: number) => {
      if (!start) start = last = now
      const t = (now - start) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // smouldering: it catches gently, then flickers at half height
      if (smoulder && going.current && outAt === null) outAt = t
      const dying = outAt === null ? 0 : Math.min(1, (t - outAt) / (SMOULDER_OUT_MS / 1000))
      const burning = smoulder
        ? { height: 0.5 * smooth(Math.min(1, t / 0.3)) * (0.9 + 0.1 * Math.sin(t * 7)) * (1 + 0.25 * dying), fade: smooth(dying) }
        : lifeAt(t)
      if (gl && ready) {
        gl.uniform1f(life, burning.height)
        gl.uniform1f(fade, burning.fade)
        gl.uniform1f(time, t)
        gl.uniform1f(flash, smoulder ? 0 : Math.min(1, t / 0.35))
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      if (ctx) {
        // a burst as it catches, then a stream off its top while it burns
        const count = smoulder ? (outAt === null && Math.random() < 0.3 ? 1 : 0) : t < 0.05 ? 18 : t < BURN ? 2 : t < OUT ? 1 : 0
        for (let i = 0; i < count; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * (t < 0.05 ? Math.PI * 1.6 : 1.2)
          const speed = (t < 0.05 ? 3 + Math.random() * 3 : 2 + Math.random() * 2.5) * r
          sparks.push({
            x: cx + (Math.random() - 0.5) * r * 1.4,
            y: cy - r * (0.2 + Math.random() * 0.6),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.45 + Math.random() * 0.55,
            age: 0,
            size: r * (0.05 + Math.random() * 0.07),
            // most in the ability's colour, some plain gold
            tint: Math.random() < 0.7 ? tint : undefined,
          })
        }
        ctx.clearRect(0, 0, width, height)
        // they float: heat carries them up, slowing
        sparks = drawSparks(ctx, sparks, dt, -1.2 * r)
      }
      if ((smoulder && dying < 1) || (!smoulder && t < OUT) || sparks.length) frame = requestAnimationFrame(tick)
    }
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
      if (gl) {
        if (program) gl.deleteProgram(program)
        if (buffer) gl.deleteBuffer(buffer)
      }
    }
  }, [where, delay, ability, smoulder])

  if (still || !where) return null
  const style: CSSProperties = {
    left: where.x - where.r * (SPAN.width / 2),
    top: where.y - where.r * (SPAN.height - SPAN.below),
    width: where.r * SPAN.width,
    height: where.r * SPAN.height,
  }
  return (
    <div className="token-blaze" style={style} aria-hidden="true">
      <canvas ref={flame} />
      <canvas ref={embers} />
    </div>
  )
}
