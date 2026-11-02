import { afterEach, describe, expect, it } from 'vitest'
import { flightStatus } from '../domain/journey'
import { flightNow, forgetFlights, loadFlight, normalizeFlightStatus, setFlightFetcher } from './flight'

afterEach(() => { setFlightFetcher(null); forgetFlights() })

describe('flight feed', () => {
  it('uses the local simulation without a server, and nothing for a bad number', async () => {
    expect(await loadFlight('PR100', '2027-03-20')).toBe(false)
    expect(flightNow('pr 100', '2027-03-20')).toEqual(flightStatus('PR100', '2027-03-20'))
    expect(flightNow('nope', '2027-03-20')).toBeNull()
  })
  it("takes the server's status once", async () => {
    const asked: string[][] = []
    setFlightFetcher(async (n, d) => { asked.push([n, d]); return { state: 'delayed', delayMinutes: 75, source: 'sim' } })
    expect(await loadFlight('pr 100', '2027-03-20')).toBe(true)
    expect(await loadFlight('PR100', '2027-03-20')).toBe(false)
    expect(asked).toEqual([['PR100', '2027-03-20']])
    expect(flightNow('PR100', '2027-03-20')).toEqual({ source: 'sim', state: 'delayed', delayMinutes: 75 })
  })
  it('falls back on a failure or a bad answer, and does not ask for a bad number', async () => {
    setFlightFetcher(async () => { throw new Error('offline') })
    expect(await loadFlight('PR100', '2027-03-21')).toBe(false)
    setFlightFetcher(async () => { throw new Error('should not be asked') })
    expect(await loadFlight('x', '2027-03-21')).toBe(false)
    expect(normalizeFlightStatus({ state: 'late' })).toBeNull()
    expect(normalizeFlightStatus({ state: 'onTime', delayMinutes: 40 })?.delayMinutes).toBe(0)
  })
})
