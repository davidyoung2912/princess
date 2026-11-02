import { afterEach, describe, expect, it } from 'vitest'
import { routeConditions } from '../domain/journey'
import { conditionsNow, forgetConditions, loadConditions, normalizeConditions, setRouteFetcher } from './route'

afterEach(() => { setRouteFetcher(null); forgetConditions() })

describe('route conditions feed', () => {
  it('matches the old simulation without a server', async () => {
    expect(await loadConditions('2027-03-21', 'busy')).toBe(false)
    expect(conditionsNow('2027-03-21', 'busy')).toEqual(routeConditions('2027-03-21', null))
  })
  it("takes the server's answer once", async () => {
    let calls = 0
    setRouteFetcher(async () => { calls++; return { traffic: 'heavy', sky: 'storm', leaveEarlierMinutes: 45, source: 'sim' } })
    expect(await loadConditions('2027-03-21', 'busiest')).toBe(true)
    expect(await loadConditions('2027-03-21', 'busiest')).toBe(false)
    expect(calls).toBe(1)
    expect(conditionsNow('2027-03-21', 'busiest')).toEqual({ source: 'sim', traffic: 'heavy', sky: 'storm', leaveEarlierMinutes: 45 })
  })
  it('keeps the simulation on a failure or a bad answer', async () => {
    setRouteFetcher(async () => { throw new Error('offline') })
    expect(await loadConditions('2027-03-22', 'quiet')).toBe(false)
    expect(normalizeConditions({ traffic: 'jam', sky: 'clear' })).toBeNull()
  })
})
