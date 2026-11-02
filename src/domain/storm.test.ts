import { describe, expect, it } from 'vitest'
import { bandFor, MONTH_CHANCE, phaseFor, stormWatch } from './storm'

const sailing = (departure: string) => ({ id: departure, departure })

describe('storm watch (S3-04)', () => {
  it('has no chance outside the season', () => {
    const r = stormWatch(sailing('2027-03-21'), 100)
    expect(r).toMatchObject({ band: 'none', percent: 0, inSeason: false, lineMay: [], youCan: [] })
  })
  it('is higher in September and marked as worked out', () => {
    const r = stormWatch(sailing('2027-09-12'), 100)
    expect(r.source).toBe('sim')
    expect(r.band).toBe('higher')
    expect(r.peak).toBe(true)
    expect(r.lineMay.length).toBeGreaterThan(0)
    expect(r.youCan).toContain('insurance')
  })
  it('uses the worse month when a sailing crosses a month end', () => {
    expect(stormWatch(sailing('2027-08-29'), 100).percent).toBe(MONTH_CHANCE[8])
    expect(stormWatch(sailing('2027-11-28'), 100).inSeason).toBe(true)
  })
  it('keeps the bands and phases in order', () => {
    expect([0, 2, 8, 15].map(bandFor)).toEqual(['none', 'low', 'some', 'higher'])
    expect([40, 10, 2, 0].map(phaseFor)).toEqual(['far', 'watch', 'near', 'sailing'])
  })
  it('never claims a storm is on the way', () => {
    const src = JSON.stringify(stormWatch(sailing('2027-09-12'), 3))
    expect(src).not.toMatch(/is coming|will hit|warning/i)
  })
})
