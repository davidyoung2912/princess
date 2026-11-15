// Usage: node fill.mjs  — for each candidate in fills/candidates.json, OCR a small crop at the expected spot and keep it only if it reads exactly the expected cabin number.
import sharp from 'sharp'
import { createWorker, PSM } from 'tesseract.js'
import { readFileSync, writeFileSync } from 'node:fs'
const cands = JSON.parse(readFileSync('fills/candidates.json', 'utf8'))
const SCALE = 8
const worker = await createWorker('eng')
const results = []
let lastMode = ''
for (const c of cands) {
  const img = `/home/david/projects/princess/public/deckplans/${c.ship}/deck-${c.deck}.gif`
  const meta = await sharp(img).metadata()
  const mode = c.ship === 'sun' ? 'digits' : 'letters'
  if (mode !== lastMode) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: mode === 'letters' ? '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ' : '0123456789', user_defined_dpi: '300' })
    lastMode = mode
  }
  let hit = null
  for (const rot of [0, 90, 270]) {
    if (hit) break
    const cw = rot === 0 ? 90 : 44, ch = rot === 0 ? 100 : 110
    const left = Math.max(0, Math.min(meta.width - cw, Math.round(c.x - cw / 2)))
    const top = Math.max(0, Math.min(meta.height - ch, Math.round(c.y - ch / 2)))
    for (const thr of [110, 140, 85]) {
      if (hit) break
      let p = sharp(img).extract({ left, top, width: cw, height: ch })
      if (rot) p = sharp(await p.rotate(rot).png().toBuffer())
      const rw = rot ? ch : cw, rh = rot ? cw : ch
      const buf = await p.resize(rw * SCALE, rh * SCALE, { kernel: 'lanczos3' }).greyscale().threshold(thr).extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' }).png().toBuffer()
      const { data } = await worker.recognize(buf, {}, { blocks: true })
      for (const b of data.blocks ?? []) for (const pg of b.paragraphs) for (const l of pg.lines) for (const w of l.words) {
        if (!w.text.includes(c.cabin)) continue
        const rx = ((w.bbox.x0 + w.bbox.x1) / 2 - 20) / SCALE, ry = ((w.bbox.y0 + w.bbox.y1) / 2 - 20) / SCALE
        let ox, oy
        if (rot === 0) { ox = rx; oy = ry } else if (rot === 90) { ox = ry; oy = ch - rx } else { ox = cw - ry; oy = rx }
        hit = { x: Math.round((left + ox) * 10) / 10, y: Math.round((top + oy) * 10) / 10, rot, thr }
      }
    }
  }
  if (hit) results.push({ ship: c.ship, deck: c.deck, cabin: c.cabin, ...hit, why: c.why })
}
await worker.terminate()
writeFileSync('fills/found.json', JSON.stringify(results))
console.log(results.length, 'of', cands.length, 'confirmed')
