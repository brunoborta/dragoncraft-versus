/**
 * Cuts the menu painting's moving pieces out of the video takes, as listed in
 * apps/web/src/art/menu-motion.json: for each, a small MP4 of just its corner
 * of the painting, and a mask that softens its edges so it sits in the still
 * picture with no seam.
 *
 *   node apps/web/scripts/menu-motion.mjs                 every piece
 *   node apps/web/scripts/menu-motion.mjs dragon-purple   only these
 *
 * Each clip's colours are matched to the painting's (a video model shifts
 * them a little), so a piece fades in and out over the still unseen. A
 * looping piece is closed on itself with a one-second crossfade. Needs ffmpeg.
 * Re-run whenever a take or the table changes; nothing it writes is edited by hand.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const TAKES = join(root, 'designs/art/motion')
const OUT = join(root, 'apps/web/src/assets/motion')
mkdirSync(OUT, { recursive: true })
const table = JSON.parse(readFileSync(join(root, 'apps/web/src/art/menu-motion.json'), 'utf8'))
const { width: W, height: H } = table.scene

/** How far a soft edge fades, in px. */
const FEATHER = 14
/** How long a loop's two ends are blended, in s, unless its piece says otherwise. */
const CROSSFADE = 1

const work = mkdtempSync(join(tmpdir(), 'menu-motion-'))
const ffmpeg = (args, cwd = work) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
/** A take's frames, put back where they belong in the scene: the part it shows, at the scene's scale. */
const placed = (take) => {
  const [vx, vy, vw, vh] = table.takes[take].view
  return `fps=24,scale=${vw}:${vh}:flags=lanczos,pad=${W}:${H}:${vx}:${vy}`
}

// the painting, cropped to the scene the takes were made from
const still = await sharp(join(root, 'designs/art/bg-no-logo.png'))
  .extract({ left: 0, top: 0, width: W, height: H })
  .removeAlpha()
  .raw()
  .toBuffer()

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Falling water is pale cyan: bluer than red, not greener than blue, and light (as the shader had it). */
function watery(r, g, b) {
  return smooth(0.04, 0.14, b - r) * smooth(0.35, 0.6, (r + g + b) / 3) * smooth(-0.25, -0.05, b - g)
}

/** The water in a piece's rectangle, 0 to 1, grown a little so the falls' edges are in. */
async function waterIn([x, y, w, h]) {
  const key = Buffer.alloc(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = ((y + j) * W + (x + i)) * 3
      key[j * w + i] = Math.round(255 * watery(still[p] / 255, still[p + 1] / 255, still[p + 2] / 255))
    }
  }
  // grown by `erode`: in sharp it is the light that spreads (`dilate` shrinks it). And sharp hands back
  // three channels from one, so the first is kept.
  return sharp(key, { raw: { width: w, height: h, channels: 1 } }).erode(3).blur(2).extractChannel(0).raw().toBuffer()
}

/** The piece's mask, 0 to 255 per pixel of its rectangle: its shape, faded out before the edge of what its take shows. */
async function maskOf(piece) {
  const [x, y, w] = piece.rect
  const [vx, vy, vw, vh] = table.takes[piece.take].view
  const shape = await shapeOf(piece)
  return Buffer.from(
    shape.map((v, i) => {
      const px = x + (i % w)
      const py = y + Math.floor(i / w)
      // hard where the view meets the painting's own edge, soft where it stops short of it
      const inX = (vx > 0 ? smooth(vx, vx + FEATHER, px) : 1) * (vx + vw < W ? 1 - smooth(vx + vw - FEATHER, vx + vw, px) : 1)
      const inY = (vy > 0 ? smooth(vy, vy + FEATHER, py) : 1) * (vy + vh < H ? 1 - smooth(vy + vh - FEATHER, vy + vh, py) : 1)
      return Math.round(v * inX * inY)
    }),
  )
}

