import { describe, expect, it } from 'vitest'
import { cabinsFor } from './cabins'
import { cabinsNeeded, deckMaps, nearbyGroups, recheck } from './cabinMap'
import { REFERENCE_SAILING as S } from './sailings'

const cabins = cabinsFor(S.id, 'balcony')

describe('DSC-05 cabin map', () => {
  it('places every stateroom exactly once, by deck, side and part of the ship', () => {
    const placed = deckMaps(cabins).flatMap((d) => d.rows.flatMap((r) => r.cells.flatMap((c) => c.cabins)))
    expect(placed.map((c) => c.number).sort()).toEqual(cabins.map((c) => c.number).sort())
  })
  it('rechecks inventory: free, taken or gone', () => {
    const free = cabins.find((c) => c.available)!
    expect(recheck(cabins, free.number)).toBe('free')
    expect(recheck(cabins.map((c) => (c.number === free.number ? { ...c, available: false } : c)), free.number)).toBe('taken')
    expect(recheck([], free.number)).toBe('gone')
  })
})

describe('DSC-12 nearby cabins', () => {
  it('needs one room per room-load of guests', () => {
    expect(cabinsNeeded(2, 4)).toBe(1)
    expect(cabinsNeeded(5, 4)).toBe(2)
  })
  it('offers only free staterooms on one deck within one part of the ship, and none for one room', () => {
    expect(nearbyGroups(cabins, 1)).toEqual([])
    for (const g of nearbyGroups(cabins, 2)) {
      expect(new Set(g.map((c) => c.deck)).size).toBe(1)
      expect(g.every((c) => c.available)).toBe(true)
    }
  })
  it('finds a group when two free staterooms sit together', () => {
    const base = cabins[0]
    const two = [{ ...base, number: 'a', available: true, position: 'forward' as const }, { ...base, number: 'b', available: true, position: 'midship' as const }, { ...base, number: 'c', available: true, position: 'aft' as const }]
    expect(nearbyGroups(two, 2).map((g) => g.map((c) => c.number))).toEqual([['a', 'b'], ['b', 'c']])
    expect(nearbyGroups(two, 3)).toEqual([])
  })
})
