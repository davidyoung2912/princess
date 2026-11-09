import { describe, expect, it } from 'vitest'
import { cutaway, shipLiteracy } from './shipLiteracy'

describe('shipLiteracy', () => {
  it('rejects anything that is not a cabin number', () => {
    expect(shipLiteracy('abc')).toBeNull()
    expect(shipLiteracy('12')).toBeNull()
  })
  it('gives decks and sections from the cabin to each destination', () => {
    const l = shipLiteracy('12045')!
    expect(l.cabin.deck).toBe(12)
    expect(l.nearBanks).toEqual(['A', 'B'])
    const gs = l.stops.find((s) => s.place.id === 'guest-services')!
    expect(gs.decksUp).toBe(-6)
    expect(gs.sectionsAft).toBe(0)
    expect(gs.reachable).toBe(true)
    expect(gs.banks.length).toBeGreaterThan(0)
  })
  it('shows toward the stern as positive', () => {
    const l = shipLiteracy('8400')!
    expect(l.stops.find((s) => s.place.id === 'eclipse')!.sectionsAft).toBe(0)
    expect(l.stops.find((s) => s.place.id === 'guest-services')!.sectionsAft).toBe(-2)
  })
  it('builds a cutaway from the top deck down with the cabin deck marked', () => {
    const c = cutaway(shipLiteracy('12045')!)
    expect(c[0].deck).toBeGreaterThan(c[c.length - 1].deck)
    expect(c.filter((d) => d.cabin).map((d) => d.deck)).toEqual([12])
    expect(c.find((d) => d.deck === 6)!.destinations).toContain('Guest Services')
  })
})
