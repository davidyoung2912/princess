import { describe, expect, it } from 'vitest'
import { bounded, withRetries } from './bounded'
import { ApiError } from './errors'

describe('bounded calls (PERF-04)', () => {
  it('passes an answer through', async () => {
    await expect(bounded(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('turns a stall into a retryable timeout', async () => {
    const err = await bounded(new Promise(() => {}), 10).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'timeout', retryable: true })
  })

  it('leaves a real error as it was', async () => {
    const real = new ApiError('conflict', 'full')
    await expect(bounded(Promise.reject(real), 50)).rejects.toBe(real)
  })
})

describe('load retries (PERF-04)', () => {
  const noWait = { sleep: () => Promise.resolve() }

  it('tries again after a flaky link and returns the answer', async () => {
    let calls = 0
    const load = () => (++calls < 3 ? Promise.reject(new ApiError('network')) : Promise.resolve('ok'))
    await expect(withRetries(load, noWait)).resolves.toBe('ok')
    expect(calls).toBe(3)
  })

  it('gives up after the allowed retries and passes on the last error', async () => {
    let calls = 0
    const err = await withRetries(() => { calls++; return Promise.reject(new ApiError('server')) }, { ...noWait, retries: 1 }).catch((e: unknown) => e)
    expect(calls).toBe(2)
    expect(err).toMatchObject({ code: 'server' })
  })

  it('does not repeat a real answer', async () => {
    let calls = 0
    await withRetries(() => { calls++; return Promise.reject(new ApiError('notFound')) }, noWait).catch(() => {})
    expect(calls).toBe(1)
  })

  it('waits longer each time and stops when the screen has moved on', async () => {
    const waits: number[] = []
    let calls = 0
    await withRetries(() => { calls++; return Promise.reject(new ApiError('offline')) }, { retries: 3, delayMs: (n) => 100 * 2 ** n, sleep: (ms) => { waits.push(ms); return Promise.resolve() } }).catch(() => {})
    expect(waits).toEqual([100, 200, 400])
    calls = 0
    await withRetries(() => { calls++; return Promise.reject(new ApiError('offline')) }, { ...noWait, keepGoing: () => false }).catch(() => {})
    expect(calls).toBe(1)
  })
})
