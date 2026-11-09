import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { createHttpRemote } from './httpRemote'
import { createSync, type Binding, type Remote, type RemoteDoc } from './sync'
import { pickSynced, withSynced, DEFAULT_SETTINGS } from '../settings/settings'

/** A server holding documents, with a way to make the next save fail. */
function fakeServer() {
  const docs = new Map<string, RemoteDoc>()
  const log: string[] = []
  let failNext: ApiError | null = null
  const remote: Remote = {
    get: async (key) => { log.push(`get ${key}`); const d = docs.get(key); return d ? { ...d } : null },
    put: async (key, data, base) => {
      log.push(`put ${key} ${base}`)
      if (failNext) { const e = failNext; failNext = null; throw e }
      const cur = docs.get(key)?.version ?? 0
      if (cur !== base) throw new ApiError('conflict', 'stale')
      const doc = { version: cur + 1, data }
      docs.set(key, doc)
      return { ...doc }
    },
    remove: async (key) => { log.push(`remove ${key}`); docs.delete(key) },
  }
  return { docs, log, remote, failOnce: (e: ApiError) => { failNext = e } }
}

/** A store with one value per local id, standing in for a real store. */
function fakeStore(key = 'k', empty: unknown = { n: 0 }) {
  const values = new Map<string | null, unknown>()
  const applied: unknown[] = []
  const binding: Binding = {
    key,
    read: (id) => values.get(id) ?? empty,
    apply: (id, raw) => { applied.push(raw); values.set(id, raw ?? empty) },
    isEmpty: (raw) => JSON.stringify(raw) === JSON.stringify(empty),
  }
  return { values, applied, binding }
}

