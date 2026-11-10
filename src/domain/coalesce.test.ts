import { describe, expect, it } from 'vitest'
import { coalesce } from './coalesce'

/** A fetch whose answers the test settles by hand. */
function manual() {
  const pending: { resolve: (v: number) => void; reject: (e: Error) => void }[] = []
  let calls = 0
  const fetch = () => new Promise<number>((resolve, reject) => { calls++; pending.push({ resolve, reject }) })
  return { fetch, pending, calls: () => calls }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('coalesce', () => {
  it('runs one request for a single call', async () => {
    const m = manual()
    const get = coalesce(m.fetch)
    const p = get()
    m.pending[0].resolve(1)
    expect(await p).toBe(1)
    expect(m.calls()).toBe(1)
  })

  it('turns a burst during a request into one follow-up, never more', async () => {
    const m = manual()
    const get = coalesce(m.fetch)
    const first = get()
    const a = get()
    const b = get()
    const c = get()
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(m.calls()).toBe(1)
    m.pending[0].resolve(1)
    await tick()
    expect(m.calls()).toBe(2)
    m.pending[1].resolve(2)
    expect(await first).toBe(1)
    expect(await Promise.all([a, b, c])).toEqual([2, 2, 2])
    expect(m.calls()).toBe(2)
  })

  it('starts the follow-up even when the first request failed, and passes the failure only to its own caller', async () => {
    const m = manual()
    const get = coalesce(m.fetch)
    const first = get()
    const second = get()
    m.pending[0].reject(new Error('offline'))
    await expect(first).rejects.toThrow('offline')
    await tick()
    m.pending[1].resolve(7)
    expect(await second).toBe(7)
  })

  it('goes back to one request per call once things are quiet', async () => {
    const m = manual()
    const get = coalesce(m.fetch)
    const a = get()
    m.pending[0].resolve(1)
    await a
    const b = get()
    m.pending[1].resolve(2)
    expect(await b).toBe(2)
    expect(m.calls()).toBe(2)
  })
})
