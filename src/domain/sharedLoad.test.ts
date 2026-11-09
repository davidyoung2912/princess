import { describe, expect, it, vi } from 'vitest'
import { createSharedLoader } from './sharedLoad'

describe('createSharedLoader', () => {
  it('shares one call between asks that overlap or follow closely', async () => {
    let clock = 0
    const shared = createSharedLoader(() => clock, 1000)
    const load = vi.fn(async () => 'a')
    await Promise.all([shared('k', load), shared('k', load)])
    clock = 999
    await shared('k', load)
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('calls again once the window has passed, and keeps keys apart', async () => {
    let clock = 0
    const shared = createSharedLoader(() => clock, 1000)
    const load = vi.fn(async () => 'a')
    await shared('k', load)
    await shared('other', load)
    clock = 1000
    await shared('k', load)
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('forgets a failed call so the next ask tries again', async () => {
    const shared = createSharedLoader(() => 0, 1000)
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok')
    await expect(shared('k', load)).rejects.toThrow('down')
    await Promise.resolve()
    await expect(shared('k', load)).resolves.toBe('ok')
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('clear', () => {
  it('makes the next ask call again', async () => {
    const shared = createSharedLoader(() => 0, 1000)
    const load = vi.fn(async () => 'a')
    await shared('k', load)
    shared.clear()
    await shared('k', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
