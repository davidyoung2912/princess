import { afterEach, describe, expect, it } from 'vitest'
import { followsServer, markAccount, normalizeContext, partyPeople, personFirstName, personFrom, refreshContext, serverNow, setContext } from './context'
import { sailingFor, upcomingSailing } from './sailing'

const wire = (over: Record<string, unknown> = {}) => ({
  person: { id: 'u-1', name: 'Sam Stranger', firstName: 'Sam', age: 52, child: false, booker: 'u-1', tier: 'gold' },
  party: [
    { id: 'u-1', name: 'Sam Stranger', firstName: 'Sam', age: 52, child: false, booker: 'u-1', tier: 'gold' },
    { id: 'u-2', name: 'Kit Stranger', firstName: 'Kit', age: 9, child: true, booker: 'u-1', tier: 'none' },
  ],
  booking: { number: 'PC179254', sailingId: 'sun-2026-11-22', package: 'plus', category: 'balcony' },
  sailingId: 'sun-2026-11-22', phoneZone: null, nowMs: 2_000_000, isDemo: false, ...over,
})

afterEach(() => { setContext(null); markAccount(null) })

describe('the account context', () => {
  it('reads the server answer and measures the server clock against this device', () => {
    const c = normalizeContext(wire(), 1_500_000)!
    expect(c.person.firstName).toBe('Sam')
    expect(c.party).toHaveLength(2)
    expect(c.booking?.package).toBe('plus')
    expect(c.offsetMs).toBe(500_000)
  })

  it('refuses an answer that is not one and tolerates missing parts', () => {
    expect(normalizeContext(null, 0)).toBeNull()
    expect(normalizeContext({ person: { id: 'x' } }, 0)).toBeNull()
    const c = normalizeContext({ person: { id: 'x', firstName: 'X' }, nowMs: 10, party: 'no', booking: { number: 'a' } }, 0)!
    expect(c.party).toEqual([])
    expect(c.booking).toBeNull()
    expect(c.person.tier).toBe('none')
  })

  it('gives a real account a server clock, and a demo account none', () => {
    setContext(normalizeContext(wire(), 1_000_000))
    expect(followsServer()).toBe(true)
    expect(serverNow(1_000_000)).toBe(2_000_000)
    setContext(normalizeContext(wire({ isDemo: true }), 1_000_000))
    expect(followsServer()).toBe(false)
  })

  it('follows the server as soon as a real sign-in is known, before the context arrives', () => {
    markAccount(false)
    expect(followsServer()).toBe(true)
    expect(serverNow(5)).toBe(5)
    markAccount(true)
    expect(followsServer()).toBe(false)
  })

  it('describes a real person to the screens, and keeps a demo person\'s authored details', () => {
    const real = personFrom(normalizeContext(wire(), 0)!)
    expect(real).toMatchObject({ id: 'u-1', firstName: 'Sam', child: false, package: 'plus', booker: 'u-1' })
    const demo = personFrom(normalizeContext(wire({ person: { id: 'maya', name: 'Maya Harper', firstName: 'Maya', age: 8, child: true, booker: 'daniel', tier: 'ruby' } }), 0)!)
    expect(demo.role).toBe('Daughter, 8')
    expect(demo.booker).toBe('daniel')
  })

  it('names the people on the trip from the server and falls back to the demo people', () => {
    setContext(normalizeContext(wire(), 0))
    expect(personFirstName('u-2')).toBe('Kit')
    expect(personFirstName('daniel')).toBe('Daniel')
    expect(personFirstName('nobody')).toBe('')
    expect(partyPeople('u-1').map((p) => p.firstName)).toEqual(['Sam', 'Kit'])
    expect(partyPeople('u-2').find((p) => p.id === 'u-2')?.child).toBe(true)
    setContext(null)
    expect(partyPeople('daniel').length).toBeGreaterThan(1)
  })

  it('keeps an answer only while the person is still the one who asked, and ignores a failure', async () => {
    expect(await refreshContext(async () => wire(), () => false)).toBe(false)
    expect(await refreshContext(async () => { throw new Error('offline') })).toBe(false)
    expect(await refreshContext(async () => ({ nope: true }))).toBe(false)
    let t = 1_000
    expect(await refreshContext(async () => wire(), () => true, () => (t += 100))).toBe(true)
  })
})

describe('the sailing the app is on', () => {
  it('follows a real account\'s trip and falls back to the next sailing', () => {
    const c = normalizeContext(wire(), 0)!
    expect(sailingFor(c, 'sun-2026-11-08', Date.UTC(2026, 10, 1)).id).toBe('sun-2026-11-22')
    const none = normalizeContext(wire({ booking: null, sailingId: null }), 0)!
    expect(sailingFor(none, 'sun-2026-11-08', Date.UTC(2026, 10, 10)).id).toBe(upcomingSailing(Date.UTC(2026, 10, 10)).id)
    expect(sailingFor(normalizeContext(wire({ sailingId: 'sun-1999-01-01' }), 0)!, 'x', Date.UTC(2026, 10, 10)).id).toBe(upcomingSailing(Date.UTC(2026, 10, 10)).id)
  })

  it('follows the demo controls for a demo account or nobody', () => {
    const demo = normalizeContext(wire({ isDemo: true }), 0)!
    expect(sailingFor(demo, 'sun-2026-12-06', 0).id).toBe('sun-2026-12-06')
    expect(sailingFor(null, 'sun-2026-12-06', 0).id).toBe('sun-2026-12-06')
  })

  it('picks the first sailing that has not left', () => {
    expect(upcomingSailing(Date.UTC(2026, 10, 9)).id).toBe('sun-2026-11-22')
  })
})

describe('"now" on a device', () => {
  it('is the server\'s time for a real account and the demo clock for a demo account', async () => {
    const { demoNow, getDemo } = await import('../demo/store')
    const before = Date.now()
    markAccount(false)
    const real = demoNow()
    expect(real).toBeGreaterThanOrEqual(before)
    expect(real - Date.now()).toBeLessThan(1000)
    markAccount(true)
    const demo = demoNow()
    expect(demo).toBeGreaterThanOrEqual(getDemo().clock.anchorDemo)
    expect(Math.abs(demo - real)).toBeGreaterThan(24 * 3600_000)   // the demo clock is not the real time
  })
})
