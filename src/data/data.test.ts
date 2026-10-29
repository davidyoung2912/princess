import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { backupFileName, backupToText, createBackup, parseBackup, restoreBackup } from './backup'
import { mapStorageError, StorageError } from './errors'
import { deleteDatabase, openStore, UPGRADES, type Upgrade } from './idbStore'
import { removeAppKeys, resetDemo, wipeEverything, type KeyValueStorage } from './lifecycle'
import { createMemoryStore, type DataRecord, type DataStore } from './store'
import { createChannel, type ChannelLike } from './sync'

const rec = (kind: string, owner: string, id: string, updatedAt: number, data: unknown = { id }): DataRecord => ({ kind, owner, id, updatedAt, data })

let n = 0
const stores: Record<string, () => Promise<DataStore>> = {
  memory: async () => createMemoryStore(),
  indexeddb: async () => { globalThis.indexedDB = new IDBFactory(); return openStore(`test-${n++}`) },
}

for (const [name, make] of Object.entries(stores)) {
  describe(`data store contract: ${name}`, () => {
    let store: DataStore
    beforeEach(async () => { store = await make() })

    it('stores, reads, updates and deletes a record', async () => {
      expect(await store.get('order', 'gerald', 'a')).toBeUndefined()
      await store.put(rec('order', 'gerald', 'a', 1, { items: ['tea'] }))
      expect((await store.get('order', 'gerald', 'a'))?.data).toEqual({ items: ['tea'] })
      await store.put(rec('order', 'gerald', 'a', 2, { items: ['coffee'] }))
      expect((await store.list('order')).length).toBe(1)
      expect((await store.get('order', 'gerald', 'a'))?.data).toEqual({ items: ['coffee'] })
      await store.delete('order', 'gerald', 'a')
      expect(await store.get('order', 'gerald', 'a')).toBeUndefined()
    })
    it('lists by kind and owner, oldest first', async () => {
      await store.put(rec('message', 'daniel', 'm2', 20))
      await store.put(rec('message', 'marcus', 'm1', 10))
      await store.put(rec('order', 'daniel', 'o1', 5))
      expect((await store.list('message')).map((r) => r.id)).toEqual(['m1', 'm2'])
      expect((await store.list('message', 'daniel')).map((r) => r.id)).toEqual(['m2'])
      expect((await store.all('daniel')).map((r) => r.id)).toEqual(['o1', 'm2'])
      expect(await store.all()).toHaveLength(3)
    })
    it('keeps the same id separate across kinds and owners', async () => {
      await store.put(rec('order', 'a', 'x', 1, 'one'))
      await store.put(rec('order', 'b', 'x', 1, 'two'))
      await store.put(rec('photo', 'a', 'x', 1, 'three'))
      expect((await store.get('order', 'b', 'x'))?.data).toBe('two')
      expect(await store.all()).toHaveLength(3)
    })
    it('clears records but keeps meta', async () => {
      await store.put(rec('order', 'a', 'x', 1))
      await store.setMeta('seed', 3)
      await store.clear()
      expect(await store.all()).toEqual([])
      expect(await store.getMeta('seed')).toBe(3)
      expect(await store.getMeta('missing')).toBeUndefined()
    })
  })
}

describe('migrations', () => {
  it('upgrades an existing database in order without losing records', async () => {
    globalThis.indexedDB = new IDBFactory()
    const first = await openStore('mig', UPGRADES)
    await first.put(rec('order', 'gerald', 'a', 1, { items: ['tea'] }))
    first.close()
    const seen: number[] = []
    const addStatus: Upgrade = async (_db, tx) => {
      seen.push(2)
      const records = tx.objectStore('records')
      for (const r of await records.getAll()) await records.put({ ...r, data: { ...(r.data as object), status: 'received' } })
    }
    const second = await openStore('mig', [...UPGRADES, addStatus])
    expect(seen).toEqual([2])
    expect((await second.get('order', 'gerald', 'a'))?.data).toEqual({ items: ['tea'], status: 'received' })
  })
  it('creates a fresh database through every step', async () => {
    globalThis.indexedDB = new IDBFactory()
    const order: number[] = []
    const store = await openStore('fresh', [...UPGRADES, async () => { order.push(2) }, async () => { order.push(3) }])
    expect(order).toEqual([2, 3])
    await store.put(rec('order', 'a', 'x', 1))
    expect(await store.all()).toHaveLength(1)
  })
  it('deletes the database', async () => {
    globalThis.indexedDB = new IDBFactory()
    const store = await openStore('gone')
    await store.put(rec('order', 'a', 'x', 1))
    store.close()
    await deleteDatabase('gone')
    const again = await openStore('gone')
    expect(await again.all()).toEqual([])
  })
})

