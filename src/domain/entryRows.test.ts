// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countryOfPort } from './prepareDelights'

const root = new URL('../../', import.meta.url)
const read = (p: string): string => readFileSync(new URL(p, root), 'utf8')

describe('per-country entry rows', () => {
  const served = new Set([...read('server/Princess.Api/Domain/ReferenceRules.cs').matchAll(/new\("([A-Z]{2})", (\d+), (\d+), (true|false)\)/g)].map((m) => m[1]!))
  const catalogue = new Set([...read('db/seed/catalogue/generated/catalogue.sql').matchAll(/N'([A-Z]{2})'/g)].map((m) => m[1]!))

  it('serves a row for every country code the catalogue holds', () => {
    expect(served.size).toBeGreaterThan(30)
    // Codes that are not countries of a port (for example region or language codes) are not in the table; list any gap so a new country cannot be forgotten.
    const missing = [...catalogue].filter((c) => !served.has(c))
    expect(missing).toEqual([])
  })
  it('maps the older route ports to their countries', () => {
    expect(['fll', 'cozumel', 'belize', 'roatan'].map(countryOfPort)).toEqual(['US', 'MX', 'BZ', 'HN'])
  })
})
