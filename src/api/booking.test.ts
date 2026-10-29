import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import { blankContact, blankGuest, emptyDraft, type Draft, type GuestDraft } from '../domain/booking'
import { cabinsFor } from '../domain/cabins'
import { SCA_DEMO_CODE, type PaymentPart } from '../domain/fares'
import type { PersonaId } from '../domain/personas'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)

function setup(as: PersonaId = 'gerald', at = REAL) {
  let who: PersonaId | null = as
  const demo: DemoState = { ...defaultDemoState(REAL), clock: clockAt(at, REAL, 0) }
  const store = createMemoryStore()
  let tick = REAL
  const api = createMockApi({ store, demo: () => demo, persona: () => who, realNow: () => (tick += 1000), sleep: async () => {} })
  return { api, as: (p: PersonaId) => { who = p }, moveClock: (to: number) => { demo.clock = clockAt(to, REAL, 0) } }
}
const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }

const guest = (first: string, dob: string): GuestDraft => ({ ...blankGuest(), firstName: first, lastName: 'Whitfield', dob, gender: 'M', citizenship: 'us', dietaryStatus: 'none' })
const draft = (over: Partial<Draft> = {}): Draft => ({
  ...emptyDraft('draft-1'), sailingId: 'sun-2027-03-21', category: 'balcony', guests: 2, fare: 'plus',
  people: [guest('Gerald', '1955-01-15'), guest('Ruth', '1957-02-01')],
  contact: { ...blankContact(), email: 'gerald@example.com', phone: '555-0142', street: '1 Main St', city: 'Tampa', region: 'FL', postcode: '33601' },
  dining: 'anytime', accepted: { terms: true, health: true, age: true, pregnancy: true }, ...over,
})
const card = (cents: number): PaymentPart => ({ method: 'card', cardId: 'card-default', cents })

describe('looking around', () => {
  it('lists every sailing, closing the ones that have left', async () => {
    const { api } = setup('gerald', Date.UTC(2026, 10, 20, 16))
    const dates = await api.booking.dates()
    expect(dates).toHaveLength(8)
    expect(dates.filter((d) => !d.open).map((d) => d.id)).toEqual(['sun-2026-11-08'])
    expect(dates.find((d) => d.id === 'sun-2027-03-21')).toMatchObject({ open: true, daysToDeparture: 121 })
  })

  it('prices rooms, fares and a quote with a held price and a payment plan', async () => {
    const { api } = setup()
    const rooms = await api.booking.rooms('sun-2027-03-21')
    expect(rooms.find((r) => r.id === 'signatureSuite')).toMatchObject({ capacity: 3, includes: 'premier' })
    const fares = await api.booking.fares(draft())
    expect(fares.map((f) => f.id)).toEqual(['standard', 'plus', 'premier'])
    expect(fares[0].difference).toBe(0)
    expect(fares[1].difference).toBe(6000 * 7 * 2 - 1650 * 7 * 2)
    const q = await api.booking.quote(draft())
    expect(q.quote.total).toBe(fares[1].total)
    expect(q.pay.options).toEqual(['deposit', 'full'])
    expect(q.promotions[0].creditCents).toBe(15_000)
    expect(q.lockedUntil).toBeGreaterThan(REAL + 23 * 3_600_000)
    expect(await code(api.booking.quote(draft({ fare: '' })))).toMatch(/^invalid/)
    expect(await code(api.booking.rooms('nope'))).toMatch(/^invalid/)
    expect(await code(api.booking.cabins('sun-2027-03-21', 'nope' as never))).toMatch(/^invalid/)
  })

  it('starts the guest list from the account: the signed-in person first, then the party', async () => {
    const { api } = setup('priya')
    const { people, contact } = await api.booking.prefill()
    expect(people.map((p) => p.firstName)).toEqual(['Priya', 'Daniel', 'Ethan', 'Maya'])
    expect(people[0].dietary).toEqual(['vegetarian'])
    expect(contact.email).toContain('@example.com')
  })
})

