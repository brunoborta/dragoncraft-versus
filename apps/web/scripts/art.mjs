/**
 * Turns the raw art in `designs/art/` into what the game ships: WebP, sized
 * for a phone at 2x, backgrounds cut out, avatars cropped round, textures made
 * seamless.
 *
 *   node apps/web/scripts/art.mjs            all assets
 *   node apps/web/scripts/art.mjs bag coin   only these
 *
 * Re-run it whenever a source image changes. Nothing here is hand-edited
 * afterwards, so the sources stay the truth. (Chosen on 2026-11-10 from an
 * A/B of each asset; the unchosen sources were deleted.)
 */
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(root, 'designs/art')
const OUT = join(root, 'apps/web/src/assets/art')
mkdirSync(OUT, { recursive: true })

const src = (name) => join(SRC, `${name}.png`)
const out = (name) => join(OUT, `${name}.webp`)

// ---------------------------------------------------------------- helpers

async function raw(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function fromRaw({ data, width, height }) {
  return sharp(data, { raw: { width, height, channels: 4 } })
}

/**
 * Removes a flat studio background — and the soft shadow on it — by flooding
 * in from the border through every pixel that looks like background: close to
 * the corner colour, or a light neutral grey (a shadow on grey is still grey;
 * the subjects here are all saturated: velvet, gold). The edge is eroded by a
 * pixel, so no light halo is left around a dark subject, then softened.
 *
 * `holes`, when set, also clears background the flood cannot reach — the grey
 * seen through a loop of rope — wherever a patch of it is at least that many
 * pixels, so a small highlight on the subject is left alone.
 *
 * `glow`, when set, lets light that fades into the background fade out with it
 * instead of ending on the line where the flood stopped: a kept pixel is as
 * opaque as its colour is far from the background's. Only for a subject that
 * really does glow — on a hard-edged one it would eat the paler highlights.
 */
function cutOut(img, { tolerance = 42, minLight = 120, maxChroma = 22, holes = 0, glow = false } = {}) {
  const { data, width, height } = img
  const at = (x, y) => (y * width + x) * 4
  const corners = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ]
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, [x, y]) => sum + data[at(x, y) + c], 0) / 4)

  const looksLikeBackground = (i) => {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (Math.hypot(r - bg[0], g - bg[1], b - bg[2]) < tolerance) return true
    const light = (r + g + b) / 3
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    return light > minLight && chroma < maxChroma
  }

  const background = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const seed = (x, y) => {
    const p = y * width + x
    if (!background[p] && looksLikeBackground(p * 4)) {
      background[p] = 1
      queue[tail++] = p
    }
  }
  for (let x = 0; x < width; x++) {
    seed(x, 0)
    seed(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    seed(0, y)
    seed(width - 1, y)
  }
  const flood = () => {
    while (head < tail) {
      const p = queue[head++]
      const x = p % width
      const y = (p - x) / width
      if (x > 0) seed(x - 1, y)
      if (x < width - 1) seed(x + 1, y)
      if (y > 0) seed(x, y - 1)
      if (y < height - 1) seed(x, y + 1)
    }
  }
  flood()
  if (holes) {
    /*
     * Each enclosed patch is flooded on its own and cut only if it really is
     * the background behind the subject: big enough to be a gap rather than a
     * highlight, and no brighter than the background is. A white-hot core —
     * the light at the heart of the star — has no colour either, but it is
     * lighter than the grey, and it is paint.
     */
    const bgLight = (bg[0] + bg[1] + bg[2]) / 3
    for (let p = 0; p < width * height; p++) {
      if (background[p] || !looksLikeBackground(p * 4)) continue
      const from = tail
      seed(p % width, Math.floor(p / width))
      flood()
      let light = 0
      for (let i = from; i < tail; i++) {
        const j = queue[i] * 4
        light += (data[j] + data[j + 1] + data[j + 2]) / 3
      }
      const brighter = light / (tail - from) > bgLight + 16
      if (tail - from < holes || brighter) for (let i = from; i < tail; i++) background[queue[i]] = 2
    }
    for (let p = 0; p < width * height; p++) if (background[p] === 2) background[p] = 0
  }

  /**
   * How far each pixel is from the background, in pixels, up to `reach`; -1
   * beyond it. Only the band near the edge fades out in `glow` mode: deep
   * inside the subject a white-hot highlight is paint, not light spilling onto
   * the background, and must stay solid.
   */
  let nearEdge = null
  if (glow) {
    const reach = Math.round(Math.min(width, height) * 0.08)
    nearEdge = new Int32Array(width * height).fill(-1)
    const ring = new Int32Array(width * height)
    let ringHead = 0
    let ringTail = 0
    for (let p = 0; p < width * height; p++) {
      if (background[p]) {
        nearEdge[p] = 0
        ring[ringTail++] = p
      }
    }
    while (ringHead < ringTail) {
      const p = ring[ringHead++]
      const step = nearEdge[p] + 1
      if (step > reach) continue
      const x = p % width
      const y = (p - x) / width
      const push = (xx, yy) => {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) return
        const n = yy * width + xx
        if (nearEdge[n] < 0) {
          nearEdge[n] = step
          ring[ringTail++] = n
        }
      }
      push(x - 1, y)
      push(x + 1, y)
      push(x, y - 1)
      push(x, y + 1)
    }
  }

  const keep = new Uint8Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x
      keep[p] =
        !background[p] && !background[p - 1] && !background[p + 1] && !background[p - width] && !background[p + width] ? 255 : 0
    }
  }
  const result = Buffer.from(data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
          sum += keep[yy * width + xx]
          n++
        }
      }
      let alpha = sum / n
      if (glow && alpha > 0 && nearEdge[y * width + x] >= 0) {
        const i = at(x, y)
        const distance = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2])
        // the same colour as the background is fully clear; twice the tolerance away is solid
        const t = Math.min(1, Math.max(0, (distance - tolerance * 0.5) / (tolerance * 1.5)))
        alpha = Math.min(alpha, 255 * t)
      }
      result[at(x, y) + 3] = Math.round(alpha)
    }
  }
  return { data: result, width, height }
}

