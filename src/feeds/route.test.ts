import { afterEach, describe, expect, it } from 'vitest'
import { conditionsFeed, normalizeConditions } from './route'

afterEach(() => { conditionsFeed.setFetcher(null); conditionsFeed.forget() })

describe('route conditions feed', () => {
  it('knows nothing without a server', async () => {
    expect(await conditionsFeed.load('2027-03-21', 'busy')).toBe(false)
    expect(conditionsFeed.now('2027-03-21', 'busy')).toBeNull()
  })
  it("takes the server's answer once", async () => {
    let calls = 0
    conditionsFeed.setFetcher(async () => { calls++; return { traffic: 'heavy', sky: 'storm', leaveEarlierMinutes: 45 } })
    expect(await conditionsFeed.load('2027-03-21', 'busiest')).toBe(true)
    expect(await conditionsFeed.load('2027-03-21', 'busiest')).toBe(false)
    expect(calls).toBe(1)
    expect(conditionsFeed.now('2027-03-21', 'busiest')).toEqual({ traffic: 'heavy', sky: 'storm', leaveEarlierMinutes: 45 })
  })
  it('shows nothing on a failure or a bad answer', async () => {
    conditionsFeed.setFetcher(async () => { throw new Error('offline') })
    expect(await conditionsFeed.load('2027-03-22', 'quiet')).toBe(false)
    expect(normalizeConditions({ traffic: 'jam', sky: 'clear' })).toBeNull()
  })
})