describe('drafts', () => {
  it('saves, returns and discards a draft, and cleans what it saves', async () => {
    const { api } = setup()
    expect(await api.booking.draft()).toBeNull()
    const saved = await api.booking.saveDraft({ ...draft(), sailingId: 'bogus' })
    expect(saved.sailingId).toBe('')
    expect((await api.booking.draft())?.id).toBe('draft-1')
    await api.booking.discardDraft()
    expect(await api.booking.draft()).toBeNull()
  })

  it('keeps each person’s draft apart', async () => {
    const { api, as } = setup()
    await api.booking.saveDraft(draft())
    as('maria')
    expect(await api.booking.draft()).toBeNull()
  })

  it('sends a link back to the draft by email or text, and says where without printing the whole address', async () => {
    const { api } = setup()
    expect(await code(api.booking.sendResumeLink('email', 'a@example.com'))).toBe('notFound:notFound')
    await api.booking.saveDraft(draft())
    const sent = await api.booking.sendResumeLink('email', 'gerald@example.com')
    expect(sent).toMatchObject({ via: 'email', to: 'g***@example.com', link: '/book/resume/draft-1' })
    expect((await api.booking.sendResumeLink('sms', '555-0142')).to).toBe('***-0142')
    expect(await code(api.booking.sendResumeLink('email', 'nope'))).toMatch(/^invalid/)
    expect(await code(api.booking.sendResumeLink('sms', 'abc'))).toMatch(/^invalid/)
  })

  it('does not let a supervised child account save or book', async () => {
    const { api } = setup('maya')
    expect(await code(api.booking.saveDraft(draft()))).toMatch(/^forbidden/)
    expect(await code(api.booking.book({ draft: draft(), expectedTotal: 1, option: 'full', parts: [] }))).toMatch(/^forbidden/)
  })
})

