import { useEffect, useRef } from 'react'

/**
 * The front door's fire, drawn by code rather than painted: the two springs of
 * flame that coil round Play when it is pressed, and the sparks the cards throw
 * as they are dealt. Each runs only while it is on screen, then stops drawing.
 */

/*
 * The comets' course, in seconds from the press. Two of them, one the other's
 * mirror. Each is a spring of fire: it leaves the middle of the plate and coils
 * out along the button to its own end, round and round it, up across its face
 * and down behind it, and past the end shoots off to that side, as the front
 * door's buttons draw away.
 */
const WIND = 0.65
const GONE = 0.85
/** How many times each coils round the button: a little over three, to come out in front of it. */
const TURNS = 3.125
/** When the comets leave for the sides: the moment the front door's buttons start to go. */
export const COMETS_LEAVE_MS = WIND * 1000

/** Each comet's trail: as many points along its course, this far apart in time. */
const TRAIL = 36
const TRAIL_STEP = 0.013

const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`

/*
 * Two trails of flame, each a line through TRAIL points: hot, white and thick
 * at its head, thinning and cooling to red down its tail. Flames lick upward:
 * each pixel looks for the trail some way below it, by a rising noise, so the
 * tongues are of every length and keep moving. Each point says how far in
 * front of the button it is (1 in front, 0 behind), and the layer drawn
 * (uFront) keeps only its own part.
 */
const FRAGMENT = `
precision mediump float;
uniform vec4 uPoints[${TRAIL * 2}];
uniform float uSize;
uniform float uTime;
uniform float uFront;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float s = uSize;
  vec2 p = px / s;

  float rise = fbm(vec2(p.x * 1.6, p.y * 1.6 - uTime * 2.6));
  float lick = fbm(vec2(p.x * 3.2 + 7.0, p.y * 3.2 - uTime * 4.5));
  float lift = s * 0.8 * rise * rise;
  vec2 q = px - vec2((lick - 0.5) * s * 0.25, lift);

  float heat = 0.0;
  for (int i = 0; i < ${TRAIL * 2 - 1}; i++) {
    if (i == ${TRAIL - 1}) continue;
    vec4 a = uPoints[i];
    vec4 b = uPoints[i + 1];
    vec2 ab = b.xy - a.xy;
    float h = clamp(dot(q - a.xy, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
    float d = length(q - a.xy - ab * h);
    // 0 at the head, 1 at the tail's end
    float f = (mod(float(i), ${TRAIL}.0) + h) / ${TRAIL - 1}.0;
    // nearer is larger and brighter, further is smaller and dimmer
    float near = mix(a.w, b.w, h);
    float width = s * (0.26 + 0.14 * lick) * (1.0 - 0.75 * f) * pow(near, 1.2);
    // at the sides it is in both layers at once, so it never dims passing from one to the other
    float layer = mix(a.z, b.z, h);
    layer = clamp(2.0 * mix(1.0 - layer, layer, uFront), 0.0, 1.0);
    float c = smoothstep(width, 0.0, d) * pow(1.0 - f, 1.3) * layer * clamp(near * near, 0.45, 1.3);
    heat = max(heat, c);
  }
  // the higher a tongue reaches, the cooler it is
  heat *= 1.0 - smoothstep(0.0, s * 0.8, lift) * 0.55;
  heat *= 0.8 + 0.45 * lick;

  float h = clamp(heat * 1.3, 0.0, 1.4);
  vec3 col = vec3(1.6 * sqrt(h), 1.2 * h * h, 0.8 * h * h * h * h);
  float alpha = clamp(h * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(1.0)) * alpha, alpha);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader))
    return null
  }
  return shader
}

interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  size: number
}

/** A spark's colour as it cools: white, gold, orange, a dark red, gone. */
function sparkColour(t: number, alpha: number): string {
  const r = 255
  const g = Math.round(245 - 170 * t)
  const b = Math.round(200 * Math.max(0, 1 - t * 2.5))
  return `rgba(${r},${g},${b},${alpha})`
}

