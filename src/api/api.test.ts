import { describe, expect, it } from 'vitest'
import { createMockAuthProvider, LAST_PERSONA_KEY, SESSION_KEY } from '../auth/mockProvider'
import { AuthError } from '../auth/provider'
import { createMemoryStore } from '../data/store'
import { defaultDemoState, normalizeDemoState, type DemoState } from '../demo/state'
import { zonedToEpoch } from '../domain/timezones'
import type { PersonaId } from '../domain/personas'
import { clockAt } from '../domain/clock'
import { ApiError, isApiError } from './errors'
import { createMockApi } from './mock'
import { createRng } from './rng'
import type { Api } from './types'

const NOW = Date.UTC(2027, 2, 1)

function setup(over: Partial<DemoState> = {}, as: PersonaId | null = 'gerald') {
  let demo: DemoState = { ...defaultDemoState(NOW), ...over }
  demo = { ...demo, clock: over.clock ?? clockAt(demo.clock.anchorDemo, NOW, 0) }
  let who = as
  const waits: number[] = []
  const store = createMemoryStore()
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => NOW, sleep: async (ms) => { waits.push(ms) } })
  return { api, store, waits, set: (d: Partial<DemoState>) => { demo = { ...demo, ...d } }, as: (p: PersonaId | null) => { who = p } }
}
const failure = async (p: Promise<unknown>) => { try { await p } catch (e) { return e } return null }

describe('seeded random numbers', () => {
  it('repeat exactly for the same seed and differ for another', () => {
    const run = (seed: number) => { const r = createRng(seed); return Array.from({ length: 5 }, () => r.next()) }
    expect(run(7)).toEqual(run(7))
    expect(run(7)).not.toEqual(run(8))
    expect(run(7).every((x) => x >= 0 && x < 1)).toBe(true)
    const r = createRng(1)
    for (let i = 0; i < 50; i++) expect([3, 4, 5]).toContain(r.between(3, 5))
  })
})

describe('mock API gate', () => {
  it('answers with the signed-in person’s booking', async () => {
    const { api } = setup()
    const b = await api.bookings.get()
    expect(b).toMatchObject({ personaId: 'gerald', bookerId: 'gerald', package: 'none', tier: 'platinum' })
    expect(b.party).toEqual(['gerald'])
  })
  it('refuses when nobody is signed in', async () => {
    const { api } = setup({}, null)
    expect(await failure(api.bookings.get())).toMatchObject({ code: 'forbidden' })
  })
  it('fails every call at once when the network is switched off', async () => {
    const s = setup()
    s.set({ network: { ...defaultDemoState(NOW).network, offline: true } })
    const e = await failure(s.api.help.contacts())
    expect(isApiError(e) && e.code === 'offline' && e.retryable).toBe(true)
    expect(s.waits).toEqual([])
  })
  it('waits within the configured delay range, and the same seed gives the same waits', async () => {
    const waitsFor = async () => {
      const s = setup({ network: { ...defaultDemoState(NOW).network, latencyMinMs: 100, latencyMaxMs: 200, seed: 5 } })
      for (let i = 0; i < 6; i++) await s.api.help.contacts()
      return s.waits
    }
    const a = await waitsFor()
    expect(a.every((w) => w >= 100 && w <= 200)).toBe(true)
    expect(await waitsFor()).toEqual(a)
  })
  it('replays random failures identically for a seed', async () => {
    const outcomes = async (seed: number) => {
      const s = setup({ network: { ...defaultDemoState(NOW).network, failureRate: 0.5, seed } })
      const out: boolean[] = []
      for (let i = 0; i < 20; i++) out.push((await failure(s.api.help.contacts())) === null)
      return out
    }
    const a = await outcomes(11)
    expect(a).toContain(true)
    expect(a).toContain(false)
    expect(await outcomes(11)).toEqual(a)
  })
})