/** Timers that only fire when told to. */
function manualTimers() {
  const pending = new Map<number, () => void>()
  let next = 1
  return {
    setTimer: (fn: () => void) => { pending.set(next, fn); return next++ },
    clearTimer: (h: unknown) => { pending.delete(h as number) },
    fire: async () => { const fns = [...pending.values()]; pending.clear(); fns.forEach((f) => f()); await tick() },
    count: () => pending.size,
  }
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

const setup = (store = fakeStore()) => {
  const server = fakeServer()
  const timers = manualTimers()
  let remote: Remote | null = server.remote
  const sync = createSync({ remote: () => remote, ...timers })
  sync.register(store.binding)
  return { server, timers, sync, store, setRemote: (r: Remote | null) => { remote = r } }
}

describe('pull', () => {
  it('tells a store when the server has answered, whether or not a copy was saved', async () => {
    for (const saved of [true, false]) {
      const store = fakeStore()
      const told: (string | null)[] = []
      store.binding.pulled = (id) => { told.push(id) }
      const t = setup(store)
      if (saved) t.server.docs.set('k', { version: 1, data: { n: 0 } })   // same as the device copy: nothing is applied, yet the answer has come
      t.sync.setOwner('u1', 'p1')
      expect(told).toEqual([])
      await t.sync.pull()
      expect(told).toEqual(['p1'])
    }
  })

  it('takes the server copy on a new device', async () => {
    const t = setup()
    t.server.docs.set('k', { version: 3, data: { n: 7 } })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    expect(t.store.values.get('p1')).toEqual({ n: 7 })
  })

  it('does not import this device\'s copy when the server has none: the server is the source', async () => {
    const t = setup()
    t.store.values.set('p1', { n: 4 })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    expect(t.server.docs.size).toBe(0)
    expect(t.store.values.get('p1')).toEqual({ n: 0 })
  })

  it('still sends a change made before the first answer arrived', async () => {
    const t = setup()
    t.sync.setOwner('u1', 'p1')
    t.store.values.set('p1', { n: 4 })
    t.sync.changed('k', 'p1')
    await t.sync.pull()
    expect(t.server.docs.get('k')).toEqual({ version: 1, data: { n: 4 } })
  })

  it('sends nothing when this device has nothing either', async () => {
    const t = setup()
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    expect(t.server.docs.size).toBe(0)
  })

  it('never sends the shared copy of accounts with no persona, and resets it instead', async () => {
    const t = setup()
    t.store.values.set(null, { n: 9 })   // left by someone else on this device
    t.sync.setOwner('u2', null)
    await t.sync.pull()
    expect(t.server.docs.size).toBe(0)
    expect(t.store.values.get(null)).toEqual({ n: 0 })
  })

  it('does nothing without a remote (mock mode) or a signed-in person', async () => {
    const t = setup()
    t.setRemote(null)
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    t.sync.changed('k', 'p1')
    expect(t.timers.count()).toBe(0)
    t.setRemote(t.server.remote)
    t.sync.setOwner(null, null)
    t.sync.changed('k', null)
    expect(t.timers.count()).toBe(0)
    expect(t.server.log).toEqual([])
  })

  it('fetches again later and applies a newer copy from another device', async () => {
    const t = setup()
    t.server.docs.set('k', { version: 1, data: { n: 1 } })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    t.server.docs.set('k', { version: 2, data: { n: 2 } })
    await t.sync.pull()
    expect(t.store.values.get('p1')).toEqual({ n: 2 })
  })

  it('keeps going when the server is unreachable and reports it', async () => {
    const t = setup()
    t.setRemote({ get: async () => { throw new ApiError('network') }, put: t.server.remote.put, remove: t.server.remote.remove })
    t.sync.setOwner('u1', 'p1')
    await expect(t.sync.pull()).resolves.toBeUndefined()
    expect(t.sync.status()).toBe('error')
  })
})

describe('push', () => {
  const ready = async (t: ReturnType<typeof setup>) => {
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
  }

  it('sends a burst of changes as one save after the pause', async () => {
    const t = setup()
    await ready(t)
    t.store.values.set('p1', { n: 1 })
    t.sync.changed('k', 'p1')
    t.store.values.set('p1', { n: 2 })
    t.sync.changed('k', 'p1')
    expect(t.timers.count()).toBe(1)
    await t.timers.fire()
    expect(t.server.docs.get('k')).toEqual({ version: 1, data: { n: 2 } })
    expect(t.server.log.filter((l) => l.startsWith('put'))).toHaveLength(1)
    expect(t.sync.status()).toBe('idle')
  })

  it('ignores changes for someone who is not the signed-in person', async () => {
    const t = setup()
    await ready(t)
    t.sync.changed('k', 'someone-else')
    expect(t.timers.count()).toBe(0)
  })

  it('on a clash, fetches the newer version and sends this device\'s copy on top of it', async () => {
    const t = setup()
    await ready(t)
    t.server.docs.set('k', { version: 5, data: { n: 50 } })   // another device saved
    t.store.values.set('p1', { n: 8 })
    t.sync.changed('k', 'p1')
    await t.timers.fire()
    expect(t.server.docs.get('k')).toEqual({ version: 6, data: { n: 8 } })
  })

  it('on a clash uses the store\'s merge when it has one', async () => {
    const store = fakeStore()
    store.binding.merge = (remote, local) => ({ n: (remote as { n: number }).n + (local as { n: number }).n })
    const t = setup(store)
    await ready(t)
    t.server.docs.set('k', { version: 2, data: { n: 10 } })
    store.values.set('p1', { n: 1 })
    t.sync.changed('k', 'p1')
    await t.timers.fire()
    expect(t.server.docs.get('k')?.data).toEqual({ n: 11 })
    expect(store.values.get('p1')).toEqual({ n: 11 })
  })

  it('keeps a change that could not be sent and sends it on the next pull', async () => {
    const t = setup()
    await ready(t)
    t.store.values.set('p1', { n: 3 })
    t.server.failOnce(new ApiError('offline'))
    t.sync.changed('k', 'p1')
    await t.timers.fire()
    expect(t.sync.status()).toBe('error')
    expect(t.server.docs.size).toBe(0)
    await t.sync.pull()
    expect(t.server.docs.get('k')?.data).toEqual({ n: 3 })
    expect(t.sync.status()).toBe('idle')
  })

  it('a change made before the first pull finishes is kept and sent, not overwritten', async () => {
    const t = setup()
    t.server.docs.set('k', { version: 4, data: { n: 40 } })
    t.sync.setOwner('u1', 'p1')
    t.store.values.set('p1', { n: 5 })
    t.sync.changed('k', 'p1')   // before pulled: marked, not sent
    await t.sync.pull()
    expect(t.server.docs.get('k')).toEqual({ version: 5, data: { n: 5 } })
  })

  it('stops quietly when the person changes mid-flight', async () => {
    const t = setup()
    await ready(t)
    t.store.values.set('p1', { n: 6 })
    t.sync.changed('k', 'p1')
    t.sync.setOwner('u9', 'p9')
    await t.timers.fire()
    expect(t.server.docs.size).toBe(0)
  })

  it('the same person again (a token refresh) changes nothing', () => {
    const t = setup()
    expect(t.sync.setOwner('u1', 'p1')).toBe(true)
    expect(t.sync.setOwner('u1', 'p1')).toBe(false)
    expect(t.sync.setOwner('u2', 'p1')).toBe(true)
  })

  it('flush sends waiting changes at once', async () => {
    const t = setup()
    await ready(t)
    t.store.values.set('p1', { n: 2 })
    t.sync.changed('k', 'p1')
    await t.sync.flush()
    expect(t.server.docs.get('k')?.data).toEqual({ n: 2 })
    expect(t.timers.count()).toBe(0)
  })
})

describe('a key that needs the guest\'s agreement', () => {
  const gated = () => {
    let on = false
    const store = fakeStore('m')
    store.binding.enabled = () => on
    const t = setup(store)
    return { ...t, allow: (v: boolean) => { on = v } }
  }

  it('sends and fetches nothing while it is off', async () => {
    const t = gated()
    t.store.values.set('p1', { n: 5 })
    t.server.docs.set('m', { version: 2, data: { n: 9 } })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    t.sync.changed('m', 'p1')
    await t.timers.fire()
    expect(t.server.log).toEqual([])
    expect(t.store.values.get('p1')).toEqual({ n: 5 })
  })

  it('sends this device\'s copy once it is turned on', async () => {
    const t = gated()
    t.store.values.set('p1', { n: 5 })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    t.allow(true)
    await t.sync.pull()
    expect(t.server.docs.get('m')).toEqual({ version: 1, data: { n: 5 } })
  })

  it('deletes the server copy and stops sending when it is turned off', async () => {
    const t = gated()
    t.allow(true)
    t.server.docs.set('m', { version: 1, data: { n: 5 } })
    t.store.values.set('p1', { n: 5 })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    expect(t.server.docs.has('m')).toBe(true)
    t.allow(false)
    expect(await t.sync.withdraw('m')).toBe(true)
    expect(t.server.docs.has('m')).toBe(false)
    t.sync.changed('m', 'p1')
    await t.timers.fire()
    expect(t.server.docs.has('m')).toBe(false)
  })

  it('retries the deletion at the next pull when it could not be made', async () => {
    const t = gated()
    t.allow(true)
    t.server.docs.set('m', { version: 1, data: { n: 5 } })
    t.store.values.set('p1', { n: 5 })
    t.sync.setOwner('u1', 'p1')
    await t.sync.pull()
    t.allow(false)
    const real = t.server.remote.remove
    t.server.remote.remove = async () => { throw new Error('offline') }
    expect(await t.sync.withdraw('m')).toBe(false)
    expect(t.server.docs.has('m')).toBe(true)
    t.server.remote.remove = real
    await t.sync.pull()
    expect(t.server.docs.has('m')).toBe(false)
  })

  it('takes a consent that arrives in the same pull from another key before looking at the gated one', async () => {
    const t = gated()
    t.server.docs.set('m', { version: 1, data: { n: 8 } })
    t.sync.setOwner('u1', 'p1')
    const consent = fakeStore('c')
    consent.binding.apply = () => t.allow(true)
    t.sync.register(consent.binding)
    t.server.docs.set('c', { version: 1, data: { n: 1 } })
    await t.sync.pull()
    expect(t.store.values.get('p1')).toEqual({ n: 8 })
  })
})

describe('http remote', () => {
  it('reads and writes /me/state/{key}', async () => {
    const calls: string[] = []
    const http = {
      get: async <T,>(path: string) => { calls.push(`GET ${path}`); return (path.endsWith('none') ? null : { key: 'k', version: 2, data: { a: 1 }, updatedAt: 1 }) as T },
      put: async <T,>(path: string, body?: unknown) => { calls.push(`PUT ${path} ${JSON.stringify(body)}`); return { key: 'k', version: 3, data: { a: 2 }, updatedAt: 2 } as T },
      post: async () => { throw new Error('unused') }, patch: async () => { throw new Error('unused') }, delete: async <T,>(path: string) => { calls.push(`DELETE ${path}`); return undefined as T },
    }
    const remote = createHttpRemote(http as never)
    expect(await remote.get('settings')).toEqual({ version: 2, data: { a: 1 } })
    expect(await remote.get('none')).toBeNull()
    expect(await remote.put('settings', { a: 2 }, 2)).toEqual({ version: 3, data: { a: 2 } })
    await remote.remove('memory')
    expect(calls).toEqual(['GET /me/state/settings', 'GET /me/state/none', 'PUT /me/state/settings {"data":{"a":2},"baseVersion":2}', 'DELETE /me/state/memory'])
  })

  it('uses the booking routes for a shared document and finds the current trip', async () => {
    const calls: string[] = []
    const http = {
      get: async <T,>(path: string) => {
        calls.push(`GET ${path}`)
        return (path === '/trips' ? { upcoming: [{ kind: 'next', number: 'PC1' }, { kind: 'current', number: 'PC2' }] } : { key: 'port', version: 1, data: {}, updatedAt: 1 }) as T
      },
      put: async <T,>(path: string) => { calls.push(`PUT ${path}`); return { key: 'port', version: 2, data: {}, updatedAt: 2 } as T },
      post: async () => { throw new Error('unused') }, patch: async () => { throw new Error('unused') }, delete: async <T,>(path: string) => { calls.push(`DELETE ${path}`); return undefined as T },
    }
    const remote = createHttpRemote(http as never)
    expect(await remote.bookingNumber!()).toBe('PC2')
    await remote.get('port', 'PC2')
    await remote.put('party', {}, 1, 'PC 2')
    await remote.remove('party', 'PC2')
    expect(calls).toEqual(['GET /trips', 'GET /bookings/PC2/state/port', 'PUT /bookings/PC%202/state/party', 'DELETE /bookings/PC2/state/party'])
  })

  it('says a person with no trip has no booking', async () => {
    const http = { get: async () => { throw new ApiError('notFound') } }
    expect(await createHttpRemote(http as never).bookingNumber!()).toBeNull()
  })
})

describe('documents shared by a booking', () => {
  /** A server that keeps user and booking documents apart, for one booking. */
  function twoScopes(number: string | null = 'PC1') {
    const user = new Map<string, RemoteDoc>()
    const shared = new Map<string, RemoteDoc>()
    const log: string[] = []
    let forbid = false
    const table = (booking?: string) => (booking === undefined ? user : shared)
    const remote: Remote = {
      get: async (key, booking) => { log.push(`get ${booking ?? 'me'} ${key}`); const d = table(booking).get(key); return d ? { ...d } : null },
      put: async (key, data, base, booking) => {
        log.push(`put ${booking ?? 'me'} ${key} ${base}`)
        if (forbid && booking !== undefined) throw new ApiError('forbidden')
        const cur = table(booking).get(key)?.version ?? 0
        if (cur !== base) throw new ApiError('conflict', 'stale')
        const doc = { version: cur + 1, data }
        table(booking).set(key, doc)
        return { ...doc }
      },
      remove: async () => {},
      bookingNumber: async () => number,
    }
    return { user, shared, log, remote, forbid: () => { forbid = true } }
  }

  /** A booking store keyed by a booker, read through a persona (the persona 'priya' belongs to the booker 'daniel'). */
  function bookingStore() {
    const values = new Map<string | null, unknown>()
    const binding: Binding = {
      key: 'party', scope: 'booking', localFor: (id) => (id === 'priya' ? 'daniel' : id),
      read: (id) => values.get(id) ?? { n: 0 }, apply: (id, raw) => { values.set(id, raw ?? { n: 0 }) },
      isEmpty: (raw) => JSON.stringify(raw) === '{"n":0}',
      merge: (remote, local) => ({ n: Math.max((remote as { n: number }).n, (local as { n: number }).n) }),
    }
    return { values, binding }
  }

  it('sends a change to the booking, not the person, under the booker\'s device copy', async () => {
    const server = twoScopes()
    const store = bookingStore()
    const timers = manualTimers()
    const sync = createSync({ remote: () => server.remote, ...timers })
    sync.register(store.binding)
    sync.setOwner('u1', 'priya')
    await sync.pull()
    store.values.set('daniel', { n: 4 })
    sync.changed('party', 'daniel')
    await timers.fire()
    expect(server.shared.get('party')?.data).toEqual({ n: 4 })
    expect(server.user.size).toBe(0)
    expect(server.log).toContain('put PC1 party 0')
    sync.changed('party', 'priya')   // a change for some other id is not this booking's
    expect(timers.count()).toBe(0)
  })

  it('takes the booking\'s document on a new device, and merges when two adults clash', async () => {
    const server = twoScopes()
    server.shared.set('party', { version: 3, data: { n: 7 } })
    const store = bookingStore()
    const timers = manualTimers()
    const sync = createSync({ remote: () => server.remote, ...timers })
    sync.register(store.binding)
    sync.setOwner('u1', 'priya')
    await sync.pull()
    expect(store.values.get('daniel')).toEqual({ n: 7 })

    store.values.set('daniel', { n: 8 })
    sync.changed('party', 'daniel')
    server.shared.set('party', { version: 4, data: { n: 9 } })   // another adult saved first
    await timers.fire()
    expect(server.shared.get('party')).toEqual({ version: 5, data: { n: 9 } })
    expect(store.values.get('daniel')).toEqual({ n: 9 })
  })

  it('leaves a child\'s edits on the device without an error', async () => {
    const server = twoScopes()
    server.forbid()
    const store = bookingStore()
    const timers = manualTimers()
    const sync = createSync({ remote: () => server.remote, ...timers })
    sync.register(store.binding)
    sync.setOwner('u1', 'priya')
    await sync.pull()
    store.values.set('daniel', { n: 2 })
    sync.changed('party', 'daniel')
    await timers.fire()
    expect(sync.status()).toBe('idle')
    expect(server.shared.size).toBe(0)
  })

  it('does nothing for shared documents when the person has no booking', async () => {
    const server = twoScopes(null)
    const store = bookingStore()
    const timers = manualTimers()
    const sync = createSync({ remote: () => server.remote, ...timers })
    sync.register(store.binding)
    sync.setOwner('u1', 'priya')
    await sync.pull()
    store.values.set('daniel', { n: 2 })
    sync.changed('party', 'daniel')
    await timers.fire()
    expect(server.log.filter((l) => l.includes('party'))).toEqual([])
  })
})

describe('account-level settings', () => {
  it('sends only the fields that follow the guest', () => {
    const s = { ...DEFAULT_SETTINGS, theme: 'dark' as const, textSize: 'large' as never, calm: true }
    expect(Object.keys(pickSynced(s)).sort()).toEqual(['calm', 'captions', 'chargeCheck', 'nudgesPerDay', 'region', 'simple', 'syncPrivate', 'units'])
    expect(pickSynced(s).calm).toBe(true)
  })

  it('lays a server copy over this device\'s settings without touching its display choices', () => {
    const device = { ...DEFAULT_SETTINGS, theme: 'dark' as const, contrast: 'high' as const }
    const merged = withSynced(device, { calm: true, simple: true, theme: 'light', units: 'nonsense' })
    expect(merged.calm).toBe(true)
    expect(merged.simple).toBe(true)
    expect(merged.theme).toBe('dark')
    expect(merged.contrast).toBe('high')
    expect(merged.units).toBe(device.units)
  })
})
