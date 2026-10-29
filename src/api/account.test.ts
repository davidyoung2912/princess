import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import { defaultProfile } from '../domain/account'
import type { PersonaId } from '../domain/personas'
import { REFERENCE_SAILING, timeForStage } from '../domain/sailings'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const NOW = Date.UTC(2027, 2, 1)

function setup(as: PersonaId = 'gerald', stage: Parameters<typeof timeForStage>[1] = 'preCruise') {
  let who: PersonaId | null = as
  const demo: DemoState = { ...defaultDemoState(NOW), clock: clockAt(timeForStage(REFERENCE_SAILING, stage), NOW, 0) }
  const store = createMemoryStore()
  let t = NOW
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => (t += 1000), sleep: async () => {} })
  return { api, as: (p: PersonaId) => { who = p } }
}
const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? e.code : 'other' } return null }

describe('trips and payments', () => {
  it('shows Gerald paid up with a passport problem and documents as the next action', async () => {
    const { api } = setup()
    const { upcoming, past } = await api.trips.list()
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0]).toMatchObject({ kind: 'current', payment: 'paid', daysToDeparture: 14, next: 'documents' })
    expect(upcoming[0].documents).toEqual({ guests: 1, missing: 1, passportProblems: 1 })
    expect(past.length).toBe(3)
  })

  it('shows Maria a balance that is due soon, and lets her pay it once', async () => {
    const { api } = setup('maria')
    let { trip, cards, canPay } = await api.payments.get()
    expect(trip.payment).toBe('dueSoon')
    expect(canPay).toBe(true)
    const after = await api.payments.payBalance(cards[0].id)
    expect(after.trip.payment).toBe('paid')
    expect(after.receipts.map((r) => r.label)).toEqual(['deposit', 'balance'])
    expect(after.receipts[1].cents).toBe(trip.plan.balance)
    expect(await code(api.payments.payBalance(cards[0].id))).toBe('conflict')
    ;({ trip, cards } = await api.payments.get())
    expect(trip.payment).toBe('paid')
  })

  it('turns overdue once the due date passes, and the next action is to pay', async () => {
    const { api } = setup('maria', 'checkIn')
    const { trip } = await api.payments.get()
    expect(trip.payment).toBe('overdue')
    expect(trip.next).toBe('payOverdue')
    const notices = (await api.notifications.list()).notices
    expect(notices[0]).toMatchObject({ id: 'payOverdue', category: 'critical' })
  })

  it('refuses an expired card or an unknown card, and adds and removes cards with a history entry', async () => {
    const { api } = setup('maria')
    expect(await code(api.payments.addCard('visa', '12', '09/29'))).toBe('invalid')
    expect(await code(api.payments.addCard('visa', '1111', '01/20'))).toBe('invalid')
    const cards = await api.payments.addCard('amex', '0005', '01/28')
    expect(cards).toHaveLength(2)
    expect(await code(api.payments.payBalance('nope'))).toBe('invalid')
    expect((await api.payments.removeCard(cards[1].id)).map((c) => c.last4)).toEqual(['4242'])
    expect(await code(api.payments.removeCard('nope'))).toBe('notFound')
    expect((await api.account.history()).map((h) => h.detail)).toEqual(['American Express ending 0005: removed', 'American Express ending 0005: added'])
  })

  it('links an agent booking, once, and lists it as another trip', async () => {
    const { api } = setup()
    expect(await code(api.trips.link('AG4K72Q', 'Smith', '2027-03-21'))).toBe('notFound')
    expect(await code(api.trips.link('x', 'Whitfield', '2027-03-21'))).toBe('invalid')
    const trip = await api.trips.link('ag4k72q', 'whitfield', '2027-03-21')
    expect(trip).toMatchObject({ kind: 'linked', number: 'AG4K72Q', agent: 'Harbour Travel', documents: null, payment: 'paid' })
    expect(await code(api.trips.link('AG4K72Q', 'Whitfield', '2027-03-21'))).toBe('conflict')
    const { upcoming } = await api.trips.list()
    expect(upcoming.map((t) => t.number)).toHaveLength(2)
    expect(upcoming.map((t) => t.kind)).toEqual(['current', 'linked'])
    expect((await api.trips.get('AG4K72Q')).kind).toBe('linked')
    expect(await code(api.trips.get('NOPE'))).toBe('notFound')
  })

  it('moves a sailed trip from coming up to past trips', async () => {
    const { api } = setup('gerald', 'postCruise')
    const { upcoming, past } = await api.trips.list()
    expect(upcoming).toEqual([])
    expect(past[0]).toMatchObject({ departure: '2027-03-21', ship: 'Sun Princess' })
    expect(past).toHaveLength(4)
  })

  it('keeps one person’s linked booking away from another', async () => {
    const { api, as } = setup()
    await api.trips.link('AG4K72Q', 'Whitfield', '2027-03-21')
    as('maria')
    expect((await api.trips.list()).upcoming).toHaveLength(1)
  })
})

