import { describe, expect, it } from 'vitest'
import { BASE_DELAY_MS, MAX_ATTEMPTS, MAX_DELAY_MS, MAX_QUEUED, backoffMs, due, enqueue, failed, gaveUp, isRetryable, loadOutbox, nextWake, outboxKey, saveOutbox, sent, TimeoutError, withTimeout } from './outbox'

const item = (id: string) => ({ id, kind: 'chat' as const, payload: { text: id } })

describe('backoff', () => {
  it('doubles up to a minute, with up to half taken off', () => {
    expect(backoffMs(0, () => 1)).toBe(BASE_DELAY_MS)
    expect(backoffMs(1, () => 1)).toBe(BASE_DELAY_MS * 2)
    expect(backoffMs(0, () => 0)).toBe(BASE_DELAY_MS / 2)
    expect(backoffMs(20, () => 1)).toBe(MAX_DELAY_MS)
    expect(backoffMs(20, () => 0)).toBe(MAX_DELAY_MS / 2)
  })

  it('retries failures that can pass, not real answers', () => {
    for (const c of ['offline', 'network', 'timeout', 'server']) expect(isRetryable(c)).toBe(true)
    for (const c of ['conflict', 'invalid', 'forbidden', 'notFound']) expect(isRetryable(c)).toBe(false)
  })
})

describe('outbox list', () => {
  it('queues once, is due at once, and waits longer after each failure', () => {
    let list = enqueue([], item('a'), 1000)
    list = enqueue(list, item('a'), 1000)
    expect(list).toHaveLength(1)
    expect(due(list, 1000)).toHaveLength(1)
    list = failed(list, 'a', 1000, () => 1)
    expect(list[0]).toMatchObject({ attempts: 1, nextAt: 1000 + BASE_DELAY_MS })
    expect(due(list, 1000)).toEqual([])
    expect(nextWake(list)).toBe(1000 + BASE_DELAY_MS)
    list = failed(list, 'a', 5000, () => 1)
    expect(list[0].nextAt).toBe(5000 + BASE_DELAY_MS * 2)
    expect(sent(list, 'a')).toEqual([])
    expect(nextWake([])).toBeNull()
  })

  it('gives up after the limit and keeps only the newest', () => {
    let list = enqueue([], item('a'), 0)
    for (let i = 0; i < MAX_ATTEMPTS; i++) list = failed(list, 'a', 0, () => 0)
    expect(due(list, 1e12)).toEqual([])
    expect(gaveUp(list)).toHaveLength(1)
    expect(nextWake(list)).toBeNull()
    let many: ReturnType<typeof enqueue> = []
    for (let i = 0; i < MAX_QUEUED + 5; i++) many = enqueue(many, item(`m${i}`), 0)
    expect(many).toHaveLength(MAX_QUEUED)
    expect(many.at(-1)!.id).toBe(`m${MAX_QUEUED + 4}`)
  })
})

describe('storage', () => {
  const store = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
  }

  it('survives a reload, drops damaged entries and clears when empty', () => {
    const s = store()
    saveOutbox(s, 'daniel:chat', enqueue([], item('a'), 0))
    expect(loadOutbox(s, 'daniel:chat')).toHaveLength(1)
    s.setItem(outboxKey('x'), JSON.stringify([{ id: 1 }, item('b')]))
    expect(loadOutbox(s, 'x')).toEqual([])
    s.setItem(outboxKey('y'), '{bad')
    expect(loadOutbox(s, 'y')).toEqual([])
    saveOutbox(s, 'daniel:chat', [])
    expect(s.m.has(outboxKey('daniel:chat'))).toBe(false)
    expect(() => saveOutbox(null, 'z', [])).not.toThrow()
  })
})

describe('withTimeout', () => {
  it('passes a result through, and ends a stall with a timeout', async () => {
    await expect(withTimeout(Promise.resolve(5), 50)).resolves.toBe(5)
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toBeInstanceOf(TimeoutError)
    await expect(withTimeout(Promise.reject(new Error('x')), 50)).rejects.toThrow('x')
  })
})
