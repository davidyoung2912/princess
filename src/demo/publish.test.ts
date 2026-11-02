import { afterEach, describe, expect, it } from 'vitest'
import { demoPayload, publishDemo, setDemoPublisher } from './publish'
import { defaultDemoState } from './state'
import { clockAt } from '../domain/clock'

afterEach(() => setDemoPublisher(null))

describe('demo publish', () => {
  it('turns the clock into an offset from real time, in seconds', () => {
    const real = Date.UTC(2026, 10, 1, 12)
    const state = { ...defaultDemoState(real), clock: clockAt(real + 2 * 3600_000, real, 60), scenarios: ['planChange' as const] }
    expect(demoPayload(state, real)).toEqual({ clockOffsetSeconds: 7200, clockSpeed: 60, scenarios: ['planChange'] })
  })
  it('does nothing without a publisher and ignores a failed send', async () => {
    const state = defaultDemoState(Date.now())
    expect(() => publishDemo(state)).not.toThrow()
    let sent = 0
    setDemoPublisher(async () => { sent++; throw new Error('offline') })
    publishDemo(state)
    await Promise.resolve()
    expect(sent).toBe(1)
  })
})
