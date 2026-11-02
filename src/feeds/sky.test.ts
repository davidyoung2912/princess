import { afterEach, describe, expect, it } from 'vitest'
import { simWeather } from '../domain/autopilot'
import { forgetSky, loadSky, normalizeSky, setSkyFetcher, skyNow } from './sky'

afterEach(() => { setSkyFetcher(null); forgetSky() })

describe('sky feed', () => {
  it('uses the local simulation without a server', async () => {
    expect(await loadSky('S1', 3, 'sea')).toBe(false)
    expect(skyNow('S1', 3, 'sea')).toEqual(simWeather('S1', 3, 'sea'))
  })
  it("takes the server's figures once, then keeps them", async () => {
    let calls = 0
    setSkyFetcher(async () => { calls++; return { uv: 11, tempF: 91, rainFrom: '13:00', rainTo: '16:00', source: 'sim' } })
    expect(await loadSky('S1', 3, 'sea')).toBe(true)
    expect(await loadSky('S1', 3, 'sea')).toBe(false)
    expect(calls).toBe(1)
    expect(skyNow('S1', 3, 'sea')).toEqual({ uv: 11, tempF: 91, rainFrom: '13:00', rainTo: '16:00', source: 'sim' })
  })
  it('falls back when the server fails or answers badly', async () => {
    setSkyFetcher(async () => { throw new Error('offline') })
    expect(await loadSky('S1', 4, 'sea')).toBe(false)
    setSkyFetcher(async () => ({ uv: 'high' }))
    expect(await loadSky('S1', 4, 'sea')).toBe(false)
    expect(skyNow('S1', 4, 'sea')).toEqual(simWeather('S1', 4, 'sea'))
  })
  it('drops half a rain window', () => {
    expect(normalizeSky({ uv: 8, tempF: 85, rainFrom: '13:00', rainTo: null })).toMatchObject({ rainFrom: null, rainTo: null })
  })
})