function drawSparks(ctx: CanvasRenderingContext2D, sparks: Ember[], dt: number, gravity: number): Ember[] {
  ctx.globalCompositeOperation = 'lighter'
  const alive: Ember[] = []
  for (const spark of sparks) {
    spark.age += dt
    if (spark.age >= spark.life) continue
    spark.vy += gravity * dt
    spark.vx *= 1 - 0.8 * dt
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    const t = spark.age / spark.life
    const radius = spark.size * (1 - t * 0.6)
    const glow = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, radius * 3)
    glow.addColorStop(0, sparkColour(t, 1 - t))
    glow.addColorStop(0.35, sparkColour(t, (1 - t) * 0.5))
    glow.addColorStop(1, sparkColour(t, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(spark.x, spark.y, radius * 3, 0, Math.PI * 2)
    ctx.fill()
    alive.push(spark)
  }
  ctx.globalCompositeOperation = 'source-over'
  return alive
}


const smooth = (x: number) => x * x * (3 - 2 * x)

/** How far the spring is turned from the screen, so its coils are seen as loops rather than lines. */
const YAW = (34 * Math.PI) / 180

/**
 * Where the left comet is `t` seconds after the press, on its spring: `x`
 * along the button (in half-widths of it, out to the left), and `y` (down) and
 * `z` (out of the screen, towards the player) round it, in radii of the coil.
 */
function springAt(t: number): { x: number; y: number; z: number } {
  if (t <= 0) return { x: 0, y: 0, z: 0 }
  // first down and towards the player, then up across the face, over, down behind, under, and again
  const start = Math.PI / 4
  if (t < WIND) {
    const u = t / WIND
    const along = 1.2 * (u * 0.7 + smooth(u) * 0.3)
    const reach = smooth(Math.min(1, u / 0.22)) * (1 + 0.15 * u)
    const angle = start + TURNS * Math.PI * 2 * u
    return { x: -along, y: reach * Math.cos(angle), z: reach * Math.sin(angle) }
  }
  // off the end and away to its side, uncoiling as it goes
  const v = Math.min(1, (t - WIND) / (GONE - WIND))
  const reach = 1.15 * (1 - v)
  const angle = start + TURNS * Math.PI * 2 + 4 * v
  return { x: -1.2 - 7 * v * v, y: reach * Math.cos(angle), z: reach * Math.sin(angle) }
}

/**
 * A point of a spring as seen, in pixels from the plate's middle: turned a
 * little from the screen (each spring its own way, `side` 1 being the right
 * one: the left's, turned half round about the plate's middle, so the two are
 * one spring through it), so the near side of each coil is seen apart from the
 * far, and in a little perspective, nearer being larger. `front` is how far in
 * front of the plate it is, 0 to 1; `scale` how large it is drawn.
 */
function project(point: { x: number; y: number; z: number }, side: number, half: number, coil: number) {
  const depth = point.z * Math.cos(YAW)
  const near = 1 / (1 - depth / 4)
  const x = (point.x * half + point.z * coil * Math.sin(YAW)) * -side
  return {
    x: x * near,
    // the right spring is the left one turned upside down as well as about: as one rises across the face the other falls
    y: point.y * coil * near * -side,
    front: smooth(Math.min(1, Math.max(0, point.z * 2.5 + 0.5))),
    scale: near,
  }
}

/**
 * The flame round Play, from the moment it is pressed: two comets of fire,
 * drawn on two canvases, one behind the button for the part of their course
 * that passes behind it and one in front for the rest, with the embers they
 * throw. Both canvases are larger than the button, for the comets to leave by.
 * Their springs start at the plate's middle (54% down the button) and coil
 * out past its ends: in front they cross its face, behind it they are lost.
 */
export function FireRing() {
  const behind = useRef<HTMLCanvasElement>(null)
  const inFront = useRef<HTMLCanvasElement>(null)
  const embers = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const back = behind.current
    const front = inFront.current
    const sparkCanvas = embers.current
    const button = front?.parentElement
    if (!back || !front || !sparkCanvas || !button) return
    // the fire is soft: it needs fewer pixels than the screen has
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    const box = front.getBoundingClientRect()
    const plate = button.getBoundingClientRect()
    for (const each of [back, front, sparkCanvas]) {
      each.width = Math.round(box.width * ratio)
      each.height = Math.round(box.height * ratio)
    }
    const width = front.width
    const height = front.height
    // the orbit, in the canvases' own pixels (y down)
    const cx = (plate.left + plate.width * 0.5 - box.left) * ratio
    const cy = (plate.top + plate.height * 0.541 - box.top) * ratio
    // the spring runs the button's length; its coils reach past the plate's top and foot, so they are seen to go round it
    const half = plate.width * 0.5 * ratio
    const coil = plate.height * 0.72 * ratio
    const size = plate.height * 0.62 * ratio
    const place = (t: number, side: number) => {
      const at = project(springAt(t), side, half, coil)
      return { x: cx + at.x, y: cy + at.y, front: at.front, scale: at.scale }
    }

    const layers = [
      { canvas: back, front: 0 },
      { canvas: front, front: 1 },
    ].map(({ canvas, front: layer }) => {
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
      if (!gl) return null
      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
      const program = gl.createProgram()
      if (!program || !vertex || !fragment) return null
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      gl.useProgram(program)
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const at = gl.getAttribLocation(program, 'a')
      gl.enableVertexAttribArray(at)
      gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
      gl.viewport(0, 0, width, height)
      gl.uniform1f(gl.getUniformLocation(program, 'uSize'), size)
      gl.uniform1f(gl.getUniformLocation(program, 'uFront'), layer)
      return {
        gl,
        program,
        buffer,
        points: gl.getUniformLocation(program, 'uPoints'),
        time: gl.getUniformLocation(program, 'uTime'),
      }
    })

    const ctx = sparkCanvas.getContext('2d')
    let sparks: Ember[] = []
    const points = new Float32Array(TRAIL * 2 * 4)

    const start = performance.now()
    let last = start
    let frame = 0
    const tick = (now: number) => {
      const t = (now - start) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // each comet's trail, head first; WebGL's y runs up
      ;[-1, 1].forEach((side, comet) => {
        for (let k = 0; k < TRAIL; k++) {
          const at = place(t - k * TRAIL_STEP, side)
          const index = (comet * TRAIL + k) * 4
          points[index] = at.x
          points[index + 1] = height - at.y
          points[index + 2] = at.front
          points[index + 3] = at.scale
        }
      })
      for (const layer of layers) {
        if (!layer) continue
        const { gl } = layer
        gl.uniform4fv(layer.points, points)
        gl.uniform1f(layer.time, t)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      if (ctx) {
        // embers thrown off behind each head while it is in front, more as it shoots away
        for (const side of [-1, 1]) {
          if (t > GONE) break
          const head = place(t, side)
          const before = place(t - 0.02, side)
          if (head.front < 0.5) continue
          const count = t > WIND ? 6 : 3
          for (let i = 0; i < count; i++) {
            sparks.push({
              x: head.x,
              y: head.y,
              vx: ((before.x - head.x) / 0.02) * 0.15 + (Math.random() - 0.5) * 120 * ratio,
              vy: ((before.y - head.y) / 0.02) * 0.15 - (40 + Math.random() * 120) * ratio,
              life: 0.35 + Math.random() * 0.5,
              age: 0,
              size: (1 + Math.random() * 1.6) * ratio,
            })
          }
        }
        ctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height)
        sparks = drawSparks(ctx, sparks, dt, 160 * ratio)
      }
      // once both are gone and their embers out, it stops drawing
      if (t < GONE + TRAIL * TRAIL_STEP || sparks.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      for (const layer of layers) {
        if (!layer) continue
        layer.gl.deleteProgram(layer.program)
        layer.gl.deleteBuffer(layer.buffer)
      }
    }
  }, [])

  return (
    <>
      <canvas ref={behind} className="play-fire" data-layer="behind" aria-hidden="true" />
      <canvas ref={inFront} className="play-fire" data-layer="front" aria-hidden="true" />
      <canvas ref={embers} className="play-fire" data-layer="front" aria-hidden="true" />
    </>
  )
}

