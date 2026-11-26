/**
 * Has a piece of art edited by an image model on fal.ai (Nano Banana, about
 * US$0.04 an image): a crop of a source image goes in with an instruction, the
 * edited picture comes back at the crop's own size, beside the source.
 *
 *   node apps/web/scripts/edit.mjs <source.png> <left,top,width,height> <out.png> "<instruction>"
 *
 * Needs FAL_KEY in the environment. The crop is sent at twice its size, for
 * the model to see the detail, and the answer is brought back to the crop's.
 */
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const [source, crop, output, instruction] = process.argv.slice(2)
if (!instruction) throw new Error('usage: edit.mjs <source.png> <left,top,width,height> <out.png> "<instruction>"')
const [left, top, width, height] = crop.split(',').map(Number)

const key = process.env.FAL_KEY
if (!key) throw new Error('FAL_KEY is not set')
const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }

const sent = await sharp(source).extract({ left, top, width, height }).resize(width * 2, height * 2, { kernel: 'lanczos3' }).png().toBuffer()
const submitted = await fetch('https://queue.fal.run/fal-ai/nano-banana/edit', {
  method: 'POST',
  headers,
  body: JSON.stringify({ prompt: instruction, image_urls: [`data:image/png;base64,${sent.toString('base64')}`], output_format: 'png' }),
})
if (!submitted.ok) throw new Error(`submit: ${submitted.status} ${await submitted.text()}`)
const { status_url: statusUrl, response_url: responseUrl } = await submitted.json()
for (;;) {
  await new Promise((done) => setTimeout(done, 3000))
  const status = await (await fetch(statusUrl, { headers })).json()
  if (status.status === 'COMPLETED') break
  if (status.status !== 'IN_QUEUE' && status.status !== 'IN_PROGRESS') throw new Error(JSON.stringify(status))
}
const result = await (await fetch(responseUrl, { headers })).json()
const url = result?.images?.[0]?.url
if (!url) throw new Error(`no image in ${JSON.stringify(result).slice(0, 400)}`)
const image = Buffer.from(await (await fetch(url)).arrayBuffer())
const meta = await sharp(image).metadata()
await sharp(image).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(output)
writeFileSync(`${output}.txt`, `${instruction}\n\nsource ${source} at ${crop}; the model answered ${meta.width}x${meta.height}\n`)
console.log(`saved ${output} (the model answered ${meta.width}x${meta.height})`)