async function shapeOf(piece) {
  const [x, y, w, h] = piece.rect
  if (piece.mask === 'water') return waterIn(piece.rect)

  let shape
  if (piece.mask === 'rect') {
    // soft inside the painting, hard where the rectangle meets the painting's own edge
    const left = x === 0 ? -FEATHER : 0
    const top = y === 0 ? -FEATHER : 0
    const right = x + w >= W ? w + FEATHER : w
    const bottom = y + h >= H ? h + FEATHER : h
    shape = Buffer.alloc(w * h)
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const edge = Math.min(i - left, right - i, j - top, bottom - j)
        shape[j * w + i] = Math.round(255 * smooth(0, FEATHER, edge))
      }
    }
  } else {
    // a polygon cut along a frame in the painting: drawn, then softened a little
    const points = piece.mask.map(([px, py]) => `${px - x},${py - y}`).join(' ')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="black"/><polygon points="${points}" fill="white"/></svg>`
    shape = await sharp(Buffer.from(svg)).greyscale().blur(3).extractChannel(0).raw().toBuffer()
  }
  // where a water loop runs under everything, a piece leaves the falls to it, so they never stop
  if (!table.pieces.some((other) => other.mask === 'water')) return shape
  const water = await waterIn(piece.rect)
  return Buffer.from(shape.map((v, i) => Math.round((v * (255 - water[i])) / 255)))
}

/** Per channel, the curve that takes the clip's first frame to the painting's colours, as a 3D LUT. */
function cubeFor(piece, mask, frame) {
  const [x, y, w, h] = piece.rect
  const counts = [0, 1, 2].map(() => ({ clip: new Float64Array(256), paint: new Float64Array(256) }))
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (mask[j * w + i] < 128) continue
      const p = ((y + j) * W + (x + i)) * 3
      for (let c = 0; c < 3; c++) {
        counts[c].clip[frame[p + c]]++
        counts[c].paint[still[p + c]]++
      }
    }
  }
  const curves = counts.map(({ clip, paint }) => {
    const cdf = (hist) => {
      const total = hist.reduce((a, b) => a + b, 0) || 1
      let sum = 0
      return Array.from(hist, (v) => (sum += v) / total)
    }
    const from = cdf(clip)
    const to = cdf(paint)
    let k = 0
    return from.map((level) => {
      while (k < 255 && to[k] < level) k++
      return k / 255
    })
  })
  const N = 33
  const lines = [`LUT_3D_SIZE ${N}`]
  // .cube: red varies fastest
  for (let b = 0; b < N; b++) {
    for (let g = 0; g < N; g++) {
      for (let r = 0; r < N; r++) {
        const at = (v) => Math.round((v / (N - 1)) * 255)
        lines.push(`${curves[0][at(r)].toFixed(5)} ${curves[1][at(g)].toFixed(5)} ${curves[2][at(b)].toFixed(5)}`)
      }
    }
  }
  return lines.join('\n')
}

const firstFrames = {}
async function firstFrame(take) {
  if (!firstFrames[take]) {
    ffmpeg(['-i', join(TAKES, table.takes[take].file), '-vf', placed(take), '-frames:v', '1', `first-${take}.png`])
    firstFrames[take] = await sharp(join(work, `first-${take}.png`)).removeAlpha().raw().toBuffer()
  }
  return firstFrames[take]
}

const wanted = process.argv.slice(2)
try {
  for (const piece of table.pieces) {
    if (wanted.length && !wanted.includes(piece.name)) continue
    const [x, y, w, h] = piece.rect
    const mask = await maskOf(piece)
    await sharp(Buffer.alloc(w * h * 4).map((_, i) => (i % 4 === 3 ? mask[i >> 2] : 255)), { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, `${piece.name}-mask.png`))

    writeFileSync(join(work, `${piece.name}.cube`), cubeFor(piece, mask, await firstFrame(piece.take)))
    const cut = `${placed(piece.take)},crop=${w}:${h}:${x}:${y},lut3d=${piece.name}.cube`
    const blend = piece.crossfade ?? CROSSFADE
    const filter =
      piece.loop && blend > 0
        ? // closed on itself: the end blends into the start, so the seam is a second of both
          `[0:v]${cut},split[a][b];[a]trim=${blend}:5,setpts=PTS-STARTPTS,fps=24[body];[b]trim=0:${blend},setpts=PTS-STARTPTS,fps=24[head];[body][head]xfade=transition=fade:duration=${blend}:offset=${5 - 2 * blend}[v]`
        : // a take that ends on the frame it began with loops as it is
          `[0:v]${cut}[v]`
    const file = join(OUT, `${piece.name}.mp4`)
    ffmpeg([
      '-i', join(TAKES, table.takes[piece.take].file),
      '-filter_complex', filter, '-map', '[v]', '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      file,
    ])
    console.log(`  ${piece.name}.mp4  ${(statSync(file).size / 1024).toFixed(0)} KB`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
