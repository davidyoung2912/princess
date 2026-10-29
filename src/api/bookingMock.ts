import type { DataStore } from '../data/store'
import { BRAND_NAMES, phoneOk, validateCard, type Card, type HistoryEntry, type Profile } from '../domain/account'
import { blankContact, blankGuest, maskEmail, maskPhone, normalizeDraft, stepProblems, STEPS, type DiningChoice, type Draft, type GuestDraft, type LeadContact, type Occasion } from '../domain/booking'
import { cabinAvailable, cabinsFor } from '../domain/cabins'
import { applyPerks, loyaltyNumberOk, tierForNumber } from '../domain/ahead'
import { fccBefore } from '../domain/postcruise'
import { bookable, bookingQuote, capacityOf, checkParts, dueNow, fareIncluded, fareOptions, FARES, payPlan, PRICE_LOCK_HOURS, promotionsFor, scaRequired, SCA_DEMO_CODE, DECLINED_LAST4, type FareId, type PaymentPart } from '../domain/fares'
import { acceptanceLog, cancelTerms, changeCheck, type Acceptance } from '../domain/policy'
import { fareFor, fromPrice, NIGHTS } from '../domain/pricing'
import { partyOf, personaById, type Persona, type PersonaId } from '../domain/personas'
import { SAILINGS, sailingById } from '../domain/sailings'
import { categoryById, CATEGORIES, type CategoryId } from '../domain/ship'
import { addDays } from '../domain/timezones'
import { daysBetween, paymentState, type PaymentPlan } from '../domain/trip'
import type { Channel } from '../data/sync'
import { ApiError } from './errors'
import type { Api, BookingReceipt, BookingView, Item, PrefillView } from './types'

/** What the booking part of the mock needs from the rest of the mock. */
export interface BookingDeps {
  store: DataStore
  channel?: Channel
  who: () => PersonaId
  actor: () => Persona
  /** Throws `forbidden` for a supervised child account. */
  adult: () => Persona
  now: () => number
  /** Today in ship home time, "YYYY-MM-DD". */
  today: () => string
  save: (kind: string, owner: string, id: string, data: unknown) => Promise<Item>
  log: (what: HistoryEntry['what'], detail: string) => Promise<Item>
  newId: (prefix: string) => string
  cardsOf: () => Promise<Card[]>
  profileOf: (id: PersonaId) => Promise<Profile>
  run: <T>(call: string, fn: () => Promise<T> | T) => Promise<T>
}

type Payment = { id: string; label: BookingReceipt['label']; cents: number; at: number; methods: string[] }

/** A booking as stored. Everything else (balance, status, cancel terms) is worked out from it and the demo clock. */
export interface StoredBooking {
  number: string
  draftId: string
  sailingId: string
  category: CategoryId
  cabin: string | null
  fare: FareId
  people: GuestDraft[]
  contact: LeadContact
  dining: DiningChoice
  occasion: Occasion
  accepted: Acceptance[]
  total: number
  payments: Payment[]
  createdAt: number
  status: 'confirmed' | 'cancelled'
  cancelled: { at: number; fee: number; refund: number } | null
  notified: { via: 'email' | 'sms'; to: string }[]
}

function readStored(raw: unknown): StoredBooking | null {
  const o = raw as Partial<StoredBooking> | null
  if (!o || typeof o.number !== 'string' || !sailingById(o.sailingId) || !categoryById(o.category) || !Array.isArray(o.people) || !Array.isArray(o.payments) || typeof o.total !== 'number') return null
  return { ...o, cabin: o.cabin ?? null, accepted: o.accepted ?? [], notified: o.notified ?? [], cancelled: o.cancelled ?? null, status: o.status === 'cancelled' ? 'cancelled' : 'confirmed' } as StoredBooking
}

const KIND = 'booking'
const DRAFT = 'bookingDraft'
const HOUR = 3_600_000

