import { describe, expect, it } from 'vitest'
import { clearTiers, freeShare, readTiers, recordTier, TIERS_KEY } from './stanleyTiers'

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
