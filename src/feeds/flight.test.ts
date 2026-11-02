import { afterEach, describe, expect, it } from 'vitest'
import { flightFeed, normalizeFlightStatus } from './flight'

afterEach(() => { flightFeed.setFetcher(null); flightFeed.forget() })

describe('flight feed', () => {
  it('knows nothing without a server', async () => {
    expect(await flightFeed.load('PR100', '2027-03-20')).toBe(false)
    expect(flightFeed.now('PR100', '2027-03-20')).toBeNull()
  })
  it("takes the server's status once", async () => {
    const asked: string[][] = []
    flightFeed.setFetcher(async (n, d) => { asked.push([n, d]); return { state: 'delayed', delayMinutes: 75, source: 'sim' } })
    expect(await flightFeed.load('PR100', '2027-03-20')).toBe(true)
    expect(await flightFeed.load('PR100', '2027-03-20')).toBe(false)
    expect(asked).toEqual([['PR100', '2027-03-20']])
    expect(flightFeed.now('PR100', '2027-03-20')).toEqual({ source: 'sim', state: 'delayed', delayMinutes: 75 })
  })
  it('shows nothing on a failure or a bad answer', async () => {
    flightFeed.setFetcher(async () => { throw new Error('offline') })
    expect(await flightFeed.load('PR100', '2027-03-21')).toBe(false)
    expect(flightFeed.now('PR100', '2027-03-21')).toBeNull()
    expect(normalizeFlightStatus({ state: 'late' })).toBeNull()
    expect(normalizeFlightStatus({ state: 'onTime', delayMinutes: 40 })?.delayMinutes).toBe(0)
  })
})