describe('scenario faults', () => {
  it('fails the first booking calls and then recovers', async () => {
    const s = setup({ scenarios: ['bookingLag'] })
    expect(await failure(s.api.bookings.get())).toMatchObject({ code: 'notFound', retryable: true })
    expect(await failure(s.api.bookings.get())).toMatchObject({ code: 'notFound' })
    expect((await s.api.bookings.get()).personaId).toBe('gerald')
    expect(await failure(s.api.help.contacts())).toBeNull()
  })
  it('starts counting again when the scenario is switched off and on', async () => {
    const s = setup({ scenarios: ['photoFail'] })
    expect(await failure(s.api.photos.download('x'))).toMatchObject({ code: 'network' })
    s.set({ scenarios: [] })
    await s.api.photos.list()
    s.set({ scenarios: ['photoFail'] })
    expect(await failure(s.api.photos.download('x'))).toMatchObject({ code: 'network' })
  })
  it('holds a slow chat call back and then times out once', async () => {
    const s = setup({ scenarios: ['chatSlow'] })
    expect(await failure(s.api.messages.send('hello'))).toMatchObject({ code: 'timeout' })
    expect(s.waits.at(-1)!).toBeGreaterThanOrEqual(6000)
    expect((await s.api.messages.send('hello')).text).toBe('hello')
  })
  it('keeps everything offline with the dead-phone scenario', async () => {
    const s = setup({ scenarios: ['phoneDead'] })
    for (let i = 0; i < 3; i++) expect(await failure(s.api.folio.entitlements())).toMatchObject({ code: 'offline' })
  })
})

describe('mock API behaviour', () => {
  it('opens check-in three days before departure and will not finish it until every step is done', async () => {
    const before = zonedToEpoch('2027-03-17', '12:00', 'America/New_York')
    const s = setup({ clock: clockAt(before, NOW, 0) })
    expect((await s.api.checkin.status()).state).toBe('notOpen')
    expect(await failure(s.api.checkin.submit())).toMatchObject({ code: 'conflict' })
    s.set({ clock: clockAt(zonedToEpoch('2027-03-19', '12:00', 'America/New_York'), NOW, 0) })
    expect((await s.api.checkin.status()).state).toBe('open')
    expect(await failure(s.api.checkin.submit())).toMatchObject({ code: 'conflict', message: 'incomplete' })
  })
  it('keeps each booking’s orders to itself', async () => {
    const s = setup({ clock: clockAt(zonedToEpoch('2027-03-23', '12:00', 'America/New_York'), NOW, 0) })
    await s.api.orders.place({ kind: 'delivery', lines: [{ itemId: 'fries', qty: 1, extras: [], guest: 'gerald' }], location: { kind: 'cabin' }, tip: 0 })
    expect(await s.api.orders.list()).toHaveLength(1)
    s.as('maria')
    expect(await s.api.orders.list()).toHaveLength(0)
    expect(await failure(s.api.orders.place({ kind: 'delivery', lines: [], location: { kind: 'cabin' }, tip: 0 }))).toMatchObject({ code: 'invalid', retryable: false })
  })
  it('shares chat between the two families only', async () => {
    const s = setup({}, 'daniel')
    await s.api.messages.send('  Dinner at 6?  ')
    s.as('marcus')
    expect((await s.api.messages.list()).map((m) => [m.from, m.text])).toEqual([['daniel', 'Dinner at 6?']])
    s.as('gerald')
    expect(await s.api.messages.list()).toEqual([])
  })
  it('reschedules only reservations that exist', async () => {
    const s = setup()
    expect(await failure(s.api.dining.reschedule('nope', '19:00'))).toMatchObject({ code: 'notFound' })
    await s.store.put({ kind: 'dining', owner: 'gerald', id: 'd1', updatedAt: 1, data: { venue: 'Crown Grill', time: '18:00' } })
    expect((await s.api.dining.reschedule('d1', '19:30')).data).toEqual({ venue: 'Crown Grill', time: '19:30' })
  })
  it('tells the entitlement engine’s story for the signed-in person', async () => {
    const s = setup({}, 'alexander')
    const { entitlements, balances } = await s.api.folio.entitlements()
    expect(entitlements.drinkCapUsd).toBe(20)
    expect(balances.specialtyMeals).toEqual({ total: 4, used: 0, remaining: 4 })
  })
  it('says where the ship is on the demo clock', async () => {
    const s = setup({ clock: clockAt(zonedToEpoch('2027-03-24', '10:00', 'America/Belize'), NOW, 0) })
    expect(await s.api.ports.today()).toEqual({ port: 'belize', day: 4 })
  })
  it('exposes the same groups the contract promises', () => {
    const { api } = setup()
    const groups: (keyof Api)[] = ['auth', 'bookings', 'checkin', 'boarding', 'dining', 'queues', 'orders', 'messages', 'photos', 'folio', 'requests', 'ports', 'onboard', 'service', 'discover', 'account', 'trips', 'payments', 'documents', 'notifications', 'support', 'booking', 'plan', 'help', 'family', 'health', 'room', 'laundry', 'wifi', 'disembark', 'cases', 'post', 'budget', 'shows', 'waits', 'updates', 'privacy', 'aboard', 'ahead']
    expect(Object.keys(api).sort()).toEqual([...groups].sort())
  })
  it('classes errors', () => {
    expect(new ApiError('conflict').retryable).toBe(false)
    expect(new ApiError('timeout').retryable).toBe(true)
  })
})

