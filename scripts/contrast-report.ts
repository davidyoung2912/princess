// Prints the contrast ratio of every colour pair in every theme: `npm run contrast`. The same checks fail the test suite.
import { readFileSync } from 'node:fs'
import { PAIRS, contrastRatio, minFor } from '../src/design/contrast.ts'
import { CONTRAST_NAMES, THEME_NAMES, resolvePalette } from '../src/design/palettes.ts'

const css = readFileSync(new URL('../src/styles/themes.css', import.meta.url), 'utf8')

for (const theme of THEME_NAMES) {
  for (const contrast of CONTRAST_NAMES) {
    const palette = resolvePalette(css, theme, contrast)
    console.log(`\n${theme} / ${contrast} contrast`)
    for (const p of PAIRS) {
      const r = contrastRatio(palette[p.fg], palette[p.bg])
      const min = minFor(p, contrast === 'high')
      console.log(`  ${r < min ? 'FAIL' : 'ok  '} ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${p.name}`)
    }
  }
}
