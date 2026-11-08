// Turns the drawn originals in art/source into the small WebP files the app loads from src/assets/art.
// Run with `npm run art`; the output is committed. Heroes get a wide (1200) and a narrow (600) size, poses and heads one size each.
// Names are normalised (lower-case id, the spelling fixes in RENAME) so the code asks for art by id, never by file name.
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, parse } from 'node:path'
import sharp from 'sharp'

const SRC = 'art/source'
const OUT = 'src/assets/art'
const RENAME = { lifebouy: 'lifebuoy', suprised: 'surprised' }
const SETS = [
  { dir: 'heroes', out: 'heroes', sizes: [{ w: 1200, suffix: '' }, { w: 600, suffix: '-sm' }], quality: 72, budget: 105 * 1024 },
  { dir: 'poses', out: 'stanley', sizes: [{ w: 384, suffix: '' }], quality: 80, budget: 40 * 1024 },
  { dir: 'heads', out: 'heads', sizes: [{ w: 256, suffix: '' }], quality: 80, budget: 25 * 1024 },
]

let over = 0
for (const set of SETS) {
  mkdirSync(join(OUT, set.out), { recursive: true })
  for (const file of readdirSync(join(SRC, set.dir)).filter((f) => f.endsWith('.png')).sort()) {
    const base = parse(file).name
    const id = RENAME[base] ?? base
    for (const size of set.sizes) {
      const dest = join(OUT, set.out, `${id}${size.suffix}.webp`)
      await sharp(join(SRC, set.dir, file)).resize({ width: size.w }).webp({ quality: set.quality, alphaQuality: 80, effort: 6 }).toFile(dest)
      const bytes = statSync(dest).size
      const flag = bytes > set.budget ? '  OVER BUDGET' : ''
      if (flag) over++
      console.log(`${dest}  ${(bytes / 1024).toFixed(1)} KB${flag}`)
    }
  }
}
if (over) { console.error(`${over} file(s) over budget`); process.exitCode = 1 }