describe('mock sign-in', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m } }
  it('signs in as any of the twelve and remembers it per tab and per device', async () => {
    const session = memory(); const local = memory()
    const auth = createMockAuthProvider({ session, local, now: () => 42 })
    expect(auth.identities()).toHaveLength(12)
    expect(auth.current()).toBeNull()
    await auth.signIn({ method: 'demo', personaId: 'linda' })
    expect(auth.current()).toEqual({ personaId: 'linda', signedInAt: 42, method: 'demo' })
    expect(JSON.parse(session.m.get(SESSION_KEY)!).personaId).toBe('linda')
    expect(local.m.get(LAST_PERSONA_KEY)).toBe('linda')
    expect(createMockAuthProvider({ session, local }).current()?.personaId).toBe('linda')
    expect(createMockAuthProvider({ session: memory(), local }).current()?.personaId).toBe('linda')
  })
  it('refuses strangers and other methods, and signs out', async () => {
    const auth = createMockAuthProvider({ session: memory(), local: memory() })
    await expect(auth.signIn({ method: 'demo', personaId: 'mallory' })).rejects.toMatchObject({ code: 'unknownIdentity' })
    await expect(auth.signIn({ method: 'password' } as never)).rejects.toBeInstanceOf(AuthError)
    await auth.signIn({ method: 'demo', personaId: 'maria' })
    let calls = 0
    auth.subscribe(() => calls++)
    await auth.signOut()
    expect(auth.current()).toBeNull()
    expect(calls).toBe(1)
  })
  it('ignores damaged stored sessions', () => {
    const session = memory(); session.m.set(SESSION_KEY, '{"personaId":"nobody"}')
    expect(createMockAuthProvider({ session, local: memory() }).current()).toBeNull()
  })
})

describe('demo state', () => {
  it('opens on the reference sailing two weeks out', () => {
    const d = defaultDemoState(NOW)
    expect(d.sailingId).toBe('sun-2027-03-21')
    expect(d.scenarios).toEqual([])
  })
  it('repairs anything damaged and keeps what is good', () => {
    const d = normalizeDemoState({ sailingId: 'bogus', scenarios: ['bookingLag', 'nope', 'bookingLag'], phoneZone: 'Mars/Base', network: { offline: true, failureRate: 7, latencyMinMs: 900, latencyMaxMs: 100 } }, NOW)
    expect(d.sailingId).toBe('sun-2027-03-21')
    expect(d.scenarios).toEqual(['bookingLag'])
    expect(d.phoneZone).toBe('America/Chicago')
    expect(d.network).toMatchObject({ offline: true, failureRate: 1, latencyMinMs: 100, latencyMaxMs: 900 })
    expect(normalizeDemoState(null, NOW)).toEqual(defaultDemoState(NOW))
  })
})
