import { describe, expect, it } from 'vitest'
import { bounded } from './bounded'
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
