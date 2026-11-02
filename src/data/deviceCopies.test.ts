import { describe, expect, it } from 'vitest'
import { cacheGet, cachePut, maxAgeFor } from '../domain/offlineCache'
import { normalizeCallbacks } from '../domain/disruptionHub'
import { clearPersonCopies, isPersonKey, OWNER_KEY, UNSENT_PREFIXES, type KeyValueStorage } from './lifecycle'
import { hasUnsent } from './outbox'

class Fake implements KeyValueStorage {
  items = new Map<string, string>()
  get length() { return this.items.size }
  key(i: number) { return [...this.items.keys()][i] ?? null }
  removeItem(k: string) { this.items.delete(k) }
  getItem(k: string) { return this.items.get(k) ?? null }
  setItem(k: string, v: string) { this.items.set(k, v) }
}

describe('a person\'s copies on the device', () => {
  it('knows which keys belong to a person', () => {
    for (const k of ['princess:hub:u1', 'princess:trip:u1', 'princess:demo', 'princess:demo-server', 'princess:cache:found:ABC', 'princess:cache:feed-sky:x', 'princess:outbox:u1:chat', 'princess:port:u1']) expect(isPersonKey(k)).toBe(true)
    for (const k of ['princess:settings', 'princess:settings:u1', 'princess:diagnostics', 'princess:improve', 'princess:telemetry', OWNER_KEY, 'princess:cache:catalogue:v1', 'princess:cache:limits:v1', 'other:thing']) expect(isPersonKey(k)).toBe(false)
  })

  it('clears them, leaves settings and reference tables, and can leave the unsent outbox', () => {
    const s = new Fake()
    for (const k of ['princess:hub:u1', 'princess:cache:muster:u1', 'princess:outbox:u1:chat', 'princess:settings:u1', 'princess:cache:ports:v1', 'princess:diagnostics', 'other:x']) s.items.set(k, '1')
    clearPersonCopies(s, UNSENT_PREFIXES)
    expect([...s.items.keys()].sort()).toEqual(['other:x', 'princess:cache:ports:v1', 'princess:diagnostics', 'princess:outbox:u1:chat', 'princess:settings:u1'])
    clearPersonCopies(s)
    expect(s.items.has('princess:outbox:u1:chat')).toBe(false)
    expect(s.items.has('princess:settings:u1')).toBe(true)
    expect(() => clearPersonCopies(null)).not.toThrow()
  })

  it('says an outbox with something in it is unsent', () => {
    const s = new Fake()
    expect(hasUnsent(s)).toBe(false)
    s.items.set('princess:outbox:u1:chat', '[]')
    expect(hasUnsent(s)).toBe(true)
    expect(hasUnsent(null)).toBe(false)
  })
})

describe('saved copies have a maximum age', () => {
  const DAY = 86_400_000
  const ok = (raw: unknown) => (typeof raw === 'number' ? raw : null)
  it('gives feeds a day, the programme three and the rest thirty', () => {
    expect(maxAgeFor('feed-sky')).toBe(DAY)
    expect(maxAgeFor('program')).toBe(3 * DAY)
    expect(maxAgeFor('found')).toBe(30 * DAY)
  })
  it('refuses a copy that is too old, but only when asked the time', () => {
    const s = new Fake()
    cachePut(s, 'feed-sky', 'k', 7, 1_000)
    expect(cacheGet(s, 'feed-sky', 'k', ok, 1_000 + DAY)?.value).toBe(7)
    expect(cacheGet(s, 'feed-sky', 'k', ok, 1_000 + DAY + 1)).toBeNull()
    expect(cacheGet(s, 'feed-sky', 'k', ok)?.value).toBe(7)
  })
})

describe('served call-back tickets', () => {
  it('keeps call backs only, as the server listed them', () => {
    const base = { id: 'a', at: 1, position: 2, readyAt: 9, reason: 'other', status: 'waiting', source: 'sim' }
    expect(normalizeCallbacks([{ ...base, kind: 'callback' }, { ...base, id: 'b', kind: 'kit' }, 'x', null]).map((c) => c.id)).toEqual(['a'])
    expect(normalizeCallbacks({})).toEqual([])
  })
})