/**
 * Makes a texture tile without a visible seam: blends it with a copy of itself
 * shifted by half, using the shifted copy near the edges (where it is
 * continuous across the wrap) and the original in the middle.
 */
function seamless({ data, width, height }) {
  const result = Buffer.alloc(data.length)
  const smooth = (e0, e1, v) => {
    const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const sx = (x + width / 2) % width
      const sy = (y + height / 2) % height
      const j = (sy * width + sx) * 4
      const edge = Math.max(Math.abs(x / width - 0.5), Math.abs(y / height - 0.5)) * 2
      const w = smooth(0.55, 1, edge)
      for (let c = 0; c < 3; c++) result[i + c] = Math.round(data[i + c] * (1 - w) + data[j + c] * w)
      result[i + 3] = 255
    }
  }
  return { data: result, width, height }
}

function circleMask(size) {
  const r = size / 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  )
}

function report(name) {
  console.log(`  ${name}.webp  ${(statSync(out(name)).size / 1024).toFixed(0)} KB`)
}

// ---------------------------------------------------------------- assets

const ASSETS = {
  async bg() {
    // the source is 852 wide: kept at full size, which is 2x for a 426px phone
    await sharp(src('bg-game')).webp({ quality: 78 }).toFile(out('bg-game'))
    report('bg-game')
    // behind dialogs: small and blurred, so it costs almost nothing
    await sharp(src('bg-game')).resize({ width: 320 }).blur(6).webp({ quality: 60 }).toFile(out('bg-overlay'))
    report('bg-overlay')
  },

  async bag() {
    const img = cutOut(await raw(src('bag')))
    await fromRaw(img).trim({ threshold: 1 }).resize({ width: 256, height: 256, fit: 'inside' }).webp({ quality: 82, alphaQuality: 90 }).toFile(out('bag'))
    report('bag')
  },

  async plates() {
    // optional: the velvet cushion a drawn token waits on (prompts, round 4), yours
    // and the opponent's. Shown about 80px wide, so 240 is 3x.
    for (const side of ['you', 'opponent']) {
      const name = `plate-${side}`
      if (!existsSync(src(name))) {
        console.log(`  (no designs/art/${name}.png yet)`)
        continue
      }
      const img = cutOut(await raw(src(name)))
      await fromRaw(img).trim({ threshold: 1 }).resize({ width: 240 }).webp({ quality: 84, alphaQuality: 90 }).toFile(out(name))
      report(name)
    }
  },

  async crests() {
    // optional: the emblem over the end screen, one per result (prompts, round 3).
    // Shown about 150px wide, so 300 is 2x.
    for (const result of ['win', 'lose', 'draw']) {
      const name = `crest-${result}`
      if (!existsSync(src(name))) {
        console.log(`  (no designs/art/${name}.png yet)`)
        continue
      }
      const img = cutOut(await raw(src(name)), { holes: 400, glow: true })
      await fromRaw(img).trim({ threshold: 1 }).resize({ width: 300, height: 300, fit: 'inside' }).webp({ quality: 84, alphaQuality: 90 }).toFile(out(name))
      report(name)
    }
  },

  async puff() {
    // The dust a landing token kicks up. Painted as light on black, so the
    // black becomes transparency: each pixel is as opaque as it is bright, and
    // its colour is divided back out so the dust stays gold over pale stone
    // instead of turning to grey. Shown about 110px wide; 320 is 2x and some.
    const { data, width, height } = await raw(src('dust-puff'))
    const out_ = Buffer.alloc(data.length)
    for (let i = 0; i < data.length; i += 4) {
      const a = Math.max(data[i], data[i + 1], data[i + 2])
      // the faint haze of the black itself is noise, not dust
      const alpha = Math.max(0, Math.min(255, Math.round(((a - 14) / (255 - 14)) * 255 * 1.25)))
      const k = a > 0 ? 255 / a : 0
      out_[i] = Math.min(255, Math.round(data[i] * k))
      out_[i + 1] = Math.min(255, Math.round(data[i + 1] * k))
      out_[i + 2] = Math.min(255, Math.round(data[i + 2] * k))
      out_[i + 3] = alpha
    }
    await fromRaw({ data: out_, width, height })
      .trim({ threshold: 1 })
      .resize({ width: 320, fit: 'inside' })
      .webp({ quality: 80, alphaQuality: 80 })
      .toFile(out('dust-puff'))
    report('dust-puff')
  },

  async coin() {
    const img = cutOut(await raw(src('coin')))
    await fromRaw(img).trim({ threshold: 1 }).resize({ width: 128, height: 128, fit: 'inside' }).webp({ quality: 85, alphaQuality: 90 }).toFile(out('coin'))
    report('coin')
  },

  async avatars() {
    const SIZE = 256
    // both come inside a painted gold ring: crop just inside it, then round.
    // The opponent faced left in the source; both plates sit on the left edge,
    // so it is mirrored to face the board like the other one.
    const crops = {
      'avatar-you': { flip: false },
      'avatar-opponent': { flip: true },
    }
    for (const [name, { flip }] of Object.entries(crops)) {
      const meta = await sharp(src(name)).metadata()
      const side = Math.round(meta.width * 0.8)
      let pipeline = sharp(src(name)).extract({
        left: Math.round(meta.width * 0.1),
        top: Math.round(meta.height * 0.1),
        width: side,
        height: side,
      })
      if (flip) pipeline = pipeline.flop()
      const squared = await pipeline.resize(SIZE, SIZE).png().toBuffer()
      await sharp(squared)
        .ensureAlpha()
        .composite([{ input: circleMask(SIZE), blend: 'dest-in' }])
        .webp({ quality: 82, alphaQuality: 90 })
        .toFile(out(name))
      report(name)
    }
  },

  async textures() {
    for (const kind of ['stone', 'parchment']) {
      const small = await raw(await sharp(src(`tex-${kind}`)).resize(512, 512).png().toBuffer())
      await fromRaw(seamless(small)).webp({ quality: 74 }).toFile(out(`tex-${kind}`))
      report(`tex-${kind}`)
    }
  },
}

const wanted = process.argv.slice(2)
for (const [name, make] of Object.entries(ASSETS)) {
  if (wanted.length && !wanted.includes(name)) continue
  console.log(name)
  await make()
}