describe('booking', () => {
  const book = async (api: ReturnType<typeof setup>['api'], over: Partial<Draft> = {}, option: 'deposit' | 'full' = 'deposit') => {
    const d = draft(over)
    const q = await api.booking.quote(d)
    return api.booking.book({ draft: d, expectedTotal: q.quote.total, option, parts: [card(option === 'full' ? q.quote.total : q.pay.deposit)], challenge: SCA_DEMO_CODE })
  }

  it('books with a deposit, records the acceptance, and shows the trip with a balance due', async () => {
    const { api } = setup()
    await api.booking.saveDraft(draft())
    const b = await book(api)
    expect(b).toMatchObject({ status: 'confirmed', cabin: null, payment: 'upcoming', finalDue: '2026-12-21' })
    expect(b.number).toMatch(/^PB\d{6}$/)
    expect(b.paid).toBe(b.receipts[0].cents)
    expect(b.balance).toBe(b.total - b.paid)
    expect(b.receipts[0]).toMatchObject({ label: 'deposit', methods: ['Visa ending 4242'] })
    expect(b.accepted.map((a) => a.id)).toEqual(['terms', 'health', 'age', 'pregnancy'])
    expect(b.notified).toEqual([{ via: 'email', to: 'g***@example.com' }, { via: 'sms', to: '***-0142' }])
    expect(await api.booking.draft()).toBeNull()
    const { upcoming } = await api.trips.list()
    expect(upcoming.map((t) => t.kind)).toEqual(['current', 'booked'])
    expect(upcoming[1]).toMatchObject({ number: b.number, guests: 2, payment: 'upcoming', documents: null })
    expect((await api.trips.get(b.number)).plan).toMatchObject({ total: b.total, deposit: b.paid, balance: b.balance })
    expect((await api.account.history())[0]).toMatchObject({ what: 'booking', detail: `${b.number}: booked` })
  })

  it('books and pays in full, so nothing is left to pay', async () => {
    const { api } = setup()
    const b = await book(api, {}, 'full')
    expect(b).toMatchObject({ balance: 0, payment: 'paid' })
    expect(b.receipts[0].label).toBe('full')
  })

  it('returns the first booking when the same draft is sent twice, so a retry never charges twice', async () => {
    const { api } = setup()
    const first = await book(api)
    const second = await book(api)
    expect(second.number).toBe(first.number)
    expect((await api.trips.list()).upcoming).toHaveLength(2)
    expect(second.receipts).toHaveLength(1)
  })

  it('refuses incomplete answers, a moved price, a sailing that has left, and a deposit inside the final payment date', async () => {
    const { api } = setup()
    const q = await api.booking.quote(draft())
    const base = { option: 'deposit' as const, parts: [card(q.pay.deposit)] }
    expect(await code(api.booking.book({ ...base, draft: draft({ dining: '' }), expectedTotal: q.quote.total }))).toMatch(/^invalid/)
    expect(await code(api.booking.book({ ...base, draft: draft(), expectedTotal: q.quote.total + 100 }))).toBe('conflict:priceChanged')
    expect((await api.trips.list()).upcoming).toHaveLength(1)
    const late = setup('gerald', Date.UTC(2027, 0, 20, 16))
    const nearDraft = draft({ sailingId: 'sun-2027-03-21' })
    const nq = await late.api.booking.quote(nearDraft)
    expect(nq.pay.options).toEqual(['full'])
    expect(await code(late.api.booking.book({ draft: nearDraft, expectedTotal: nq.quote.total, option: 'deposit', parts: [card(nq.pay.deposit)] }))).toMatch(/^invalid/)
    const gone = setup('gerald', Date.UTC(2026, 10, 20, 16))
    const gd = draft({ sailingId: 'sun-2026-11-08' })
    const gq = await gone.api.booking.quote(gd)
    expect(await code(gone.api.booking.book({ draft: gd, expectedTotal: gq.quote.total, option: 'full', parts: [card(gq.quote.total)] }))).toBe('conflict:closed')
  })

  it('checks payment parts: amounts add up, an expired card is refused, and a declined card is declined', async () => {
    const { api } = setup()
    const d = draft()
    const q = await api.booking.quote(d)
    const go = (parts: PaymentPart[], challenge?: string) => api.booking.book({ draft: d, expectedTotal: q.quote.total, option: 'deposit', parts, challenge })
    expect(await code(go([card(q.pay.deposit - 100)]))).toMatch(/^invalid/)
    await api.payments.addCard('visa', '0002', '12/30')
    const declined = (await api.payments.get()).cards.find((c) => c.last4 === '0002')!
    expect(await code(go([{ method: 'card', cardId: declined.id, cents: q.pay.deposit }], SCA_DEMO_CODE))).toMatch(/^declined/)
    expect(await code(go([{ method: 'card', cardId: 'missing', cents: q.pay.deposit }]))).toMatch(/^invalid/)
    expect((await api.trips.list()).upcoming).toHaveLength(1)
  })

  it('asks for the bank code on a new card, refuses a wrong one, and accepts the right one', async () => {
    const { api } = setup()
    const d = draft()
    const q = await api.booking.quote(d)
    const cards = await api.payments.addCard('mastercard', '5555', '12/30')
    const newCard = cards[cards.length - 1]
    const go = (challenge?: string) => api.booking.book({ draft: d, expectedTotal: q.quote.total, option: 'deposit', parts: [{ method: 'card', cardId: newCard.id, cents: q.pay.deposit }], challenge })
    expect(await code(go())).toBe('challenge:required')
    expect(await code(go('000000'))).toBe('challenge:wrong')
    expect((await go(SCA_DEMO_CODE)).receipts[0].methods).toEqual(['Mastercard ending 5555'])
  })

  it('splits a payment between a card and the wallet', async () => {
    const { api } = setup()
    const d = draft()
    const q = await api.booking.quote(d)
    const b = await api.booking.book({ draft: d, expectedTotal: q.quote.total, option: 'deposit', parts: [card(q.pay.deposit - 20_000), { method: 'wallet', cents: 20_000 }] })
    expect(b.receipts[0].methods).toEqual(['Visa ending 4242', 'Device wallet'])
    expect(b.receipts[0].cents).toBe(q.pay.deposit)
  })

  it('lets a guest pick a free stateroom once, and refuses a taken or unknown one', async () => {
    const { api } = setup()
    const free = cabinsFor('sun-2027-03-21', 'balcony').find((c) => c.available)!
    const b = await book(api, { cabinMode: 'pick', cabinNumber: free.number })
    expect(b.cabin).toBe(free.number)
    expect(await code(book(api, { id: 'draft-2', cabinMode: 'pick', cabinNumber: free.number }))).toBe('conflict:cabinTaken')
    expect(await code(book(api, { id: 'draft-3', cabinMode: 'pick', cabinNumber: '0000' }))).toBe('conflict:cabinTaken')
  })
})

