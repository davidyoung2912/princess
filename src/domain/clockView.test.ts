import { describe, expect, it } from 'vitest'
import { zoneChangeNear } from './clockView'
import { SAILINGS, shipClockChanges } from './sailings'

const sailing = SAILINGS.find((s) => s.departure === '2027-03-21')!
const [out] = shipClockChanges(sailing)
const HOUR = 3_600_000

// proves: MOB-14#1
describe('zoneChangeNear', () => {
  it('announces a clock change within a day, before and after', () => {
    expect(zoneChangeNear(sailing, out.at - 6 * HOUR)).toEqual({ hours: out.hours, upcoming: true })
    expect(zoneChangeNear(sailing, out.at + 6 * HOUR)).toEqual({ hours: out.hours, upcoming: false })
  })
  it('says nothing when no change is near', () => {
    expect(zoneChangeNear(sailing, out.at - 3 * 24 * HOUR)).toBeNull()
  })
})
