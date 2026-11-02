import { afterEach, describe, expect, it } from 'vitest'
import { faresFeed, normalizeFares } from './fares'
import { crowdFeed, normalizeCrowd } from './portCrowd'

afterEach(() => { crowdFeed.setFetcher(null); faresFeed.setFetcher(null); crowdFeed.forget(); faresFeed.forget() })

describe('port crowd feed', () => {
  it('knows nothing without a server and takes the server’s answer once', async () => {
    expect(await crowdFeed.load('cozumel', '2027-03-23')).toBe(false)
    expect(crowdFeed.now('cozumel', '2027-03-23')).toBeNull()
    let calls = 0
    crowdFeed.setFetcher(async () => { calls++; return { ships: 5, guests: 20000, level: 'busy', stayAboardNote: true, source: 'sim' } })
    expect(await crowdFeed.load('cozumel', '2027-03-23')).toBe(true)
    expect(await crowdFeed.load('cozumel', '2027-03-23')).toBe(false)
    expect(calls).toBe(1)
    expect(crowdFeed.now('cozumel', '2027-03-23')).toMatchObject({ ships: 5, level: 'busy', stayAboardNote: true })
  })
  it('shows nothing on failures and bad shapes', async () => {
    crowdFeed.setFetcher(async () => { throw new Error('offline') })
    expect(await crowdFeed.load('belize', '2027-03-24')).toBe(false)
    crowdFeed.setFetcher(async () => ({ ships: 0, guests: 1, level: 'busy' }))
    expect(await crowdFeed.load('belize', '2027-03-24')).toBe(false)
    expect(normalizeCrowd({ ships: 2, guests: 8000, level: 'huge' })).toBeNull()
    expect(crowdFeed.now('belize', '2027-03-24')).toBeNull()
  })
})

describe('fare history feed', () => {
  it('knows nothing without a server and takes the server’s points', async () => {
    expect(faresFeed.now('A1B2C3', 480_000, '2027-01-04', '2027-02-01')).toBeNull()
    faresFeed.setFetcher(async () => [{ date: '2027-01-04', total: 480_000 }, { date: '2027-01-11', total: 470_000 }])
    expect(await faresFeed.load('A1B2C3', 480_000, '2027-01-04', '2027-02-01')).toBe(true)
    expect(faresFeed.now('A1B2C3', 480_000, '2027-01-04', '2027-02-01')).toHaveLength(2)
  })
  it('refuses unreadable points', () => {
    expect(normalizeFares([])).toBeNull()
    expect(normalizeFares([{ date: 'soon', total: 1 }])).toBeNull()
    expect(normalizeFares('x')).toBeNull()
  })
})