describe('after booking', () => {
  const booked = async (api: ReturnType<typeof setup>['api']) => {
    const d = draft()
    const q = await api.booking.quote(d)
    return api.booking.book({ draft: d, expectedTotal: q.quote.total, option: 'deposit', parts: [card(q.pay.deposit)] })
  }

  it('pays the balance once', async () => {
    const { api } = setup()
    const b = await booked(api)
    const paid = await api.booking.payBalance(b.number, [card(b.balance)], SCA_DEMO_CODE)
    expect(paid).toMatchObject({ balance: 0, payment: 'paid' })
    expect(paid.receipts.map((r) => r.label)).toEqual(['deposit', 'balance'])
    expect(await code(api.booking.payBalance(b.number, [card(b.balance)], SCA_DEMO_CODE))).toBe('conflict:nothingDue')
    expect(await code(api.booking.get('PB000000'))).toBe('notFound:notFound')
  })

  it('refuses a balance payment that does not add up', async () => {
    const { api } = setup()
    const b = await booked(api)
    expect(await code(api.booking.payBalance(b.number, [card(b.balance - 100)], SCA_DEMO_CODE))).toMatch(/^invalid/)
  })

  it('cancels with a full refund in the first day, and shows it as cancelled in My Trips', async () => {
    const { api } = setup()
    const b = await booked(api)
    expect(b.cancel).toMatchObject({ tier: 'free24h', fee: 0, refund: b.paid })
    const gone = await api.booking.cancel(b.number)
    expect(gone).toMatchObject({ status: 'cancelled', balance: 0, canCancel: false, cancelled: { fee: 0, refund: b.paid } })
    expect(gone.receipts[gone.receipts.length - 1]).toMatchObject({ label: 'refund', cents: -b.paid })
    const trips = await api.trips.list()
    expect(trips.upcoming).toHaveLength(1)
    expect(trips.past[0]).toMatchObject({ id: b.number, cancelled: true })
    expect(await code(api.booking.cancel(b.number))).toBe('conflict:closed')
    expect(await code(api.booking.payBalance(b.number, [card(1)]))).toBe('conflict:nothingDue')
  })

  it('keeps the deposit when cancelling after the first day but before the final payment date', async () => {
    const { api, moveClock } = setup()
    const b = await booked(api)
    moveClock(REAL + 3 * 86_400_000)
    const later = await api.booking.get(b.number)
    expect(later.cancel).toEqual({ tier: 'early', fee: b.paid, refund: 0 })
    const gone = await api.booking.cancel(b.number)
    expect(gone.cancelled).toMatchObject({ fee: b.paid, refund: 0 })
    expect(gone.receipts.map((r) => r.label)).toEqual(['deposit'])
  })

  it('moves to another date before the final payment date, repricing and keeping the paid amount', async () => {
    const { api } = setup()
    const b = await booked(api)
    const preview = await api.booking.changePreview(b.number, 'sun-2027-02-07')
    expect(preview).toMatchObject({ check: 'ok', cabinKept: true })
    expect(preview.difference).toBe(preview.newTotal - b.total)
    const moved = await api.booking.change(b.number, 'sun-2027-02-07')
    expect(moved).toMatchObject({ sailingId: 'sun-2027-02-07', total: preview.newTotal, paid: b.paid })
    expect(moved.balance).toBe(preview.newTotal - b.paid)
    expect((await api.booking.changePreview(b.number, 'sun-2027-02-07')).check).toBe('same')
    expect(await code(api.booking.change(b.number, 'sun-2027-02-07'))).toBe('conflict:same')
    expect((await api.booking.changePreview(b.number, 'sun-2026-11-22')).check).toBe('newTooSoon')
    expect(await code(api.booking.change(b.number, 'sun-2026-11-22'))).toBe('conflict:newTooSoon')
    expect(await code(api.booking.changePreview(b.number, 'bogus'))).toMatch(/^invalid/)
  })
})
