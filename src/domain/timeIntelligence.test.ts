import { describe, expect, it } from 'vitest'
import { threeClocks, hoursBetween } from './clock'
import { addDays, dateIn, offsetMinutes, timeIn, zonedToEpoch } from './timezones'

const NY = 'America/New_York'
const CHI = 'America/Chicago'

describe('time intelligence: daylight saving', () => {
  it('a spring-forward day is 23 hours long', () => {
    const start = zonedToEpoch('2027-03-14', '00:00', NY)
    const next = zonedToEpoch('2027-03-15', '00:00', NY)
    expect((next - start) / 3_600_000).toBe(23)
  })

  it('a fall-back day is 25 hours long', () => {
    const start = zonedToEpoch('2027-11-07', '00:00', NY)
    const next = zonedToEpoch('2027-11-08', '00:00', NY)
    expect((next - start) / 3_600_000).toBe(25)
  })

  it('a time skipped by spring-forward lands just after the change', () => {
    const e = zonedToEpoch('2027-03-14', '02:30', NY)
    expect(timeIn(e, NY)).toBe('03:30')
    expect(dateIn(e, NY)).toBe('2027-03-14')
  })

  it('offsets change across the boundary', () => {
    expect(offsetMinutes(zonedToEpoch('2027-03-13', '12:00', NY), NY)).toBe(-300)
    expect(offsetMinutes(zonedToEpoch('2027-03-15', '12:00', NY), NY)).toBe(-240)
  })

  it('the phone and ship gap changes when only one zone moves clocks', () => {
    // Cancun has no daylight saving; Chicago does: an hour behind in winter, level in summer.
    const gap = (date: string) => {
      const at = zonedToEpoch(date, '12:00', 'America/Cancun')
      const [ship, phone] = threeClocks(at, { ship: 'America/Cancun', port: null, phone: CHI })
      return hoursBetween(ship, phone)
    }
    expect(gap('2027-01-15')).toBe(-1)
    expect(gap('2027-07-15')).toBe(0)
  })
})

describe('time intelligence: date line and far zones', () => {
  it('the same moment is on different dates either side of the date line', () => {
    const e = Date.UTC(2027, 0, 1, 11, 0)
    expect(dateIn(e, 'Pacific/Kiritimati')).toBe('2027-01-02')
    expect(dateIn(e, 'Pacific/Pago_Pago')).toBe('2027-01-01')
    expect(offsetMinutes(e, 'Pacific/Kiritimati') - offsetMinutes(e, 'Pacific/Pago_Pago')).toBe(25 * 60)
  })

  it('Samoa skipped 30 December 2011: two local noons are 24 hours apart', () => {
    const before = zonedToEpoch('2011-12-29', '12:00', 'Pacific/Apia')
    const after = zonedToEpoch('2011-12-31', '12:00', 'Pacific/Apia')
    expect((after - before) / 3_600_000).toBe(24)
  })

  it('half-hour zones read as half hours between clocks', () => {
    const at = Date.UTC(2027, 5, 1, 12, 0)
    const [ship, phone] = threeClocks(at, { ship: 'Asia/Kolkata', port: null, phone: 'UTC' })
    expect(hoursBetween(ship, phone)).toBe(-5.5)
  })

  it('port clock is left out at sea and kept in port', () => {
    const at = Date.UTC(2027, 2, 21, 15, 0)
    expect(threeClocks(at, { ship: NY, port: null, phone: CHI }).map((r) => r.kind)).toEqual(['ship', 'phone'])
    expect(threeClocks(at, { ship: NY, port: 'America/Belize', phone: CHI }).map((r) => r.kind)).toEqual(['ship', 'port', 'phone'])
  })

  it('adding days crosses month, year and leap-day edges', () => {
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })
})
