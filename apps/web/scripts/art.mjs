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
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(root, 'designs/art')
const OUT = join(root, 'apps/web/src/assets/art')
mkdirSync(OUT, { recursive: true })

const src = (name) => join(SRC, `${name}.png`)
const out = (name) => join(OUT, `${name}.webp`)
/**
 * The front door's pictures, twice: AVIF, about 40% under WebP at the same
 * look, and WebP for the browsers that cannot read it (iOS 14 and 15). A
 * device fetches only the one it reads (components/Picture).
 */
const AVIF = { quality: 58, effort: 6 }
async function twice(image, name) {
  await image.clone().avif(AVIF).toFile(join(OUT, `${name}.avif`))
  await image.clone().webp({ quality: 80, alphaQuality: 85 }).toFile(out(name))
  for (const kind of ['avif', 'webp']) reportFile(join(OUT, `${name}.${kind}`))
}

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
  reportFile(out(name))
}

function reportFile(file) {
  console.log(`  ${basename(file)}  ${(statSync(file).size / 1024).toFixed(0)} KB`)
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
      const source = await raw(src(name))
      // painted on black (the win crest of 2026-11-21) or on light grey (the others):
      // on black nothing light is background, so the light-grey rule is off
      const dark = (source.data[0] + source.data[1] + source.data[2]) / 3 < 40
      const img = cutOut(source, { holes: 400, glow: true, ...(dark ? { minLight: 256 } : {}) })
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

  async maple() {
    // Professor Maple, the tutorial's teacher (prompts, round 5): one bust per
    // pose, in designs/art/maple/. Most come cut out already; `thinking` came on
    // black, so the black is flooded out from the border — with the light-grey
    // rule off, since nothing light around him is background. Shown up to about
    // 180px tall, so 384 is 2x.
    const POSES = ['explaining', 'thumbs-up', 'portrait', 'scroll', 'thinking', 'cards', 'feast', 'magnifier', 'coin', 'surprised', 'welcoming', 'pointing']
    const pose = (name) => join(SRC, 'maple', `${name}.png`)
    for (const name of POSES) {
      const meta = await sharp(pose(name)).metadata()
      const img = await raw(pose(name))
      const cut = meta.hasAlpha ? img : cutOut(img, { tolerance: 34, minLight: 256 })
      await fromRaw(cut)
        .trim({ threshold: 1 })
        .resize({ height: 384, fit: 'inside' })
        .webp({ quality: 82, alphaQuality: 90 })
        .toFile(out(`maple-${name}`))
      report(`maple-${name}`)
    }
    // his seat at the top of the table: the portrait's head, cropped round like the other avatars
    const SIZE = 256
    const meta = await sharp(pose('portrait')).metadata()
    const side = Math.round(meta.width * 0.74)
    const head = await sharp(pose('portrait'))
      .extract({ left: Math.round(meta.width * 0.1), top: 0, width: side, height: side })
      .resize(SIZE, SIZE)
      .png()
      .toBuffer()
    await sharp(head)
      .ensureAlpha()
      .composite([{ input: circleMask(SIZE), blend: 'dest-in' }])
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(out('maple-avatar'))
    report('maple-avatar')
  },

  async menu() {
    // the front door's scene, kept at its full 1024 wide: MenuScene moves its
    // water, banners and the purple dragon by the pixel, so it is not resized
    await twice(sharp(src('bg-no-logo')), 'bg-menu')
    // the logo came on a white, noisy "transparent" checker: cut it out
    const logo = cutOut(await raw(src('logo')), { tolerance: 60, minLight: 150, maxChroma: 30 })
    // trimmed first, then sized: sharp would resize before trimming in one pipeline
    const trimmed = await fromRaw(logo).trim({ threshold: 1 }).png().toBuffer()
    await twice(sharp(trimmed).resize({ width: 900 }), 'logo')
  },

  async buttons() {
    // the front door's buttons, drawn alone on transparency (designs/art/buttons/). Play is cut in
    // layers on one canvas, its plate and each of its four claws, so the claws can close on it one
    // by one; the plate is blank, for Play to be written on it in Cinzel. Places measured on the
    // 1774 x 887 source.
    const dir = (name) => join(SRC, 'buttons', `${name}.png`)
    const play = await raw(dir('play'))
    const { width, height, data } = play
    const inside = (poly, x, y) => {
      let hit = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]
        const [xj, yj] = poly[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
      }
      return hit
    }
    // the hexagon and its frame, the little peaks at the middle of its top and bottom included
    const plate = [
      [140, 465], [300, 225], [560, 195], [840, 165], [885, 140], [930, 165], [1210, 195], [1470, 225],
      [1632, 465], [1470, 705], [1210, 735], [930, 770], [885, 805], [840, 770], [560, 735], [300, 705],
    ]
    const corner = (x, y) => (y < 465 ? (x < 887 ? 'tl' : 'tr') : x < 887 ? 'bl' : 'br')
    const layers = Object.fromEntries(['plate', 'tl', 'tr', 'bl', 'br'].map((name) => [name, Buffer.alloc(data.length)]))
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        const target = layers[inside(plate, x, y) ? 'plate' : corner(x, y)]
        data.copy(target, p, p, p + 4)
      }
    }
    // every layer cut to the same box, the button's own, so they lie on one another exactly
    const { info } = await sharp(dir('play')).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true })
    const box = { left: -info.trimOffsetLeft, top: -info.trimOffsetTop, width: info.width, height: info.height }
    console.log(`  play cut to ${box.width}x${box.height} at ${box.left},${box.top}: the plate's centre is at 886,465`)
    for (const [name, pixels] of Object.entries(layers)) {
      const file = name === 'plate' ? 'menu-play-plate' : `menu-play-claw-${name}`
      // shown about 240px across on a phone: 720 is 3x
      const cut = await fromRaw({ data: pixels, width, height }).extract(box).png().toBuffer()
      await twice(sharp(cut).resize({ width: 720 }), file)
    }
    // Tutorial and the settings, whole: shown 76px across, so 228 is 3x
    for (const name of ['tutorial', 'settings']) {
      const trimmed = await sharp(dir(name)).trim({ threshold: 1 }).png().toBuffer()
      await twice(sharp(trimmed).resize({ width: 228 }), `menu-${name}`)
    }
  },

  async choice() {
    // Play's windows, dealt as cards over the darkened painting (designs/art/transition/), all
    // drawn on transparency. Places measured on the sources.
    const dir = (name) => join(SRC, 'transition', `${name}.png`)

    // the stone floor the cards stand on, its barrels and crates at the ends; seen across a phone and
    // more, so 1200 wide
    const floor = await sharp(dir('bg')).trim({ threshold: 1 }).png().toBuffer()
    await twice(sharp(floor).resize({ width: 1200 }), 'choice-floor')

    // the banner the window's title is written on; seen about 360px across: 1080 is 3x
    const banner = await sharp(dir('Aged Parchment Scroll Banner-3')).trim({ threshold: 1 }).png().toBuffer()
    await twice(sharp(banner).resize({ width: 1080 }), 'choice-banner')

    // the two arrows are drawn side by side, each lit from its own side: cut apart rather than one turned
    const arrows = dir('Emerald Fantasy Navigation Arrows-4')
    for (const [name, left] of [['left', 0], ['right', 887]]) {
      const half = await sharp(arrows).extract({ left, top: 0, width: 887, height: 887 }).png().toBuffer()
      const trimmed = await sharp(half).trim({ threshold: 1 }).png().toBuffer()
      await twice(sharp(trimmed).resize({ height: 150 }), `choice-arrow-${name}`)
    }

    // the two dragons, painted side by side, each already cut out on its own base: the machine's, the
    // right one, cut off (Vs. Player is painted whole now). Shown about 180px across: 560 is 3x
    const dragons = dir('Dual Dragon Portraits_ Fire and Steam-1')
    for (const [name, left] of [['computer', 768]]) {
      const half = await sharp(dragons).extract({ left, top: 0, width: 768, height: 1024 }).png().toBuffer()
      const trimmed = await sharp(half).trim({ threshold: 1 }).png().toBuffer()
      await twice(sharp(trimmed).resize({ width: 560 }), `choice-dragon-${name}`)
    }

    // the machine's three dragons, one per difficulty, painted side by side and growing from Easy to
    // Hard, on one base line: each cut out on a canvas as large as the largest (its columns, measured
    // on the source, centred; the rows the three share), so the same place on the card keeps them in
    // proportion, the little one little
    const robots = dir('Steampunk Dragon Trio in Bronze Metal')
    const rows = await sharp(robots).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
    const top = -(rows.info.trimOffsetTop ?? 0)
    const tall = rows.info.height
    const wide = 640
    for (const [name, left, right] of [['easy', 184, 569], ['medium', 767, 1276], ['hard', 1397, 2036]]) {
      const width = right - left
      const one = await sharp(robots).extract({ left, top, width, height: tall }).png().toBuffer()
      const pad = Math.floor((wide - width) / 2)
      const placed = await sharp(one)
        .extend({ left: pad, right: wide - width - pad, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      await twice(sharp(placed).resize({ width: 560 }), `choice-robot-${name}`)
    }

    // The card's frame. The blank frame (its window and all round it transparent) has crossed swords on
    // its plate; the two finished cards are the same frame, pixel for pixel, with an arena in the window
    // and their own mark on the plate (the swords, a monitor). From them: the frame with the swords
    // (Vs. Player), the frame with the monitor (Vs. Computer), the frame with no mark (every other
    // card), and each arena alone, to be shown in the window behind its dragon.
    const blank = await raw(dir('Ornate Emerald Fantasy Card Frame'))
    const night = await raw(dir('Nocturnal Dragon Arena Monitor-2'))
    const sunset = await raw(dir('Sunset Arena Goldswords Card-1'))
    const { width, height } = blank
    const at = (x, y) => (y * width + x) * 4
    // the finished cards are a pixel shorter; they are read as if padded at the foot
    const pixel = (image, x, y) => (y < image.height ? at(x, y) : -1)

    const monitor = Buffer.from(blank.data)
    const arenas = { player: Buffer.alloc(blank.data.length), computer: Buffer.alloc(blank.data.length) }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = at(x, y)
        const q = pixel(night, x, y)
        if (q < 0) continue
        // the frame with the monitor: the night card's colours, the blank frame's shape (its window open)
        for (let c = 0; c < 3; c++) monitor[p + c] = night.data[q + c]
        // each arena: the finished card where the blank frame is open, inside the card
        const open = 255 - blank.data[p + 3]
        for (const [name, card] of [['player', sunset], ['computer', night]]) {
          const r = pixel(card, x, y)
          card.data.copy(arenas[name], p, r, r + 3)
          arenas[name][p + 3] = Math.min(open, card.data[r + 3])
        }
      }
    }

    // the swords off the blank frame: the plate's own cloth laid over them, taken from further down it,
    // feathered in. Each sword runs tip to pommel across the other.
    const plain = Buffer.from(blank.data)
    const swords = [
      [433, 877, 600, 1036],
      [600, 877, 437, 1036],
    ]
    const toSegment = (x, y, [ax, ay, bx, by]) => {
      const dx = bx - ax
      const dy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
      return Math.hypot(x - ax - dx * t, y - ay - dy * t)
    }
    const BELOW = 185
    // the gold rim over the plate is left whole: in each column, the cloth starts where the gold ends
    const cloth = (x) => {
      for (let y = 800; y < 1000; y++) {
        const p = at(x, y)
        if (blank.data[p + 1] > blank.data[p] + 5) return y
      }
      return 1000
    }
    // where a sword's tip touches the rim there is no cloth between them: the columns either side say where it starts
    const starts = Array.from({ length: 300 }, (_, i) => cloth(370 + i))
    for (let x = 380; x < 660; x++) {
      const top = Math.min(...starts.slice(x - 370 - 8, x - 370 + 9)) + 3
      for (let y = top; y < 1080; y++) {
        const reach = Math.min(...swords.map((sword) => toSegment(x, y, sword)))
        const cover = Math.max(0, Math.min(1, (46 - reach) / 12)) * Math.min(1, (y - top) / 4)
        if (!cover) continue
        const p = at(x, y)
        const q = at(x, y + BELOW)
        for (let c = 0; c < 3; c++) plain[p + c] = Math.round(plain[p + c] * (1 - cover) + blank.data[q + c] * cover)
      }
    }

    // every layer of the card cut to the frame's own box, so they lie on one another exactly
    const { info } = await sharp(dir('Ornate Emerald Fantasy Card Frame')).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true })
    const box = { left: -info.trimOffsetLeft, top: -info.trimOffsetTop, width: info.width, height: info.height }
    console.log(`  card cut to ${box.width}x${box.height} at ${box.left},${box.top}: its window is 126,176 to 896,931`)
    const card = async (pixels, name) => {
      const cut = await fromRaw({ data: pixels, width, height }).extract(box).png().toBuffer()
      // shown about 190px across: 600 is 3x
      await twice(sharp(cut).resize({ width: 600 }), name)
    }
    await card(monitor, 'choice-frame-computer')
    await card(plain, 'choice-frame')
    await card(arenas.computer, 'choice-arena-computer')

    // Vs. Player (two dragons arm wrestling), Create and Join, each painted whole (frame, scene and
    // mark in one, no dragon to stand apart): cut to their frame and brought to the others' size (they
    // are within a pixel or two of its shape). Round them lies a haze of all but clear specks (alpha
    // under 8): cleared first, or the cut would take it for the card.
    const size = { width: 600, height: Math.round((600 * box.height) / box.width) }
    for (const [name, file] of [['player', 'arm-wrestling'], ['create', 'create'], ['join', 'join']]) {
      const image = await raw(dir(file))
      for (let p = 3; p < image.data.length; p += 4) if (image.data[p] < 8) image.data[p] = 0
      const cleared = await fromRaw(image).png().toBuffer()
      const trimmed = await sharp(cleared).trim({ threshold: 1 }).png().toBuffer()
      await twice(sharp(trimmed).resize({ ...size, fit: 'fill' }), `choice-card-${name}`)
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