/**
 * Sparks thrown by the cards as they are dealt: each card, while it rises into
 * place, sheds them from its lower edge, and as it lands a ring of them bursts
 * off its frame. Watches the cards themselves (their boxes as they move), so
 * it keeps time with however the stylesheet deals them. `deal` changes with
 * each new hand.
 */
export function CardSparks({ deal }: { deal: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const stage = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !stage || !ctx) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const box = canvas.getBoundingClientRect()
    canvas.width = Math.round(box.width * ratio)
    canvas.height = Math.round(box.height * ratio)

    const cards = [...stage.querySelectorAll<HTMLElement>('.choice-card')]
    // each card's deal, as the stylesheet times it
    const deals = cards.map((card) => {
      const animation = card.getAnimations().find((each) => (each as CSSAnimation).animationName === 'card-deal')
      const timing = animation?.effect?.getComputedTiming()
      const delay = Number(timing?.delay ?? 0)
      const duration = Number(timing?.duration ?? 560)
      return { card, from: delay, to: delay + duration, landed: false }
    })

    let sparks: Ember[] = []
    const start = performance.now()
    let last = start
    let frame = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let busy = sparks.length > 0
      for (const each of deals) {
        if (elapsed < each.from || each.landed) {
          busy ||= !each.landed
          continue
        }
        const rect = each.card.getBoundingClientRect()
        const x = (rect.left - box.left) * ratio
        const y = (rect.top - box.top) * ratio
        const w = rect.width * ratio
        const h = rect.height * ratio
        if (elapsed < each.to * 0.75) {
          busy = true
          // shed from the lower edge as it rises: they fall behind it
          for (let i = 0; i < 5; i++) {
            sparks.push({
              x: x + Math.random() * w,
              y: y + h * (0.85 + Math.random() * 0.2),
              vx: (Math.random() - 0.5) * 120 * ratio,
              vy: (20 + Math.random() * 120) * ratio,
              life: 0.35 + Math.random() * 0.45,
              age: 0,
              size: (0.8 + Math.random() * 1.4) * ratio,
            })
          }
        } else {
          // landed: a ring of them off its frame
          each.landed = true
          for (let i = 0; i < 46; i++) {
            const edge = Math.random() * 2 * (w + h)
            const onTop = edge < w
            const onRight = !onTop && edge < w + h
            const onBottom = !onTop && !onRight && edge < 2 * w + h
            const px = onTop ? x + edge : onRight ? x + w : onBottom ? x + (edge - w - h) : x
            const py = onTop ? y : onRight ? y + (edge - w) : onBottom ? y + h : y + (edge - 2 * w - h)
            const dx = px - (x + w / 2)
            const dy = py - (y + h / 2)
            const length = Math.hypot(dx, dy) || 1
            const speed = (40 + Math.random() * 140) * ratio
            sparks.push({
              x: px,
              y: py,
              vx: (dx / length) * speed,
              vy: (dy / length) * speed - 30 * ratio,
              life: 0.3 + Math.random() * 0.45,
              age: 0,
              size: (0.8 + Math.random() * 1.5) * ratio,
            })
          }
        }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      sparks = drawSparks(ctx, sparks, dt, 260 * ratio)
      // once every card is down and the last spark out, it stops drawing
      if (busy || sparks.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [deal])

  return <canvas ref={ref} className="choice-sparks" aria-hidden="true" />
}
