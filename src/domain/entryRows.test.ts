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
  it('gives every served row an official https link and the sample date', () => {
    const cs = read('server/Princess.Api/Domain/ReferenceRules.cs')
    const sources = new Map([...cs.matchAll(/\["([A-Z]{2})"\] = (?:"(https:\/\/[^"\s]+)"|Schengen)/g)].map((m) => [m[1]!, m[2] ?? 'schengen'] as const))
    expect([...served].filter((c) => !sources.has(c))).toEqual([])
    expect(cs).toMatch(/EntryAsOf = "\d{4}-\d{2}-\d{2}"/)
  })
  it('maps the older route ports to their countries', () => {
    expect(['fll', 'cozumel', 'belize', 'roatan'].map(countryOfPort)).toEqual(['US', 'MX', 'BZ', 'HN'])
  })
})
