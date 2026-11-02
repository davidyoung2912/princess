import { describe, expect, it } from 'vitest'
import { removeAppKeys, resetDemo, wipeEverything, type KeyValueStorage } from './lifecycle'
import { createChannel, type ChannelLike } from './sync'

class FakeStorage implements KeyValueStorage {
  items = new Map<string, string>()
  get length() { return this.items.size }
  key(i: number) { return [...this.items.keys()][i] ?? null }
  removeItem(k: string) { this.items.delete(k) }
}

describe('reset and wipe', () => {
  it('reset clears the demo controls but keeps settings and sign-in', async () => {
    const local = new FakeStorage()
    local.items.set('princess:demo', '{}')
    local.items.set('princess:settings:gerald', '{}')
    await resetDemo(local)
    expect([...local.items.keys()]).toEqual(['princess:settings:gerald'])
  })
  it('wipe removes every app key from both storages and leaves other keys', () => {
    const local = new FakeStorage()
    const session = new FakeStorage()
    for (const k of ['princess:demo', 'princess:settings', 'princess:settings:maria', 'other:thing']) local.items.set(k, '1')
    session.items.set('princess:session', '1')
    wipeEverything({ local, session })
    expect([...local.items.keys()]).toEqual(['other:thing'])
    expect(session.items.size).toBe(0)
  })
  it('removeAppKeys honours exceptions', () => {
    const s = new FakeStorage()
    s.items.set('princess:a', '1'); s.items.set('princess:b', '1')
    removeAppKeys(s, ['princess:b'])
    expect([...s.items.keys()]).toEqual(['princess:b'])
  })
})

describe('cross-tab channel', () => {
  it('delivers changes from one tab to another and ignores junk', () => {
    const real = new Map<string, Set<{ self: object; fn: (e: { data: unknown }) => void }>>()
    const make = (name: string): ChannelLike => {
      const self = {}
      const group = real.get(name) ?? new Set()
      real.set(name, group)
      return {
        postMessage: (m) => group.forEach((l) => l.self !== self && l.fn({ data: m })),
        addEventListener: (_t, fn) => { group.add({ self, fn }) },
        removeEventListener: (_t, fn) => { group.forEach((l) => l.fn === fn && group.delete(l)) },
        close: () => {},
      }
    }
    const one = createChannel('p', make)
    const two = createChannel('p', make)
    const got: unknown[] = []
    two.subscribe((m) => got.push(m))
    one.post({ type: 'records', kind: 'message', owner: 'daniel' })
    ;[...real.get('p')!][0].fn({ data: { type: 'bogus' } })
    expect(got).toEqual([{ type: 'records', kind: 'message', owner: 'daniel' }])
  })
  it('does nothing, safely, where there is no BroadcastChannel', () => {
    const c = createChannel('p', null)
    expect(() => { c.post({ type: 'demo' }); c.subscribe(() => {})(); c.close() }).not.toThrow()
  })
})