describe('profile and party', () => {
  it('lets a parent edit a child’s details, and records it for the whole family', async () => {
    const { api, as } = setup('daniel')
    expect((await api.account.party()).map((p) => p.id)).toEqual(['daniel', 'priya', 'ethan', 'maya'])
    const maya = await api.account.profile('maya')
    expect(maya.profile.dietary).toEqual(['nutAllergy'])
    await api.account.saveProfile('maya', { ...maya.profile, specialRequests: 'Birthday cake on day 3' })
    expect((await api.account.profile('maya')).profile.specialRequests).toBe('Birthday cake on day 3')
    as('priya')
    expect((await api.account.history())[0]).toMatchObject({ by: 'Daniel', what: 'profile' })
  })

  it('keeps children read-only and people outside the booking out', async () => {
    const { api, as } = setup('ethan')
    const view = await api.account.profile('ethan')
    expect(view.canEdit).toBe(false)
    expect(await code(api.account.saveProfile('ethan', view.profile))).toBe('forbidden')
    expect(await code(api.payments.addCard('visa', '1111', '01/30'))).toBe('forbidden')
    expect((await api.payments.get()).canPay).toBe(false)
    as('gerald')
    expect(await code(api.account.profile('maya'))).toBe('forbidden')
    expect(await code(api.account.saveProfile('maya', defaultProfile('maya')))).toBe('forbidden')
  })

  it('rejects bad fields and sends a big name change to Guest Services', async () => {
    const { api } = setup()
    const { profile } = await api.account.profile('gerald')
    expect(await code(api.account.saveProfile('gerald', { ...profile, email: 'nope' }))).toBe('invalid')
    expect(await code(api.account.saveProfile('gerald', { ...profile, firstName: 'Paul', lastName: 'Jones' }))).toBe('conflict')
    const saved = await api.account.saveProfile('gerald', { ...profile, lastName: 'Whitfeld', needs: ['hearing', 'vision'] })
    expect(saved.profile).toMatchObject({ lastName: 'Whitfeld', needs: ['hearing', 'vision'] })
  })

  it('blocks even a spelling fix in the last two weeks', async () => {
    const { api } = setup('gerald', 'embarkation')
    const { profile } = await api.account.profile('gerald')
    expect(await code(api.account.saveProfile('gerald', { ...profile, lastName: 'Whitfeld' }))).toBe('conflict')
  })
})

