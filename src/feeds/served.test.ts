import { afterEach, describe, expect, it } from 'vitest'
import { fareHistory } from '../domain/bookingPrep'
import { crowdFor } from '../domain/portCrowd'
import { faresNow, forgetFares, loadFares, normalizeFares, setFaresFetcher } from './fares'
import { crowdNow, forgetCrowd, loadCrowd, normalizeCrowd, setCrowdFetcher } from './portCrowd'

afterEach(() => { setCrowdFetcher(null); setFaresFetcher(null); forgetCrowd(); forgetFares() })

describe('port crowd feed', () => {
  it('uses the local simulation without a server and takes the server’s answer once', async () => {
    expect(await loadCrowd('cozumel', '2027-03-23')).toBe(false)
    expect(crowdNow('cozumel', '2027-03-23')).toEqual(crowdFor('cozumel', '2027-03-23'))
    let calls = 0
    setCrowdFetcher(async () => { calls++; return { ships: 5, guests: 20000, level: 'busy', stayAboardNote: true, source: 'sim' } })
    expect(await loadCrowd('cozumel', '2027-03-23')).toBe(true)
    expect(await loadCrowd('cozumel', '2027-03-23')).toBe(false)
    expect(calls).toBe(1)
    expect(crowdNow('cozumel', '2027-03-23')).toMatchObject({ ships: 5, level: 'busy', stayAboardNote: true })
  })
  it('falls back on failures and bad shapes', async () => {
    setCrowdFetcher(async () => { throw new Error('offline') })
    expect(await loadCrowd('belize', '2027-03-24')).toBe(false)
    setCrowdFetcher(async () => ({ ships: 0, guests: 1, level: 'busy' }))
    expect(await loadCrowd('belize', '2027-03-24')).toBe(false)
    expect(normalizeCrowd({ ships: 2, guests: 8000, level: 'huge' })).toBeNull()
    expect(crowdNow('belize', '2027-03-24')).toEqual(crowdFor('belize', '2027-03-24'))
  })
})

describe('fare history feed', () => {
  const b = { plan: { total: 480_000, booked: '2027-01-04' }, today: '2027-02-01' } as never
  it('uses the local simulation without a server and takes the server’s points', async () => {
    expect(faresNow(b, 'A1B2C3')).toEqual(fareHistory(b, 'A1B2C3'))
    setFaresFetcher(async () => [{ date: '2027-01-04', total: 480_000 }, { date: '2027-01-11', total: 470_000 }])
    expect(await loadFares(b, 'A1B2C3')).toBe(true)
    expect(faresNow(b, 'A1B2C3')).toHaveLength(2)
  })
  it('refuses unreadable points', () => {
    expect(normalizeFares([])).toBeNull()
    expect(normalizeFares([{ date: 'soon', total: 1 }])).toBeNull()
    expect(normalizeFares('x')).toBeNull()
  })
})
