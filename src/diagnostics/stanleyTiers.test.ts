import { describe, expect, it } from 'vitest'
import { ASKED_KEY, clearAsked, clearTiers, freeShare, MAX_ASKED, modelShare, readAsked, readTiers, recordAsked, recordTier, repeated, tierMix, TIERS_KEY } from './stanleyTiers'

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }

describe('stanley tiers', () => {
  it('counts each source and works out the free share', () => {
    const s = memory()
    for (const t of ['library', 'library', 'ship', 'model'] as const) recordTier(s, t)
    recordTier(s, 'handoff')
    expect(readTiers(s)).toMatchObject({ library: 2, ship: 1, model: 1, handoff: 1, trip: 0 })
    expect(freeShare(readTiers(s))).toBe(75)
  })
  it('has no share before anything is answered, and clears', () => {
    const s = memory()
    expect(freeShare(readTiers(s))).toBeNull()
    recordTier(s, 'trip'); clearTiers(s)
    expect(s.getItem(TIERS_KEY)).toBeNull()
  })
  it('survives unreadable storage and a missing store', () => {
    const s = memory(); s.setItem(TIERS_KEY, '{nope')
    expect(readTiers(s).library).toBe(0)
    expect(() => recordTier(null, 'model')).not.toThrow()
  })
  it('keeps only counts, never words', () => {
    const s = memory(); recordTier(s, 'library')
    expect(s.getItem(TIERS_KEY)).not.toMatch(/[a-z]+ [a-z]+/)
  })
})

describe('tier mix and repeat questions', () => {
  it('works out each tier\'s share of all replies and the share that needed a model call', () => {
    const s = memory()
    for (const t of ['library', 'library', 'ship', 'model', 'handoff'] as const) recordTier(s, t)
    const mix = tierMix(readTiers(s))
    expect(mix.find((m) => m.tier === 'library')).toEqual({ tier: 'library', count: 2, percent: 40 })
    expect(mix.reduce((n, m) => n + m.percent, 0)).toBe(100)
    expect(modelShare(readTiers(s))).toBe(25)
    expect(tierMix(readTiers(memory())).every((m) => m.percent === 0)).toBe(true)
    expect(modelShare(readTiers(memory()))).toBeNull()
  })

  it('counts how often each written answer is given and lists those given more than once, most often first', () => {
    const s = memory()
    for (const id of ['library:port.tender', 'library:book.cancel', 'library:port.tender', 'ship:speed', 'library:book.cancel', 'library:port.tender']) recordAsked(s, id)
    expect(readAsked(s)).toEqual({ 'library:port.tender': 3, 'library:book.cancel': 2, 'ship:speed': 1 })
    expect(repeated(readAsked(s))).toEqual([{ id: 'library:port.tender', count: 3 }, { id: 'library:book.cancel', count: 2 }])
    expect(repeated(readAsked(s), 1)).toHaveLength(1)
    clearAsked(s)
    expect(s.getItem(ASKED_KEY)).toBeNull()
  })

  it('keeps only ids from the closed set, never words a guest typed', () => {
    const s = memory()
    recordAsked(s, 'What is my passport number?')
    recordAsked(s, 'library:ok.id')
    recordAsked(null, 'library:ok.id')
    expect(Object.keys(readAsked(s))).toEqual(['library:ok.id'])
    s.setItem(ASKED_KEY, JSON.stringify({ 'hello there': 4, 'library:a.b': 2, 'library:c.d': -1 }))
    expect(readAsked(s)).toEqual({ 'library:a.b': 2 })
    s.setItem(ASKED_KEY, '{nope')
    expect(readAsked(s)).toEqual({})
  })

  it('keeps the most asked when there are too many ids', () => {
    const s = memory()
    s.setItem(ASKED_KEY, JSON.stringify(Object.fromEntries(Array.from({ length: MAX_ASKED }, (_, i) => [`library:x.${i}`, 5]))))
    recordAsked(s, 'library:new.one')
    recordAsked(s, 'library:new.one')
    expect(Object.keys(readAsked(s))).toHaveLength(MAX_ASKED)
  })
})
