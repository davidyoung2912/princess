import { afterEach, describe, expect, it } from 'vitest'
import { normalizeSky, skyFeed } from './sky'

afterEach(() => { skyFeed.setFetcher(null); skyFeed.forget() })

describe('sky feed', () => {
  it('knows nothing without a server', async () => {
    expect(await skyFeed.load('S1', 3, 'sea')).toBe(false)
    expect(skyFeed.now('S1', 3, 'sea')).toBeNull()
  })
  it("takes the server's figures once, then keeps them", async () => {
    let calls = 0
    skyFeed.setFetcher(async () => { calls++; return { uv: 11, tempF: 91, rainFrom: '13:00', rainTo: '16:00', source: 'sim' } })
    expect(await skyFeed.load('S1', 3, 'sea')).toBe(true)
    expect(await skyFeed.load('S1', 3, 'sea')).toBe(false)
    expect(calls).toBe(1)
    expect(skyFeed.now('S1', 3, 'sea')).toEqual({ uv: 11, tempF: 91, rainFrom: '13:00', rainTo: '16:00', source: 'sim' })
  })
  it('shows nothing when the server fails or answers badly', async () => {
    skyFeed.setFetcher(async () => { throw new Error('offline') })
    expect(await skyFeed.load('S1', 4, 'sea')).toBe(false)
    skyFeed.setFetcher(async () => ({ uv: 'high' }))
    expect(await skyFeed.load('S1', 4, 'sea')).toBe(false)
    expect(skyFeed.now('S1', 4, 'sea')).toBeNull()
  })
  it('drops half a rain window', () => {
    expect(normalizeSky({ uv: 8, tempF: 85, rainFrom: '13:00', rainTo: null })).toMatchObject({ rainFrom: null, rainTo: null })
  })
})
