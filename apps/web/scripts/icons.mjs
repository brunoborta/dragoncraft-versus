/**
 * Turns the two icon sheets in `designs/art/` into SVG paths the game draws:
 * finds each icon on its sheet, traces it to curves and writes them, scaled
 * into the box their component draws in, to `src/art/icon-paths.ts`.
 *
 *   node apps/web/scripts/icons.mjs
 *
 * Traced rather than shipped as images: the tokens and the HUD draw icons at
 * every size from 14 to 120 pixels, in `currentColor` or a colour of their own,
 * and a path stays sharp and takes any fill. Re-run it whenever a sheet
 * changes; the generated file is never edited by hand.
 *
 * Each sheet is a grid of light silhouettes on black. The icons are found by
 * the gaps between them, not by a fixed grid, so a sheet with uneven spacing
 * still cuts cleanly. The names below are in reading order: left to right,
 * then top to bottom.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import potrace from 'potrace'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(root, 'designs/art')
const OUT = join(root, 'apps/web/src/art/icon-paths.ts')

const SHEETS = {
  ui: {
    file: 'icons-ui.png',
    names: ['cards', 'star', 'scroll', 'undo', 'eye', 'chevrons', 'lock', 'flame', 'hourglass', 'gear'],
    // a 24-unit box, the icon's longer side 21 units, centred on (12, 12)
    box: { size: 21, cx: 12, cy: 12, decimals: 2 },
  },
  tokens: {
    file: 'icons-tokens.png',
    names: ['crystal', 'bread', 'meat', 'iron', 'potion', 'plant'],
    // the token face's [-1, 1] box, the icon's longer side 1.8, centred on 0
    box: { size: 1.8, cx: 0, cy: 0, decimals: 3 },
  },
}

/** A pixel brighter than this is ink. */
const INK = 110
/** Ink closer than this, in source pixels, belongs to the same icon. */
const JOIN = 40
/** Traced at this many times the source size, for smoother curves. */
const UPSCALE = 2

/** Runs of indices where `has(i)` is true, gaps shorter than JOIN bridged. */
function runs(length, has) {
  const found = []
  let start = -1
  let last = -1
  for (let i = 0; i < length; i++) {
    if (!has(i)) continue
    if (start < 0) start = i
    else if (i - last > JOIN) {
      found.push([start, last])
      start = i
    }
    last = i
  }
  if (start >= 0) found.push([start, last])
  return found
}

/** The bounding boxes of the icons on a sheet, in reading order. */
async function findIcons(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const ink = (x, y) => data[y * width + x] > INK
  const rowHas = (y0, y1) => (x) => {
    for (let y = y0; y <= y1; y++) if (ink(x, y)) return true
    return false
  }
  const colHas = (x0, x1) => (y) => {
    for (let x = x0; x <= x1; x++) if (ink(x, y)) return true
    return false
  }
  const boxes = []
  for (const [y0, y1] of runs(height, colHas(0, width - 1))) {
    for (const [x0, x1] of runs(width, rowHas(y0, y1))) {
      // the row band is as tall as its tallest icon: tighten to this one
      const [[top, bottom]] = runs(y1 - y0 + 1, (i) => colHas(x0, x1)(y0 + i)).map(([a, b]) => [y0 + a, y0 + b])
      boxes.push({ left: x0, top, width: x1 - x0 + 1, height: bottom - top + 1 })
    }
  }
  return boxes
}

function trace(buffer) {
  return new Promise((done, fail) => {
    const tracer = new potrace.Potrace({ threshold: 128, blackOnWhite: false, turdSize: 12, optTolerance: 0.3, alphaMax: 1 })
    tracer.loadImage(buffer, (error) => {
      if (error) return fail(error)
      const d = /\sd="([^"]+)"/.exec(tracer.getPathTag())?.[1]
      if (!d) return fail(new Error('nothing traced'))
      done(d)
    })
  })
}

/**
 * Moves and scales a traced path. Potrace writes only absolute M, L and C
 * commands, so every pair of numbers is a point.
 */
function place(d, map, decimals) {
  if (/[a-z]/.test(d.replace(/e-?\d/g, ''))) throw new Error(`relative commands in a traced path: ${d.slice(0, 60)}`)
  const round = (n) => {
    const s = n.toFixed(decimals).replace(/\.?0+$/, '')
    return s === '-0' ? '0' : s
  }
  return d
    .replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g, (_, x, y) => {
      const [px, py] = map(Number(x), Number(y))
      return `${round(px)} ${round(py)}`
    })
    .replace(/\s+/g, ' ')
    .trim()
}

const MARGIN = 8

async function sheet({ file, names, box }) {
  const path = join(SRC, file)
  const found = await findIcons(path)
  if (found.length !== names.length) {
    throw new Error(`${file}: found ${found.length} icons, expected ${names.length} (${names.join(', ')})`)
  }
  const meta = await sharp(path).metadata()
  const paths = {}
  for (const [index, area] of found.entries()) {
    const left = Math.max(0, area.left - MARGIN)
    const top = Math.max(0, area.top - MARGIN)
    const width = Math.min(meta.width - left, area.width + MARGIN * 2)
    const height = Math.min(meta.height - top, area.height + MARGIN * 2)
    const crop = await sharp(path)
      .extract({ left, top, width, height })
      .greyscale()
      .resize(width * UPSCALE, height * UPSCALE, { kernel: 'lanczos3' })
      .png()
      .toBuffer()
    const d = await trace(crop)
    // the icon's own centre, in the upscaled crop
    const cx = (area.left - left + area.width / 2) * UPSCALE
    const cy = (area.top - top + area.height / 2) * UPSCALE
    const scale = box.size / (Math.max(area.width, area.height) * UPSCALE)
    paths[names[index]] = place(d, (x, y) => [(x - cx) * scale + box.cx, (y - cy) * scale + box.cy], box.decimals)
    console.log(`  ${names[index]}: ${area.width}x${area.height} px, ${paths[names[index]].length} chars`)
  }
  return paths
}

const result = {}
for (const [key, spec] of Object.entries(SHEETS)) {
  console.log(spec.file)
  result[key] = await sheet(spec)
}

const literal = (paths) =>
  Object.entries(paths)
    .map(([name, d]) => `  ${name}:\n    '${d}',`)
    .join('\n')

writeFileSync(
  OUT,
  `/**
 * Generated by \`apps/web/scripts/icons.mjs\` from \`designs/art/icons-ui.png\`
 * and \`designs/art/icons-tokens.png\`. Do not edit: change the sheet and re-run.
 *
 * Each is one path whose holes are subpaths of their own: draw it with
 * \`fill-rule="evenodd"\`.
 */

/** The HUD icons, in a 24-unit box. */
export const UI_ICON_PATHS = {
${literal(result.ui)}
} as const

/** The token icons, in the token face's [-1, 1] box. */
export const TOKEN_ICON_PATHS = {
${literal(result.tokens)}
} as const
`,
)
console.log(`wrote ${OUT}`)