describe('documents', () => {
  it('lets Maria record what she holds, and clears her blocking items', async () => {
    const { api } = setup('maria')
    expect((await api.documents.get()).guests[0].blocking).toBe(2)
    await api.documents.set('maria', 'birthCertificate', {})
    const done = await api.documents.set('maria', 'photoId', { expires: '2030-05-05' })
    expect(done.guests[0]).toMatchObject({ blocking: 0, held: { birthCertificate: {}, photoId: { expires: '2030-05-05' } } })
    expect((await api.trips.list()).upcoming[0].next).toBe('payDue')
    const removed = await api.documents.set('maria', 'photoId', null)
    expect(removed.guests[0].blocking).toBe(1)
  })

  it('fixes Gerald’s passport by changing its expiry, and rejects nonsense', async () => {
    const { api } = setup()
    expect(await code(api.documents.set('gerald', 'passport', { expires: 'tomorrow' }))).toBe('invalid')
    expect(await code(api.documents.set('maya', 'passport', {}))).toBe('forbidden')
    const fixed = await api.documents.set('gerald', 'passport', { expires: '2032-01-01' })
    expect(fixed.guests[0].blocking).toBe(0)
    expect((await api.trips.list()).upcoming[0].documents).toEqual({ guests: 1, missing: 0, passportProblems: 0 })
  })

  it('uses the profile’s citizenship to decide what a guest needs', async () => {
    const { api } = setup('maria')
    const { profile } = await api.account.profile('maria')
    await api.account.saveProfile('maria', { ...profile, citizenship: 'other' })
    const g = (await api.documents.get()).guests[0]
    expect(g.results.filter((r) => r.requirement.level === 'required').map((r) => r.requirement.id)).toEqual(['passport'])
  })
})

describe('helper, notifications and support', () => {
  it('starts Gerald’s son as a request, and nothing is shared until Gerald allows it', async () => {
    const { api } = setup()
    expect(await api.account.helper()).toMatchObject({ name: 'Paul Whitfield', status: 'requested' })
    const allowed = await api.account.saveHelper({ name: 'Paul Whitfield', relationship: 'Son', permissions: ['payments'], status: 'active' })
    expect(allowed.permissions).toEqual(['view', 'payments'])
    const revoked = await api.account.revokeHelper()
    expect(revoked.status).toBe('revoked')
    expect((await api.account.history()).map((h) => h.detail)).toEqual(['Paul Whitfield: revoked', 'Paul Whitfield: active'])
  })

  it('has no helper for others until they add one, and a helper needs a name', async () => {
    const { api } = setup('maria')
    expect(await api.account.helper()).toBeNull()
    expect(await code(api.account.revokeHelper())).toBe('notFound')
    expect(await code(api.account.saveHelper({ name: ' ', relationship: '', permissions: [], status: 'active' }))).toBe('invalid')
  })

  it('remembers what was read and the chosen preferences, and never turns critical off', async () => {
    const { api, as } = setup('maria', 'checkIn')
    const first = await api.notifications.list()
    expect(first.notices.every((n) => !n.read)).toBe(true)
    await api.notifications.markRead(first.notices.map((n) => n.id))
    expect((await api.notifications.list()).notices.every((n) => n.read)).toBe(true)
    const prefs = await api.notifications.savePrefs({ ...first.prefs, channels: { ...first.prefs.channels, critical: { push: false, email: false, sms: false } }, quiet: { on: true, from: '21:00', to: '06:30' } })
    expect(prefs.channels.critical.push).toBe(true)
    expect((await api.notifications.list()).prefs.quiet).toEqual({ on: true, from: '21:00', to: '06:30' })
    as('gerald')
    expect((await api.notifications.list()).prefs.quiet.on).toBe(false)
  })

  it('tracks callback and email requests', async () => {
    const { api } = setup()
    expect(await code(api.support.callback('abc'))).toBe('invalid')
    expect(await code(api.support.email('  '))).toBe('invalid')
    await api.support.callback('555-0142')
    await api.support.email('My passport name is spelled differently')
    const tickets = await api.support.tickets()
    expect(tickets.map((t) => t.kind)).toEqual(['email', 'callback'])
    expect(tickets[0].status).toBe('received')
  })

  it('needs sign-in for every account call', async () => {
    const { api, as } = setup()
    as(null as unknown as PersonaId)
    expect(await code(api.trips.list())).toBe('forbidden')
  })
})
