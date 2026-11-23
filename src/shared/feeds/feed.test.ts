import { describe, expect, it } from 'vitest'
import { createFeed } from './feed'

const num = (raw: unknown) => (typeof raw === 'number' ? raw : null)

describe('createFeed', () => {
  it('shares a request still in flight, so a second caller hears the same answer', async () => {
    const feed = createFeed<[], number>(() => 'k', num)
    let calls = 0
    feed.setFetcher(async () => { calls++; await Promise.resolve(); return 7 })
    const [a, b] = await Promise.all([feed.load(), feed.load()])
    expect([a, b, calls]).toEqual([true, true, 1])
    expect(feed.now()).toBe(7)
    expect(await feed.load()).toBe(false)   // already read this session
  })

  it('tries again after a failure or an unusable answer', async () => {
    const feed = createFeed<[], number>(() => 'k', num)
    let n = 0
    feed.setFetcher(async () => { n++; if (n === 1) throw new Error('down'); return n === 2 ? 'bad' : 9 })
    expect(await feed.load()).toBe(false)
    expect(await feed.load()).toBe(false)
    expect(await feed.load()).toBe(true)
    expect(feed.now()).toBe(9)
  })
})
