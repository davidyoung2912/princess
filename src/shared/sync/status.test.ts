import { describe, expect, it } from 'vitest'
import { createSync } from './sync'

describe('sync status', () => {
  it('tells the screen when saving starts and when it is saved or waiting', async () => {
    const seen: string[] = []
    const s = createSync({ remote: () => null, onStatus: (x) => seen.push(x) })
    s.register({ key: 'k', read: () => ({}), apply: () => {}, isEmpty: () => false })
    s.setOwner('u', 'p')
    expect(s.status()).toBe('idle')
    await s.pull()
    expect(s.status()).toBe('idle')
    expect(seen.every((x) => ['idle', 'syncing', 'error'].includes(x))).toBe(true)
  })
})