describe('storage errors', () => {
  it('names quota, blocked and unreadable failures', () => {
    expect(mapStorageError({ name: 'QuotaExceededError' }).code).toBe('quota')
    expect(mapStorageError({ name: 'BlockedError' }).code).toBe('blocked')
    expect(mapStorageError({ name: 'VersionError' }).code).toBe('corrupt')
    expect(mapStorageError(new Error('boom')).code).toBe('unavailable')
    const e = new StorageError('quota')
    expect(mapStorageError(e)).toBe(e)
  })
  it('turns a failing write into a StorageError', async () => {
    globalThis.indexedDB = new IDBFactory()
    const store = await openStore('quota-test')
    await expect(store.put({ kind: 'x', owner: '', id: 'y', updatedAt: 1, data: () => 1 })).rejects.toBeInstanceOf(StorageError)
  })
})

describe('backup', () => {
  it('round-trips one persona’s data and leaves others out', async () => {
    const a = createMemoryStore()
    await a.put(rec('order', 'gerald', 'o1', 1, { items: ['tea'] }))
    await a.put(rec('order', 'maria', 'o2', 2))
    const text = backupToText(await createBackup(a, 'gerald', new Date('2027-03-21T10:00:00Z')))
    const b = createMemoryStore()
    expect(await restoreBackup(b, parseBackup(text))).toBe(1)
    expect((await b.all()).map((r) => r.id)).toEqual(['o1'])
    expect((await b.get('order', 'gerald', 'o1'))?.data).toEqual({ items: ['tea'] })
  })
  it('exports everything when no owner is given', async () => {
    const a = createMemoryStore()
    await a.put(rec('order', 'gerald', 'o1', 1))
    await a.put(rec('order', 'maria', 'o2', 2))
    expect((await createBackup(a, null)).records).toHaveLength(2)
  })
  it('names the file by person and date', () => {
    expect(backupFileName('gerald', new Date('2027-03-21T10:00:00Z'))).toBe('princess-gerald-2027-03-21.json')
    expect(backupFileName(null, new Date('2027-03-21T10:00:00Z'))).toBe('princess-all-2027-03-21.json')
  })
  it('rejects files that are not usable backups', () => {
    const bad = ['not json', '[]', '{"app":"other"}', '{"app":"princess","format":99,"records":[]}', '{"app":"princess","format":1,"records":[{"kind":"x"}]}', '{"app":"princess","format":1}']
    for (const text of bad) expect(() => parseBackup(text), text).toThrow(StorageError)
  })
})

class FakeStorage implements KeyValueStorage {
  items = new Map<string, string>()
  get length() { return this.items.size }
  key(i: number) { return [...this.items.keys()][i] ?? null }
  removeItem(k: string) { this.items.delete(k) }
}

describe('reset and wipe', () => {
  it('reset clears records and demo controls but keeps settings and sign-in', async () => {
    const store = createMemoryStore()
    await store.put(rec('order', 'gerald', 'o1', 1))
    const local = new FakeStorage()
    local.items.set('princess:demo', '{}')
    local.items.set('princess:settings:gerald', '{}')
    await resetDemo(store, local)
    expect(await store.all()).toEqual([])
    expect([...local.items.keys()]).toEqual(['princess:settings:gerald'])
  })
  it('wipe removes every app key from both storages, leaves other keys, and deletes the database', async () => {
    const local = new FakeStorage()
    const session = new FakeStorage()
    for (const k of ['princess:demo', 'princess:settings', 'princess:settings:maria', 'other:thing']) local.items.set(k, '1')
    session.items.set('princess:session', '1')
    const store = createMemoryStore()
    let deleted = false
    await wipeEverything({ store, deleteDatabase: async () => { deleted = true }, local, session })
    expect([...local.items.keys()]).toEqual(['other:thing'])
    expect(session.items.size).toBe(0)
    expect(deleted).toBe(true)
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
