import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../domain/contacts'
import { balances, computeEntitlements, sourceOf } from '../domain/entitlements'
import { partyOf, personaById, visibleTo, type PersonaId } from '../domain/personas'
import { isSavable, toggleKey } from '../domain/favourites'
import { fromPrice, quote } from '../domain/pricing'
import { portAt, SAILINGS, sailingById } from '../domain/sailings'
import { activeFaults, targetMatches } from '../domain/scenarios'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { clockNow } from '../domain/clock'
import type { Channel } from '../data/sync'
import type { DataRecord, DataStore } from '../data/store'
import type { DemoState } from '../demo/state'
import { ApiError } from './errors'
import { createRng, type Rng } from './rng'
import type { Api, Item, Message } from './types'

export interface MockContext {
  store: DataStore
  /** The current demo controls (clock, scenarios, network); read on every call so changes apply at once. */
  demo: () => DemoState
  /** Who is signed in, or null. */
  persona: () => PersonaId | null
  /** Real time in ms; replaced in tests. */
  realNow?: () => number
  /** Waits; replaced in tests so latency is recorded, not slept. */
  sleep?: (ms: number) => Promise<void>
  channel?: Channel
}

const defaultSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

/**
 * The mock service. Every call goes through one gate: offline switch, seeded delay, scenario faults ("the first call
 * fails, the retry works"), then seeded random failure. The same seed and the same calls always give the same outcome.
 */