/** Checks a payment before any money moves: amounts, cards, the pretend bank's decline, and the bank's one-time code. Returns how each part was paid, in words. */
export function createAuthoriser(d: Pick<BookingDeps, 'cardsOf' | 'today'>) {
  const method = (part: PaymentPart, cards: Card[]): string => {
    if (part.method === 'wallet') return 'Device wallet'
    const card = cards.find((c) => c.id === part.cardId)!
    return `${BRAND_NAMES[card.brand]} ending ${card.last4}`
  }
  return async function authorise(parts: readonly PaymentPart[], due: number, challenge: string | undefined): Promise<string[]> {
    if (checkParts(parts, due)) throw new ApiError('invalid', 'The amounts do not add up to what is due')
    const cards = await d.cardsOf()
    for (const p of parts) {
      if (p.method !== 'card') continue
      const card = cards.find((c) => c.id === p.cardId)
      if (!card || validateCard(card.last4, card.expiry, d.today())) throw new ApiError('invalid', 'Choose a card that has not expired')
      if (card.last4 === DECLINED_LAST4) throw new ApiError('declined', method(p, cards))
    }
    if (parts.some(scaRequired)) {
      if (!challenge) throw new ApiError('challenge', 'required')
      if (challenge.trim() !== SCA_DEMO_CODE) throw new ApiError('challenge', 'wrong')
    }
    return parts.map((p) => method(p, cards))
  }
}

