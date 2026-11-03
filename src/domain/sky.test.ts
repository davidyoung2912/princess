import { describe, expect, it } from 'vitest'
import { bestSpot, type SkyNight } from './sky'

const NIGHT: SkyNight = { day: 2, port: 'sea', sunrise: '06:30', sunset: '18:40', sunsetAt: Date.parse('2027-03-23T23:40:00Z'), moon: { phase: 'full', name: 'Full moon', lit: 99 }, sunsetSide: 'port', sailAway: null, sailAwayAtSunset: false, stars: ['Orion'], darkSky: false, firstLight: '06:05', lastLight: '19:05', darkAt: '19:30' }

describe('sky guide (S6-07)', () => {
  it('does not claim a planet, and says when the moon will wash out the stars', () => {
    expect(JSON.stringify(NIGHT)).not.toMatch(/Venus|Mars|Jupiter|Saturn/)
    expect(bestSpot({ ...NIGHT, darkSky: false })).toMatch(/moon is bright/)
    expect(bestSpot({ ...NIGHT, darkSky: true })).toMatch(/darkest/)
  })
  it('names the side of the ship for the sunset, or either side when it is behind', () => {
    expect(bestSpot({ ...NIGHT, sunsetSide: 'starboard' })).toMatch(/starboard side/)
    expect(bestSpot({ ...NIGHT, sunsetSide: 'neither' })).toMatch(/either side/)
  })
})
