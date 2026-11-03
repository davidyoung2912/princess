// Guard rail for phase X0 (docs/catalogue-plan.md). The app was built around one ship and one route; the catalogue
// work removes that. This test counts the remaining single-route references in non-test source and fails when the
// count goes UP. Each X0 phase lowers a ceiling; X0h sets them all to zero. Never raise a ceiling.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : []
  })
}

const FILES = sources(join(process.cwd(), 'src')).map((p) => readFileSync(p, 'utf8'))

function count(re: RegExp) {
  let files = 0
  let hits = 0
  for (const text of FILES) {
    const n = text.match(re)?.length ?? 0
    if (n) { files++; hits += n }
  }
  return { files, hits }
}

// Baseline recorded 2026-11-03 at the start of X0 (X0a).
const CEILINGS: Record<string, { re: RegExp; files: number; hits: number }> = {
  'SHIP singleton': { re: /\bSHIP\b/g, files: 13, hits: 48 },
  'CRUISE constant': { re: /\bCRUISE\b/g, files: 5, hits: 19 },
  'REFERENCE_SAILING': { re: /\bREFERENCE_SAILING\b/g, files: 7, hits: 20 },
  'SHIP_HOME_ZONE': { re: /\bSHIP_HOME_ZONE\b/g, files: 3, hits: 15 },
  'SHIP_WEST_ZONE': { re: /\bSHIP_WEST_ZONE\b/g, files: 1, hits: 4 },
  'literal port ids': { re: /['"](cozumel|belize|roatan|fll|sea)['"]/g, files: 63, hits: 227 },
}

describe('single-route references (X0 guard rail)', () => {
  for (const [name, c] of Object.entries(CEILINGS)) {
    it(`${name} does not grow`, () => {
      const now = count(c.re)
      expect(now.files, `${name}: files`).toBeLessThanOrEqual(c.files)
      expect(now.hits, `${name}: hits`).toBeLessThanOrEqual(c.hits)
    })
  }
})
