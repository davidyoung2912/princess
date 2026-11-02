import { describe, expect, it } from 'vitest'
import { bestSpot, moonAt, skyNight, sunTimes } from './sky'
import { REFERENCE_SAILING } from './sailings'

describe('sky guide (S6-07)', () => {
  it('puts sunrise and sunset at believable times every day of the cruise', () => {
    for (let day = 1; day <= 8; day++) {
      const n = skyNight(REFERENCE_SAILING, day)
      expect(n.sunrise >= '05:30' && n.sunrise <= '08:15', `sunrise ${day} ${n.sunrise}`).toBe(true)
      expect(n.sunset >= '16:30' && n.sunset <= '20:15', `sunset ${day} ${n.sunset}`).toBe(true)
      expect(n.source).toBe('sim')
    }
  })

  it('has a longer day in June than in December', () => {
    const len = (d: string) => { const t = sunTimes(d, 20, -87); return t.sunset - t.sunrise }
    expect(len('2027-06-21')).toBeGreaterThan(len('2026-12-21'))
  })

  it('finds a full moon near the real one on 22 March 2027, and a new moon about two weeks on', () => {
    expect(moonAt(Date.UTC(2027, 2, 22, 12)).phase).toBe('full')
    expect(moonAt(Date.UTC(2027, 3, 5, 12)).phase).toBe('new')
  })

  it('does not claim a planet, and says when the moon will wash out the stars', () => {
    const n = skyNight(REFERENCE_SAILING, 2)
    expect(JSON.stringify(n)).not.toMatch(/Venus|Mars|Jupiter|Saturn/)
    expect(bestSpot({ ...n, darkSky: false })).toMatch(/moon is bright/)
    expect(bestSpot({ ...n, darkSky: true })).toMatch(/darkest/)
  })

  it('flags a sail-away that coincides with sunset only on days the ship leaves', () => {
    expect(skyNight(REFERENCE_SAILING, 2).sailAway).toBeNull()
    expect(skyNight(REFERENCE_SAILING, 3).sailAway).toBe('17:00')
  })
})
