// Usage: node ocr2.mjs <image> <out.json> <digits|letters>
// OCRs cabin-number text in three passes (upright, rotated 90 clockwise, rotated 90 counter-clockwise), in 300px tiles at 3x,
// and writes word boxes mapped back to the original image's pixel coordinates.
import sharp from 'sharp'
import { createWorker, PSM } from 'tesseract.js'
import { writeFileSync } from 'node:fs'
const [, , input, output, mode] = process.argv
const SCALE = 3, TILE = 300, OVERLAP = 40
const whitelist = mode === 'letters' ? '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ' : '0123456789'
const meta = await sharp(input).metadata()
const W = meta.width, H = meta.height
const worker = await createWorker('eng')
await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: whitelist, user_defined_dpi: '300' })
const words = []

async function pass(rot) {
  const base = rot === 0 ? sharp(input) : sharp(await sharp(input).rotate(rot).png().toBuffer())
  const rw = rot === 0 ? W : H, rh = rot === 0 ? H : W
  const tall = rh >= rw
  const long = tall ? rh : rw
  for (let start = 0; start < long; start += TILE - OVERLAP) {
    const len = Math.min(TILE, long - start)
    const region = tall ? { left: 0, top: start, width: rw, height: len } : { left: start, top: 0, width: len, height: rh }
    const buf = await base.clone().extract(region).resize(region.width * SCALE, region.height * SCALE, { kernel: 'lanczos3' }).greyscale().threshold(Number(process.env.THRESH ?? 110)).png().toBuffer()
    const { data } = await worker.recognize(buf, {}, { blocks: true })
    for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) {
      const x0 = region.left + w.bbox.x0 / SCALE, x1 = region.left + w.bbox.x1 / SCALE
      const y0 = region.top + w.bbox.y0 / SCALE, y1 = region.top + w.bbox.y1 / SCALE
      // map rotated coordinates back to the original image
      let ox0, ox1, oy0, oy1
      if (rot === 0) { ox0 = x0; ox1 = x1; oy0 = y0; oy1 = y1 }
      else if (rot === 90) { ox0 = y0; ox1 = y1; oy0 = H - x1; oy1 = H - x0 }
      else { ox0 = W - y1; ox1 = W - y0; oy0 = x0; oy1 = x1 }
      words.push({ text: w.text, conf: Math.round(w.confidence), rot, x0: ox0, y0: oy0, x1: ox1, y1: oy1 })
    }
    if (start + len >= long) break
  }
}
for (const rot of [0, 90, 270]) await pass(rot)
await worker.terminate()
writeFileSync(output, JSON.stringify({ width: W, height: H, words }))
console.log(output, words.length)
