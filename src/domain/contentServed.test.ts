import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contentFileText, contentKeys, contentSnapshot, registerContent, setContent } from './content'
import { normalizeContent } from './contentServed'

describe('served content', () => {
  it('matches the file the server embeds (run npm run content:gen when this fails)', () => {
    const onDisk = readFileSync(new URL('../../server/Princess.Api/Content/reference-content.json', import.meta.url), 'utf8')
    expect(onDisk).toBe(contentFileText())
  })

  it('registers a useful number of lists and records, each non-empty and under its own module name', () => {
    const keys = contentKeys()
    expect(keys.length).toBeGreaterThanOrEqual(90)
    expect(keys).toContain('help.FAQS')
    expect(keys).toContain('services.REQUEST_ITEMS')
    expect(keys).toContain('policy.LEGAL')
    expect(keys.every((k) => /^[a-zA-Z]+\.[A-Z][A-Z0-9_]*$/.test(k))).toBe(true)
  })

  it('replaces a list or record in place, so earlier imports see the new values', () => {
    const list = ['a', 'b']
    const rec: Record<string, number> = { x: 1 }
    registerContent('testing', { LIST: list, REC: rec })
    expect(setContent({ 'testing.LIST': ['c'], 'testing.REC': { y: 2 }, 'testing.NONE': [1] })).toBe(2)
    expect(list).toEqual(['c'])
    expect(rec).toEqual({ y: 2 })
    expect(setContent({ 'testing.LIST': { not: 'a list' }, 'testing.REC': [1] })).toBe(0)
    expect(list).toEqual(['c'])
    expect(contentSnapshot()['testing.LIST']).toEqual(['c'])
  })

  it('skips a frozen target and keeps its authored value', () => {
    const frozen = Object.freeze(['k'])
    registerContent('testing', { FROZEN: frozen as unknown as object })
    expect(setContent({ 'testing.FROZEN': ['z'] })).toBe(0)
    expect(frozen).toEqual(['k'])
  })

  it('reads the server answer all-or-nothing', () => {
    expect(normalizeContent({ version: 'v1', values: { 'help.FAQS': [], 'policy.table': {} } })).toBeNull()
    expect(normalizeContent({ version: 'v1', values: { 'help.FAQS': [], 'policy.LEGAL_ROWS': { a: 1 } } })?.version).toBe('v1')
    expect(normalizeContent({ version: 'v1', values: { 'help.FAQS': 'text' } })).toBeNull()
    expect(normalizeContent({ values: {} })).toBeNull()
    expect(normalizeContent({ version: 'v1', values: { bad: [] } })).toBeNull()
  })
})