export function createBookingApi(d: BookingDeps): { api: Api['booking']; list: () => Promise<BookingView[]> } {
  const stored = async (): Promise<StoredBooking[]> => (await d.store.list(KIND, d.who())).map((r) => readStored(r.data)).filter((s): s is StoredBooking => !!s)
  const find = async (number: string): Promise<StoredBooking> => {
    const hit = (await stored()).find((s) => s.number === number)
    if (!hit) throw new ApiError('notFound')
    return hit
  }
  const days = (departure: string) => daysBetween(d.today(), departure)

  const view = (s: StoredBooking): BookingView => {
    const sailing = sailingById(s.sailingId)!
    const toDeparture = days(sailing.departure)
    const paid = s.payments.reduce((n, p) => n + p.cents, 0)
    const cancelled = s.status === 'cancelled'
    const balance = cancelled ? 0 : Math.max(0, s.total - paid)
    const plan = payPlan(s.total, sailing.departure, toDeparture)
    const asPlan: PaymentPlan = { total: s.total, deposit: paid, balance, finalDue: plan.finalDue, booked: '' }
    return {
      number: s.number, status: s.status, sailingId: s.sailingId, departure: sailing.departure, returnDate: addDays(sailing.departure, NIGHTS), category: s.category, categoryName: categoryById(s.category)!.name,
      cabin: s.cabin, fare: s.fare, people: s.people, contact: s.contact, dining: s.dining, occasion: s.occasion, total: s.total, paid, balance, finalDue: plan.finalDue,
      payment: paymentState(asPlan, balance === 0, d.today()), receipts: s.payments, accepted: s.accepted, notified: s.notified, daysToDeparture: toDeparture, createdAt: s.createdAt,
      cancel: cancelTerms({ total: s.total, paid, deposit: plan.deposit, daysToDeparture: toDeparture, hoursSinceBooking: (d.now() - s.createdAt) / HOUR }),
      canCancel: !cancelled && toDeparture >= 1, canChange: !cancelled && changeCheck(toDeparture, Infinity, false) === 'ok', cancelled: s.cancelled,
    }
  }
  const put = async (s: StoredBooking) => { await d.save(KIND, d.who(), s.number, s) }

  const authorise = createAuthoriser(d)

  const newNumber = async (draftId: string): Promise<string> => {
    const taken = new Set((await stored()).map((s) => s.number))
    let h = 5381
    for (const ch of draftId) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
    for (let n = 0; ; n++) {
      const number = `PB${String(100_000 + ((h + n * 7919) % 900_000))}`
      if (!taken.has(number)) return number
    }
  }

  /** The Captain's Circle discount and future cruise credit for a draft (BOK-11, BOK-12), and what is left to pay. */
  const perksFor = async (draft: Draft, total: number) => {
    const who = d.who()
    const used = ((await d.store.get('fccUsed', who, 'used'))?.data as { cents?: number } | undefined)?.cents ?? 0
    const creditLeft = Math.max(0, fccBefore(who) - used)
    const numberOk = loyaltyNumberOk(draft.loyaltyNumber)
    const tier = numberOk ? tierForNumber(draft.loyaltyNumber, who, personaById(who)?.tier ?? 'none') : 'none'
    const sums = applyPerks(total, { number: draft.loyaltyNumber, tier, useCredit: draft.useCredit }, creditLeft)
    return { numberOk, tier, discount: sums.discount, credit: sums.credit, creditLeft, total: sums.total }
  }

  const draftIn = (draft: Draft) => {
    const sailing = sailingById(draft.sailingId)
    if (!sailing || !draft.category || !draft.fare) throw new ApiError('invalid', 'Choose a date, room type and fare first')
    return { sailing, category: draft.category, fare: draft.fare }
  }

  const readDraft = async (): Promise<Draft | null> => {
    const record = await d.store.get(DRAFT, d.who(), 'current')
    return record ? normalizeDraft(record.data) : null
  }

  const api: Api['booking'] = {
    dates: () => d.run('booking.dates', () => SAILINGS.map((s) => ({ id: s.id, departure: s.departure, holiday: !!s.holiday, from: fromPrice(s.id)!, daysToDeparture: days(s.departure), open: bookable(days(s.departure)) }))),

    rooms: (sailingId) => d.run('booking.rooms', () => {
      if (!sailingById(sailingId)) throw new ApiError('invalid', 'Unknown sailing')
      return CATEGORIES.map((c) => ({ id: c.id, fare: fareFor(sailingId, c.id)!, capacity: capacityOf(c.id), includes: fareIncluded(c.id) }))
    }),

    cabins: (sailingId, category) => d.run('booking.cabins', () => {
      if (!sailingById(sailingId) || !categoryById(category)) throw new ApiError('invalid', 'Unknown sailing or room type')
      return cabinsFor(sailingId, category)
    }),

    fares: (draft) => d.run('booking.fares', () => {
      const x = normalizeDraft(draft)
      const sailing = sailingById(x.sailingId)
      if (!sailing || !x.category) throw new ApiError('invalid', 'Choose a date and room type first')
      const options = fareOptions(x.category).map((id) => ({ id, total: bookingQuote(sailing.id, x.category as CategoryId, x.guests, id)?.total ?? 0 }))
      const lowest = Math.min(...options.map((o) => o.total))
      return options.map((o) => ({ ...o, difference: o.total - lowest, included: fareIncluded(x.category as CategoryId) === o.id, perNight: FARES[o.id].perNight }))
    }),

    quote: (draft) => d.run('booking.quote', async () => {
      const x = normalizeDraft(draft)
      const { sailing, category, fare } = draftIn(x)
      const q = bookingQuote(sailing.id, category, x.guests, fare)
      if (!q) throw new ApiError('invalid', 'That room type, fare and number of guests cannot be booked together')
      const toDeparture = days(sailing.departure)
      const p = await perksFor(x, q.total)
      return {
        quote: q, promotions: promotionsFor(category, toDeparture), lockedUntil: d.now() + PRICE_LOCK_HOURS * HOUR, pay: payPlan(p.total, sailing.departure, toDeparture), daysToDeparture: toDeparture,
        total: p.total, perks: { numberOk: p.numberOk, tier: p.tier, discount: p.discount, credit: p.credit, creditLeft: p.creditLeft },
      }
    }),

    prefill: () => d.run('booking.prefill', async (): Promise<PrefillView> => {
      const me = d.actor()
      const party = [me, ...partyOf(me.id).filter((p) => p.id !== me.id)].slice(0, 4)
      const profiles = await Promise.all(party.map((p) => d.profileOf(p.id)))
      const people = profiles.map((p): GuestDraft => ({ ...blankGuest(), firstName: p.firstName, lastName: p.lastName, dob: p.dob, citizenship: p.citizenship, needs: p.needs, dietary: p.dietary, dietaryStatus: p.dietary.length > 0 ? 'some' : '', allergyNote: '' }))
      return { people, contact: { ...blankContact(), email: profiles[0].email, phone: profiles[0].phone } }
    }),

    draft: () => d.run('booking.draft', readDraft),

    saveDraft: (draft) => d.run('booking.saveDraft', async () => {
      d.adult()
      const x = { ...normalizeDraft(draft), updatedAt: d.now() }
      await d.save(DRAFT, d.who(), 'current', x)
      return x
    }),

    discardDraft: () => d.run('booking.discardDraft', async () => {
      await d.store.delete(DRAFT, d.who(), 'current')
      d.channel?.post({ type: 'records', kind: DRAFT, owner: d.who() })
    }),

    sendResumeLink: (via, to) => d.run('booking.sendResumeLink', async () => {
      d.adult()
      const draft = await readDraft()
      if (!draft) throw new ApiError('notFound')
      const address = to.trim()
      if (via === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) : !phoneOk(address)) throw new ApiError('invalid', 'Check where to send it')
      const sent = { via, to: via === 'email' ? maskEmail(address) : maskPhone(address), link: `/book/resume/${draft.id}`, at: d.now() }
      await d.save('resumeLink', d.who(), d.newId('resume'), sent)
      return sent
    }),

    book: (input) => d.run('booking.book', async () => {
      d.adult()
      const draft = normalizeDraft(input.draft)
      const again = (await stored()).find((s) => s.draftId === draft.id)
      if (again) return view(again)
      const ctx = { departure: sailingById(draft.sailingId)?.departure ?? null, today: d.today() }
      if (STEPS.some((step) => stepProblems(draft, step, ctx).length > 0)) throw new ApiError('invalid', 'Some answers are missing or need correcting')
      const { sailing, category, fare } = draftIn(draft)
      const toDeparture = days(sailing.departure)
      if (!bookable(toDeparture)) throw new ApiError('conflict', 'closed')
      const q = bookingQuote(sailing.id, category, draft.guests, fare)
      if (!q) throw new ApiError('invalid', 'That room type, fare and number of guests cannot be booked together')
      const p = await perksFor(draft, q.total)
      if (p.total !== input.expectedTotal) throw new ApiError('conflict', 'priceChanged')
      if (draft.cabinMode === 'pick') {
        const taken = (await stored()).some((s) => s.status === 'confirmed' && s.sailingId === sailing.id && s.category === category && s.cabin === draft.cabinNumber)
        if (taken || !cabinAvailable(sailing.id, category, draft.cabinNumber)) throw new ApiError('conflict', 'cabinTaken')
      }
      const plan = payPlan(p.total, sailing.departure, toDeparture)
      if (!plan.options.includes(input.option)) throw new ApiError('invalid', 'That payment option is not available for this sailing')
      const methods = await authorise(input.parts, dueNow(plan, input.option), input.challenge)
      const at = d.now()
      const number = await newNumber(draft.id)
      const contact = draft.contact
      const booking: StoredBooking = {
        number, draftId: draft.id, sailingId: sailing.id, category, cabin: draft.cabinMode === 'pick' ? draft.cabinNumber : null, fare,
        people: draft.people, contact, dining: draft.dining as DiningChoice, occasion: draft.occasion, accepted: acceptanceLog(draft.accepted, at), total: p.total,
        payments: [{ id: `RC-${number}-1`, label: input.option === 'full' ? 'full' : 'deposit', cents: dueNow(plan, input.option), at, methods }],
        createdAt: at, status: 'confirmed', cancelled: null,
        notified: [{ via: 'email', to: maskEmail(contact.email) }, { via: 'sms', to: maskPhone(contact.phone) }],
      }
      await put(booking)
      if (p.credit > 0) {
        const used = ((await d.store.get('fccUsed', d.who(), 'used'))?.data as { cents?: number } | undefined)?.cents ?? 0
        await d.save('fccUsed', d.who(), 'used', { cents: used + p.credit })
      }
      await d.store.delete(DRAFT, d.who(), 'current')
      d.channel?.post({ type: 'records', kind: DRAFT, owner: d.who() })
      await d.log('booking', `${number}: booked`)
      return view(booking)
    }),

    get: (number) => d.run('booking.get', async () => view(await find(number))),

    payBalance: (number, parts, challenge) => d.run('booking.payBalance', async () => {
      d.adult()
      const s = await find(number)
      const v = view(s)
      if (s.status !== 'confirmed' || v.balance === 0) throw new ApiError('conflict', 'nothingDue')
      const methods = await authorise(parts, v.balance, challenge)
      const next = { ...s, payments: [...s.payments, { id: `RC-${number}-${s.payments.length + 1}`, label: 'balance' as const, cents: v.balance, at: d.now(), methods }] }
      await put(next)
      await d.log('payment', `${number}: balance paid`)
      return view(next)
    }),

    changePreview: (number, sailingId) => d.run('booking.changePreview', async () => {
      const s = await find(number)
      const next = sailingById(sailingId)
      if (!next) throw new ApiError('invalid', 'Unknown sailing')
      const current = sailingById(s.sailingId)!
      const q = bookingQuote(next.id, s.category, s.people.length, s.fare)
      if (!q) throw new ApiError('invalid', 'Unknown sailing')
      const nextDays = days(next.departure)
      const check = bookable(nextDays) ? changeCheck(days(current.departure), nextDays, next.id === current.id) : 'newTooSoon'
      return { check, newTotal: q.total, difference: q.total - s.total, cabinKept: s.cabin === null || cabinAvailable(next.id, s.category, s.cabin) }
    }),

    change: (number, sailingId) => d.run('booking.change', async () => {
      d.adult()
      const s = await find(number)
      const next = sailingById(sailingId)
      if (!next || s.status !== 'confirmed') throw new ApiError('invalid', 'Unknown sailing')
      const q = bookingQuote(next.id, s.category, s.people.length, s.fare)
      if (!q) throw new ApiError('invalid', 'Unknown sailing')
      const nextDays = days(next.departure)
      const check = bookable(nextDays) ? changeCheck(days(sailingById(s.sailingId)!.departure), nextDays, next.id === s.sailingId) : 'newTooSoon'
      if (check !== 'ok') throw new ApiError('conflict', check)
      const paid = s.payments.reduce((n, p) => n + p.cents, 0)
      const cabin = s.cabin !== null && cabinAvailable(next.id, s.category, s.cabin) ? s.cabin : null
      const payments = paid > q.total ? [...s.payments, { id: `RC-${number}-${s.payments.length + 1}`, label: 'refund' as const, cents: q.total - paid, at: d.now(), methods: ['Refunded to the original payment'] }] : s.payments
      const updated = { ...s, sailingId: next.id, total: q.total, cabin, payments }
      await put(updated)
      await d.log('booking', `${number}: moved to ${next.departure}`)
      return view(updated)
    }),

    cancel: (number) => d.run('booking.cancel', async () => {
      d.adult()
      const s = await find(number)
      const v = view(s)
      if (!v.canCancel) throw new ApiError('conflict', 'closed')
      const at = d.now()
      const payments = v.cancel.refund > 0 ? [...s.payments, { id: `RC-${number}-${s.payments.length + 1}`, label: 'refund' as const, cents: -v.cancel.refund, at, methods: ['Refunded to the original payment'] }] : s.payments
      const updated: StoredBooking = { ...s, status: 'cancelled', payments, cancelled: { at, fee: v.cancel.fee, refund: v.cancel.refund } }
      await put(updated)
      await d.log('booking', `${number}: cancelled`)
      return view(updated)
    }),
  }

  return { api, list: async () => (await stored()).map(view) }
}
