import { describe, expect, it } from 'vitest'
import { EMPTY_TRIP, loadTrip, normalizeTrip, saveTrip, tripKeyFor } from './store'

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

describe('trip store', () => {
  it('starts empty and keeps people apart', () => {
    const s = memory()
    expect(loadTrip('a', s)).toEqual(EMPTY_TRIP)
    const mine = normalizeTrip({ journey: { carryOn: ['documents'] } })
    expect(saveTrip('a', mine, s)).toBe(true)
    expect(loadTrip('a', s).journey.carryOn).toEqual(['documents'])
    expect(loadTrip('b', s)).toEqual(EMPTY_TRIP)
    expect(tripKeyFor('a')).not.toBe(tripKeyFor('b'))
  })
  it('survives corrupt storage', () => {
    expect(loadTrip('a', { getItem: () => '{not json' })).toEqual(EMPTY_TRIP)
  })
})
