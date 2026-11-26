/**
 * Has the menu's painting acted out by a video model on fal.ai: the painting
 * goes in as the first and the last frame, so a clip starts and ends on the
 * still picture and can be laid over it, piece by piece, with no jump.
 *
 *   node apps/web/scripts/motion.mjs veo seedance      generate with these (costs money, see MODELS)
 *   node apps/web/scripts/motion.mjs --dry veo         only write the frames it would send
 *   node apps/web/scripts/motion.mjs --takes=3 seedance  three takes of one, each from its own seed
 *
 * Needs FAL_KEY in the environment. Each take lands in designs/art/motion/ as
 * scene-<when>-<model>.mp4, with the frame and the prompt beside it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = join(root, 'designs/art/motion')
mkdirSync(OUT, { recursive: true })
const PAINTING = join(root, 'designs/art/bg-no-logo.png')

/** The part of the painting sent: the whole width, down past the arena. The green panel below never moves. */
export const SCENE_CROP = { left: 0, top: 0, width: 1024, height: 1088 }
/** For a model that takes only 9:16: the whole painting, its top and bottom mirrored out to that shape. */
export const TALL_PAD = { top: 142, bottom: 143 }

// the first Seedance take (2026-11-26T14-31-43) came from the prompt saved beside it; this one asks the
// purple dragon to look at her cards with eyes like the others', and each banner to move its own way
const PROMPT = [
  'Static locked-off camera, no zoom, no pan. A living painting with natural motion.',
  'All the waterfalls flow continuously, water falling and mist rising.',
  'A breeze blows, and each red banner moves in its own way and rhythm: the big one on the cliff snaps hard in a gust, the small one beside it sways gently, the two over the arena flutter out of step with each other.',
  'Top left, the red armored dragon breathes a short burst of fire into the sky, then closes his mouth; the wind ruffles his scales.',
  'Top right, the blue dragon with glasses reads and blinks quickly.',
  'Bottom left, the purple dragon laughs, tilts her head down and looks at the cards in her hands, chuckling, then looks up laughing again. When her eyes open they are amber dragon eyes with slit pupils, like the eyes of the other dragons.',
  'On the right, the green dragon blinks quickly and the wind ripples through his scales and the leaves around him.',
  "Blinks are quick and natural, like a person's. Every character stays in place.",
].join(' ')

const NEGATIVE = 'camera movement, zoom, pan, shake, morphing, melting faces, distortion, blur, new characters, new objects, text, watermark, slow blinking'

/** Each model: what it is sent (`frame`), and its request. Prices from fal's model pages, 2026-11-26. */
const MODELS = {
  // US$0.60: 6 s at US$0.10/s, no sound
  veo: {
    id: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    frame: 'tall',
    body: (image) => ({
      prompt: PROMPT,
      negative_prompt: NEGATIVE,
      first_frame_url: image,
      last_frame_url: image,
      aspect_ratio: '9:16',
      duration: '6s',
      resolution: '720p',
      generate_audio: false,
    }),
  },
  // ~US$0.20: 5 s at 720p, billed by its tokens
  seedance: {
    id: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    frame: 'scene',
    body: (image, seed) => ({
      prompt: PROMPT,
      image_url: image,
      end_image_url: image,
      resolution: '720p',
      duration: '5',
      camera_fixed: true,
      seed,
    }),
  },
  // US$0.48: 6 s at US$0.08/s
  hailuo: {
    id: 'fal-ai/minimax/hailuo-02/pro/image-to-video',
    frame: 'scene',
    body: (image) => ({ prompt: PROMPT, image_url: image, end_image_url: image, prompt_optimizer: false }),
  },
  // US$0.40: 81 frames at 16 fps (5 s) at 720p
  wan: {
    id: 'fal-ai/wan/v2.2-a14b/image-to-video',
    frame: 'scene',
    body: (image) => ({
      prompt: PROMPT,
      negative_prompt: NEGATIVE,
      image_url: image,
      end_image_url: image,
      resolution: '720p',
      num_frames: 81,
    }),
  },
  // US$0.56: 5 s at US$0.112/s, no sound
  kling: {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    frame: 'scene',
    body: (image) => ({
      prompt: PROMPT,
      negative_prompt: NEGATIVE,
      start_image_url: image,
      end_image_url: image,
      duration: '5',
      generate_audio: false,
    }),
  },
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const wanted = args.filter((arg) => !arg.startsWith('--'))
const takes = Number(args.find((arg) => arg.startsWith('--takes='))?.split('=')[1] ?? 1)
for (const name of wanted) if (!MODELS[name]) throw new Error(`unknown model ${name}: ${Object.keys(MODELS).join(', ')}`)
if (wanted.length === 0) throw new Error(`name the models to run: ${Object.keys(MODELS).join(', ')}`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const frames = {
  scene: await sharp(PAINTING).extract(SCENE_CROP).jpeg({ quality: 94 }).toBuffer(),
  tall: await sharp(PAINTING).extend({ ...TALL_PAD, extendWith: 'mirror' }).jpeg({ quality: 94 }).toBuffer(),
}
for (const [kind, frame] of Object.entries(frames)) writeFileSync(join(OUT, `scene-${stamp}-frame-${kind}.jpg`), frame)
writeFileSync(join(OUT, `scene-${stamp}-prompt.txt`), `${PROMPT}\n\nnegative: ${NEGATIVE}\n`)
if (dry) {
  console.log(`frames and prompt written to designs/art/motion/scene-${stamp}-*`)
  process.exit(0)
}

const key = process.env.FAL_KEY
if (!key) throw new Error('FAL_KEY is not set')
const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }

async function run(name, take) {
  const model = MODELS[name]
  const image = `data:image/jpeg;base64,${frames[model.frame].toString('base64')}`
  // a seed of its own for each take, named in the file, so a good one can be made again
  const seed = Math.floor(Math.random() * 2 ** 31)
  const label = takes > 1 ? `${name}-${take + 1}-seed${seed}` : name
  const submitted = await fetch(`https://queue.fal.run/${model.id}`, { method: 'POST', headers, body: JSON.stringify(model.body(image, seed)) })
  if (!submitted.ok) throw new Error(`${name} submit: ${submitted.status} ${await submitted.text()}`)
  const { request_id: id, status_url: statusUrl, response_url: responseUrl } = await submitted.json()
  console.log(`${name}: queued ${id}`)
  const began = Date.now()
  for (;;) {
    await new Promise((done) => setTimeout(done, 5000))
    const status = await (await fetch(statusUrl, { headers })).json()
    if (status.status === 'COMPLETED') break
    if (status.status !== 'IN_QUEUE' && status.status !== 'IN_PROGRESS') throw new Error(`${name}: ${JSON.stringify(status)}`)
  }
  const result = await (await fetch(responseUrl, { headers })).json()
  const url = result?.video?.url
  if (!url) throw new Error(`${name}: no video in ${JSON.stringify(result).slice(0, 500)}`)
  const video = Buffer.from(await (await fetch(url)).arrayBuffer())
  const file = `scene-${stamp}-${label}.mp4`
  writeFileSync(join(OUT, file), video)
  console.log(`${name}: saved designs/art/motion/${file} (${(video.length / 1024).toFixed(0)} KB, ${((Date.now() - began) / 1000).toFixed(0)} s)`)
}

const results = await Promise.allSettled(wanted.flatMap((name) => Array.from({ length: takes }, (_, take) => run(name, take))))
for (const result of results) if (result.status === 'rejected') console.error(String(result.reason))