export function createMockApi(ctx: MockContext): Api {
  const realNow = ctx.realNow ?? Date.now
  const sleep = ctx.sleep ?? defaultSleep
  let signature = ''
  let rng: Rng = createRng(0)
  let failed = new Map<string, number>()

  const who = (): PersonaId => {
    const id = ctx.persona()
    if (!id) throw new ApiError('forbidden', 'Not signed in')
    return id
  }
  const now = () => clockNow(ctx.demo().clock, realNow())

  async function gate(call: string): Promise<void> {
    const demo = ctx.demo()
    const sig = `${demo.network.seed}|${demo.scenarios.join(',')}`
    if (sig !== signature) { signature = sig; rng = createRng(demo.network.seed); failed = new Map() }
    if (demo.network.offline) throw new ApiError('offline')
    const rules = activeFaults(demo.scenarios).filter((r) => targetMatches(r.target, call))
    const extra = rules.reduce((sum, r) => sum + (r.delayMs ?? 0), 0)
    await sleep(rng.between(demo.network.latencyMinMs, demo.network.latencyMaxMs) + extra)
    for (const r of rules) {
      const n = failed.get(r.id) ?? 0
      if (n < r.failTimes) { failed.set(r.id, n + 1); throw new ApiError(r.code) }
    }
    if (demo.network.failureRate > 0 && rng.next() < demo.network.failureRate) throw new ApiError('network')
  }

  const run = async <T>(call: string, fn: () => Promise<T> | T): Promise<T> => { await gate(call); return fn() }

  const toItem = (r: DataRecord): Item => ({ id: r.id, at: r.updatedAt, data: r.data })
  const save = async (kind: string, owner: string, id: string, data: unknown): Promise<Item> => {
    const record: DataRecord = { kind, owner, id, updatedAt: now(), data }
    await ctx.store.put(record)
    ctx.channel?.post({ type: 'records', kind, owner })
    return toItem(record)
  }
  const mine = async (kind: string) => (await ctx.store.list(kind, who())).map(toItem)
  let counter = 0
  const newId = (prefix: string) => `${prefix}-${realNow().toString(36)}-${(counter++).toString(36)}`

  const favourites = async (): Promise<string[]> => {
    const record = await ctx.store.get('favourites', who(), 'list')
    const keys = (record?.data as { keys?: unknown } | undefined)?.keys
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : []
  }

  const checkinOpensAt = () => {
    const s = sailingById(ctx.demo().sailingId)!
    return zonedToEpoch(addDays(s.departure, -3), '00:00', 'America/New_York')
  }
  const checkinStatus = async () => {
    const done = await ctx.store.get('checkin', who(), 'status')
    const opensAt = checkinOpensAt()
    return { state: done ? ('done' as const) : now() >= opensAt ? ('open' as const) : ('notOpen' as const), opensAt }
  }

  return {
    auth: {
      me: () => run('auth.me', () => {
        const p = personaById(who())!
        return { personaId: p.id, name: p.name, tier: p.tier }
      }),
    },
    bookings: {
      get: () => run('bookings.get', () => {
        const p = personaById(who())!
        return { personaId: p.id, bookerId: p.booker, sailingId: ctx.demo().sailingId, party: partyOf(p.id).map((x) => x.id), stateroom: p.stateroom, tier: p.tier, package: p.package }
      }),
      sailings: () => run('bookings.sailings', () => SAILINGS.map((s) => ({ id: s.id, departure: s.departure }))),
    },
    checkin: {
      status: () => run('checkin.status', checkinStatus),
      submit: () => run('checkin.submit', async () => {
        const status = await checkinStatus()
        if (status.state === 'notOpen') throw new ApiError('conflict', 'Check-in is not open yet')
        await save('checkin', who(), 'status', { done: true })
        return { ...status, state: 'done' as const }
      }),
    },
    dining: {
      list: () => run('dining.list', () => mine('dining')),
      reschedule: (id, to) => run('dining.reschedule', async () => {
        const existing = await ctx.store.get('dining', who(), id)
        if (!existing) throw new ApiError('notFound')
        return save('dining', who(), id, { ...(existing.data as object), time: to })
      }),
    },
    queues: { list: () => run('queues.list', () => mine('queue')) },
    orders: {
      list: () => run('orders.list', () => mine('order')),
      place: (items) => run('orders.place', () => {
        if (items.length === 0) throw new ApiError('invalid', 'An order needs at least one item')
        return save('order', who(), newId('order'), { items, status: 'received' })
      }),
    },
    messages: {
      list: () => run('messages.list', async () => {
        const ids = [who(), ...visibleTo(who()).map((p) => p.id)]
        const lists = await Promise.all(ids.map((id) => ctx.store.list('message', id)))
        return lists.flat().sort((a, b) => a.updatedAt - b.updatedAt).map((r): Message => ({ id: r.id, from: r.owner as PersonaId, text: (r.data as { text: string }).text, at: r.updatedAt }))
      }),
      send: (text) => run('messages.send', async () => {
        if (!text.trim()) throw new ApiError('invalid', 'A message needs some text')
        const item = await save('message', who(), newId('msg'), { text: text.trim() })
        return { id: item.id, from: who(), text: text.trim(), at: item.at }
      }),
    },
    photos: {
      list: () => run('photos.list', () => mine('photo')),
      download: (id) => run('photos.download', async () => {
        const photo = await ctx.store.get('photo', who(), id)
        if (!photo) throw new ApiError('notFound')
        return toItem(photo)
      }),
    },
    folio: {
      entitlements: () => run('folio.entitlements', () => {
        const e = computeEntitlements(sourceOf(personaById(who())!))
        return { entitlements: e, balances: balances(e) }
      }),
    },
    requests: {
      list: () => run('requests.list', () => mine('request')),
      create: (kind, note) => run('requests.create', () => save('request', who(), newId('req'), { kind, note, status: 'received' })),
    },
    ports: {
      today: () => run('ports.today', () => portAt(sailingById(ctx.demo().sailingId)!, now())),
    },
    discover: {
      offers: () => run('discover.offers', () => SAILINGS.map((s) => ({ id: s.id, departure: s.departure, holiday: !!s.holiday, from: fromPrice(s.id)! }))),
      quote: (sailingId, category, guests) => run('discover.quote', () => {
        const q = quote(sailingId, category, guests)
        if (!q) throw new ApiError('invalid', 'Unknown sailing, room type or number of guests')
        return q
      }),
      favourites: () => run('discover.favourites', favourites),
      toggleFavourite: (key) => run('discover.toggleFavourite', async () => {
        if (!isSavable(key)) throw new ApiError('invalid', 'Not something that can be saved')
        const next = toggleKey(await favourites(), key)
        await save('favourites', who(), 'list', { keys: next })
        return next
      }),
    },
    help: {
      contacts: () => run('help.contacts', () => ({ guestServices: GUEST_SERVICES_NUMBER, emergency: EMERGENCY_NUMBER })),
    },
  }
}
