// Guard rail for phase X0 (docs/catalogue-plan.md). The app was built around one ship and one route; the catalogue
// work removes that. This test counts the remaining single-route references in non-test source and fails when the
// count goes UP. Each X0 phase lowers a ceiling; the cleanup phase set most to zero. Never raise a ceiling.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.includes('/testing/') ? [p] : []
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

// Baseline recorded 2026-11-03 at the start of X0 (X0a); lowered in X0d.
const CEILINGS: Record<string, { re: RegExp; files: number; hits: number }> = {
  'SHIP singleton': { re: /\bSHIP\b/g, files: 0, hits: 0 },
  'CRUISE constant': { re: /\bCRUISE\b/g, files: 0, hits: 0 },
  'REFERENCE_SAILING': { re: /\bREFERENCE_SAILING\b/g, files: 3, hits: 8 },
  'SHIP_HOME_ZONE': { re: /\bSHIP_HOME_ZONE\b/g, files: 0, hits: 0 },
  'SHIP_WEST_ZONE': { re: /\bSHIP_WEST_ZONE\b/g, files: 0, hits: 0 },
  // `sea` is the id of a day at sea on every route, so it is not counted; `src/testing` is not counted. The sample week's port content is served
  // (`ashore`, photo spots, call-port phrases), so no source file names a port.
  'literal port ids': { re: /['"](cozumel|belize|roatan|fll)['"]/g, files: 0, hits: 0 },
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
