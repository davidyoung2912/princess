import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../domain/contacts'
import { partyOf, personaById, visibleTo, type PersonaId } from '../domain/personas'
import { SHIP } from '../domain/ship'
import { isSavable, toggleKey } from '../domain/favourites'
import { fromPrice, quote } from '../domain/pricing'
import { portAt, SAILINGS, sailingById, type Sailing } from '../domain/sailings'
import { BRAND_NAMES, CARD_BRANDS, normalizeHelper, normalizeProfile, nameChange, phoneOk, validateCard, validateProfile, ageOn, SEEDED_HELPER, PERMISSIONS, type Card, type CardBrand, type Helper, type HistoryEntry, type Profile } from '../domain/account'
import { DEFAULT_HELD, DOC_IDS, DOCS, guestDocuments, normalizeHeld, type Held } from '../domain/documents'
import { buildNotices, normalizePrefs, type NotificationPrefs } from '../domain/notifications'
import { ticketStatus } from '../domain/help'
import { AGENT_BOOKINGS, bookingNumber, bookingTotal, categoryOfStateroom, daysBetween, finalPaymentDays, matchBooking, nextAction, pastTrips, paymentPlan, paymentState, paysLate, type PastTrip, type PaymentPlan } from '../domain/trip'
import { categoryById } from '../domain/ship'
import { CRUISE } from '../domain/cruise'
import { NIGHTS } from '../domain/pricing'
import { activeFaults, targetMatches } from '../domain/scenarios'
import { addDays, dateIn, zonedToEpoch } from '../domain/timezones'
import { clockNow } from '../domain/clock'
import type { Channel } from '../data/sync'
import type { DataRecord, DataStore } from '../data/store'
import type { DemoState } from '../demo/state'
import { createBookingApi } from './bookingMock'
import { createPlanApi } from './planMock'
import { createOnboardApi, createServiceApi } from './onboardMock'
import { checkinClosesAt, checkinOpensAt, createCheckinApi } from './checkinMock'
import { checkinWindow } from '../domain/checkin'
import { ApiError } from './errors'
import { createRng, type Rng } from './rng'
import type { Api, BookingView, DocumentsView, GuestDocumentsView, Item, Message, PaymentsView, ProfileView, Receipt, Ticket, TripView, TripsView } from './types'

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

interface ChatPrefs { receipts: boolean; seenAt: number }
const chatPrefsOf = (raw: unknown): ChatPrefs => {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { receipts: o.receipts === true, seenAt: typeof o.seenAt === 'number' ? o.seenAt : 0 }
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

  const put = async (kind: string, data: unknown): Promise<DataRecord> => {
    const id = newId(kind)
    await save(kind, who(), id, data)
    return (await ctx.store.get(kind, who(), id))!
  }

  const favourites = async (): Promise<string[]> => {
    const record = await ctx.store.get('favourites', who(), 'list')
    const keys = (record?.data as { keys?: unknown } | undefined)?.keys
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : []
  }

  const checkinStatus = async (s?: Sailing) => {
    const sailing = s ?? sailingById(ctx.demo().sailingId)!
    const done = s ? undefined : await ctx.store.get('checkin', personaById(who())!.booker, 'status')
    const opensAt = checkinOpensAt(sailing)
    const closesAt = checkinClosesAt(sailing)
    return { state: done ? ('done' as const) : checkinWindow(now(), opensAt, closesAt), opensAt, closesAt }
  }

  // ---- Account and My Trips (Phase 2) ----
  const actor = () => personaById(who())!
  /** Writes need an adult account; children's accounts are supervised by the booker. */
  const adult = () => {
    const p = actor()
    if (p.child) throw new ApiError('forbidden', 'This account is supervised')
    return p
  }
  const today = () => dateIn(now(), 'America/New_York')
  const inParty = (id: PersonaId) => partyOf(who()).some((x) => x.id === id)
  const log = (what: HistoryEntry['what'], detail: string) => save('history', actor().booker, newId('h'), { by: actor().firstName, what, detail })

  const profileOf = async (id: PersonaId): Promise<Profile> => normalizeProfile((await ctx.store.get('profile', id, 'me'))?.data, id)
  const heldOf = async (id: PersonaId): Promise<Held> => {
    const record = await ctx.store.get('documents', actor().booker, id)
    return record ? normalizeHeld(record.data) : (DEFAULT_HELD[id] ?? {})
  }
  const cardsOf = async (): Promise<Card[]> => {
    const record = await ctx.store.get('cards', actor().booker, 'list')
    const list = (record?.data as { cards?: unknown } | undefined)?.cards
    if (!Array.isArray(list)) return [{ id: 'card-default', brand: 'visa', last4: '4242', expiry: '09/29' }]
    return list.filter((c): c is Card => !!c && typeof c.id === 'string' && CARD_BRANDS.includes(c.brand) && /^\d{4}$/.test(c.last4) && typeof c.expiry === 'string')
  }
  const saveCards = async (cards: Card[]) => { await save('cards', actor().booker, 'list', { cards }); return cards }
  const booking = createBookingApi({ store: ctx.store, channel: ctx.channel, who, actor, adult, now, today, save, log, newId, cardsOf, profileOf, run })

  const documentsView = async (): Promise<DocumentsView> => {
    const s = sailingById(ctx.demo().sailingId)!
    const returnDate = addDays(s.departure, NIGHTS)
    const guests: GuestDocumentsView[] = await Promise.all(
      partyOf(who()).map(async (g) => {
        const [profile, held] = await Promise.all([profileOf(g.id), heldOf(g.id)])
        const age = ageOn(profile.dob, s.departure)
        const docs = guestDocuments(profile.citizenship, age, held, returnDate)
        return { id: g.id, name: `${profile.firstName} ${profile.lastName}`.trim(), age, citizenship: profile.citizenship, held, results: docs.results, blocking: docs.blocking }
      }),
    )
    return { returnDate, guests, canEdit: !actor().child }
  }

  const balancePaidRecord = async () => ctx.store.get('payment', actor().booker, 'final')
  const sailedPast = (s: Sailing): PastTrip => ({ id: s.id, title: CRUISE.name, ship: SHIP.name, departure: s.departure, nights: NIGHTS })

  const currentTrip = async (): Promise<TripView> => {
    const p = actor()
    const s = sailingById(ctx.demo().sailingId)!
    const guests = partyOf(p.id).length
    const category = categoryOfStateroom(p.stateroom)
    const plan = paymentPlan(bookingTotal(s.id, category, guests), s.departure, finalPaymentDays(p.booker))
    const day = today()
    const paid = !!(await balancePaidRecord()) || (!paysLate(p.booker) && day >= plan.finalDue)
    const payment = paymentState(plan, paid, day)
    const docs = (await documentsView()).guests
    const missing = docs.reduce((n, g) => n + g.blocking, 0)
    const passportProblems = docs.filter((g) => g.results.some((r) => r.requirement.id === 'passport' && r.status === 'problem')).length
    const checkin = await checkinStatus()
    return {
      number: bookingNumber(p.booker), kind: 'current', sailingId: s.id, departure: s.departure, categoryName: categoryById(category)!.name, guests,
      daysToDeparture: daysBetween(day, s.departure), plan, payment, documents: { guests: docs.length, missing, passportProblems }, checkin,
      next: nextAction({ payment, documentsMissing: missing, checkinOpen: checkin.state === 'open', checkinDone: checkin.state === 'done' }),
    }
  }

  const linkedNumbers = async (): Promise<string[]> => (await ctx.store.list('linked', who())).map((r) => r.id)
  const linkedTrip = async (number: string): Promise<TripView | null> => {
    const b = AGENT_BOOKINGS.find((x) => x.number === number)
    const s = b && sailingById(b.sailingId)
    if (!b || !s) return null
    const plan = paymentPlan(bookingTotal(s.id, b.category, b.guests), s.departure, finalPaymentDays('gerald'))
    const checkin = await checkinStatus(s)
    return {
      number, kind: 'linked', sailingId: s.id, departure: s.departure, categoryName: categoryById(b.category)!.name, guests: b.guests, daysToDeparture: daysBetween(today(), s.departure),
      plan, payment: 'paid', documents: null, checkin, agent: b.agent, next: nextAction({ payment: 'paid', documentsMissing: 0, checkinOpen: checkin.state === 'open', checkinDone: false }),
    }
  }

  const bookedTrip = async (b: BookingView): Promise<TripView> => {
    const checkin = await checkinStatus(sailingById(b.sailingId)!)
    const plan: PaymentPlan = { total: b.total, deposit: b.paid, balance: b.balance, finalDue: b.finalDue, booked: dateIn(b.createdAt, 'America/New_York') }
    return {
      number: b.number, kind: 'booked', sailingId: b.sailingId, departure: b.departure, categoryName: b.categoryName, guests: b.people.length, daysToDeparture: b.daysToDeparture,
      plan, payment: b.payment, documents: null, checkin, next: nextAction({ payment: b.payment, documentsMissing: 0, checkinOpen: checkin.state === 'open', checkinDone: false }),
    }
  }

  const checkinApi = createCheckinApi({ store: ctx.store, channel: ctx.channel, actor, adult, now, save, log, cardsOf, profileOf, run, sailing: () => sailingById(ctx.demo().sailingId)!, documents: documentsView, terminalMoved: () => ctx.demo().scenarios.includes('terminalChange') })
  const plan = createPlanApi({ store: ctx.store, channel: ctx.channel, who, actor, adult, now, today, save, log, newId, cardsOf, profileOf, run, sailing: () => sailingById(ctx.demo().sailingId)!, trip: currentTrip, documents: documentsView })

  const onboard = createOnboardApi({ store: ctx.store, channel: ctx.channel, who, actor, adult, now, save, profileOf, run, sailing: () => sailingById(ctx.demo().sailingId)!, demo: ctx.demo, reads: plan })
  const service = createServiceApi({
    store: ctx.store, who, actor, adult, now, save, newId, run, demo: ctx.demo,
    callback: async (phone) => { await put('ticket', { kind: 'callback', detail: phone }) },
  })

  const tripsView = async (): Promise<TripsView> => {
    const booked = await booking.list()
    const bookedTrips = await Promise.all(booked.filter((b) => b.status === 'confirmed').map(bookedTrip))
    const all = [await currentTrip(), ...(await Promise.all((await linkedNumbers()).map(linkedTrip))).filter((t): t is TripView => !!t), ...bookedTrips]
    const day = today()
    const sailed = all.filter((t) => addDays(t.departure, NIGHTS) < day)
    const cancelled = booked.filter((b) => b.status === 'cancelled').map((b): PastTrip => ({ ...sailedPast(sailingById(b.sailingId)!), id: b.number, cancelled: true }))
    const upcoming = all.filter((t) => !sailed.includes(t)).sort((a, b) => a.departure.localeCompare(b.departure))
    const past = [...sailed.map((t) => sailedPast(sailingById(t.sailingId)!)), ...cancelled, ...pastTrips(who())].sort((a, b) => b.departure.localeCompare(a.departure))
    return { upcoming, past }
  }

  const paymentsView = async (): Promise<PaymentsView> => {
    const trip = await currentTrip()
    const record = await balancePaidRecord()
    const receipts: Receipt[] = [{ id: `RC-${trip.number}-1`, label: 'deposit', cents: trip.plan.deposit, at: zonedToEpoch(trip.plan.booked, '12:00', 'America/New_York'), method: 'Visa ending 4242' }]
    if (trip.payment === 'paid' && trip.plan.balance > 0) {
      const d = record?.data as { brand?: CardBrand; last4?: string } | undefined
      receipts.push({ id: `RC-${trip.number}-2`, label: 'balance', cents: trip.plan.balance, at: record?.updatedAt ?? zonedToEpoch(trip.plan.finalDue, '12:00', 'America/New_York'), method: d?.brand && d.last4 ? `${BRAND_NAMES[d.brand]} ending ${d.last4}` : 'Visa ending 4242' })
    }
    return { trip, receipts, cards: await cardsOf(), canPay: !actor().child }
  }

  const profileView = async (id: PersonaId): Promise<ProfileView> => {
    const s = sailingById(ctx.demo().sailingId)!
    return { id, profile: await profileOf(id), canEdit: !actor().child, daysToDeparture: daysBetween(today(), s.departure) }
  }

  const helperOf = async (): Promise<Helper | null> => {
    const record = await ctx.store.get('helper', who(), 'me')
    if (record) return normalizeHelper(record.data)
    const seed = SEEDED_HELPER[who()]
    return seed ? { ...seed, at: 0 } : null
  }
  const ticket = (r: DataRecord): Ticket => {
    const d = r.data as { kind: Ticket['kind']; detail: string }
    return { id: r.id, kind: d.kind, at: r.updatedAt, status: ticketStatus(r.updatedAt, now()), detail: d.detail }
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
    ...checkinApi,
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
        const prefs = new Map(await Promise.all(ids.map(async (id): Promise<[PersonaId, ChatPrefs]> => [id, chatPrefsOf((await ctx.store.get('chatPrefs', id, 'me'))?.data)])))
        return lists.flat().sort((a, b) => a.updatedAt - b.updatedAt).map((r): Message => {
          const from = r.owner as PersonaId
          const base: Message = { id: r.id, from, text: (r.data as { text: string }).text, at: r.updatedAt }
          if (!prefs.get(from)?.receipts) return base
          return { ...base, seenBy: ids.filter((id) => id !== from && prefs.get(id)?.receipts && (prefs.get(id)?.seenAt ?? 0) >= r.updatedAt) }
        })
      }),
      send: (text) => run('messages.send', async () => {
        if (!text.trim()) throw new ApiError('invalid', 'A message needs some text')
        const item = await save('message', who(), newId('msg'), { text: text.trim() })
        return { id: item.id, from: who(), text: text.trim(), at: item.at }
      }),
      receipts: () => run('messages.receipts', async () => chatPrefsOf((await ctx.store.get('chatPrefs', who(), 'me'))?.data).receipts),
      setReceipts: (on) => run('messages.setReceipts', async () => {
        const current = chatPrefsOf((await ctx.store.get('chatPrefs', who(), 'me'))?.data)
        await save('chatPrefs', who(), 'me', { ...current, receipts: !!on })
        return !!on
      }),
      markSeen: () => run('messages.markSeen', async () => {
        const current = chatPrefsOf((await ctx.store.get('chatPrefs', who(), 'me'))?.data)
        if (current.receipts) await save('chatPrefs', who(), 'me', { ...current, seenAt: now() })
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
      entitlements: () => run('folio.entitlements', () => plan.entitlementsOf(who())),
    },
    requests: {
      list: () => run('requests.list', () => mine('request')),
      create: (kind, note) => run('requests.create', () => save('request', who(), newId('req'), { kind, note, status: 'received' })),
    },
    ports: {
      today: () => run('ports.today', () => portAt(sailingById(ctx.demo().sailingId)!, now())),
    },
    onboard,
    service,
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
    account: {
      party: () => run('account.party', () => partyOf(who()).map((p) => ({ id: p.id, name: p.name, age: p.age, child: p.child }))),
      profile: (id) => run('account.profile', () => {
        if (!inParty(id)) throw new ApiError('forbidden', 'Not on your booking')
        return profileView(id)
      }),
      saveProfile: (id, profile) => run('account.saveProfile', async () => {
        adult()
        if (!inParty(id)) throw new ApiError('forbidden', 'Not on your booking')
        const next = normalizeProfile(profile, id)
        if (Object.keys(validateProfile(next, today(), personaById(id)!.child)).length > 0) throw new ApiError('invalid', 'Some details need correcting')
        const before = await profileOf(id)
        const view = await profileView(id)
        const rule = nameChange(`${before.firstName} ${before.lastName}`, `${next.firstName} ${next.lastName}`, view.daysToDeparture)
        if (!rule.allowed) throw new ApiError('conflict', rule.reason)
        await save('profile', id, 'me', next)
        await log('profile', `${next.firstName} ${next.lastName}`.trim())
        return profileView(id)
      }),
      helper: () => run('account.helper', helperOf),
      saveHelper: (input) => run('account.saveHelper', async () => {
        adult()
        const name = input.name.trim()
        if (!name) throw new ApiError('invalid', 'A helper needs a name')
        const permissions = PERMISSIONS.filter((x) => input.permissions.includes(x) || (x === 'view' && input.permissions.length > 0))
        const helper: Helper = { name: name.slice(0, 80), relationship: input.relationship.trim().slice(0, 40), permissions, status: input.status, at: now() }
        await save('helper', who(), 'me', helper)
        await log('helper', `${helper.name}: ${helper.status}`)
        return helper
      }),
      revokeHelper: () => run('account.revokeHelper', async () => {
        adult()
        const current = await helperOf()
        if (!current) throw new ApiError('notFound')
        const helper: Helper = { ...current, status: 'revoked', at: now() }
        await save('helper', who(), 'me', helper)
        await log('helper', `${helper.name}: revoked`)
        return helper
      }),
      history: () => run('account.history', async () => (await ctx.store.list('history', actor().booker)).reverse().map((r): HistoryEntry => ({ id: r.id, at: r.updatedAt, ...(r.data as Pick<HistoryEntry, 'by' | 'what' | 'detail'>) }))),
    },
    trips: {
      list: () => run('trips.list', tripsView),
      get: (number) => run('trips.get', async () => {
        const hit = (await tripsView()).upcoming.find((t) => t.number === number)
        if (!hit) throw new ApiError('notFound')
        return hit
      }),
      link: (number, lastName, departure) => run('trips.link', async () => {
        adult()
        const linked = await linkedNumbers()
        const result = matchBooking(number, lastName, departure, [...linked, bookingNumber(actor().booker)])
        if (!result.ok) throw new ApiError(result.reason === 'format' ? 'invalid' : result.reason === 'noMatch' ? 'notFound' : 'conflict', result.reason)
        await save('linked', who(), result.booking.number, {})
        await log('trip', result.booking.number)
        return (await linkedTrip(result.booking.number))!
      }),
    },
    payments: {
      get: () => run('payments.get', paymentsView),
      addCard: (brand, last4, expiry) => run('payments.addCard', async () => {
        adult()
        if (!CARD_BRANDS.includes(brand) || validateCard(last4, expiry, today())) throw new ApiError('invalid', 'Check the card details')
        const cards = await saveCards([...(await cardsOf()), { id: newId('card'), brand, last4, expiry }])
        await log('card', `${BRAND_NAMES[brand]} ending ${last4}: added`)
        return cards
      }),
      removeCard: (id) => run('payments.removeCard', async () => {
        adult()
        const cards = await cardsOf()
        const card = cards.find((c) => c.id === id)
        if (!card) throw new ApiError('notFound')
        const rest = await saveCards(cards.filter((c) => c.id !== id))
        await log('card', `${BRAND_NAMES[card.brand]} ending ${card.last4}: removed`)
        return rest
      }),
      payBalance: (cardId) => run('payments.payBalance', async () => {
        adult()
        const view = await paymentsView()
        if (view.trip.payment === 'paid') throw new ApiError('conflict', 'Already paid')
        const card = view.cards.find((c) => c.id === cardId)
        if (!card || validateCard(card.last4, card.expiry, today())) throw new ApiError('invalid', 'Choose a card that has not expired')
        await save('payment', actor().booker, 'final', { cents: view.trip.plan.balance, brand: card.brand, last4: card.last4, by: actor().id })
        await log('payment', `${view.trip.plan.balance / 100} paid by ${BRAND_NAMES[card.brand]} ending ${card.last4}`)
        return paymentsView()
      }),
    },
    documents: {
      get: () => run('documents.get', documentsView),
      set: (guest, doc, held) => run('documents.set', async () => {
        adult()
        if (!inParty(guest)) throw new ApiError('forbidden', 'Not on your booking')
        if (!DOC_IDS.includes(doc)) throw new ApiError('invalid', 'Unknown document')
        const current = { ...(await heldOf(guest)) }
        if (held === null) delete current[doc]
        else {
          const expires = held.expires
          if (DOCS[doc].hasExpiry && expires !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires)))) throw new ApiError('invalid', 'Check the expiry date')
          current[doc] = DOCS[doc].hasExpiry && expires ? { expires } : {}
        }
        await save('documents', actor().booker, guest, current)
        await log('documents', `${personaById(guest)!.firstName}: ${DOCS[doc].name}${held === null ? ' removed' : ''}`)
        return documentsView()
      }),
    },
    notifications: {
      list: () => run('notifications.list', async () => {
        const trip = await currentTrip()
        const read = new Set(((await ctx.store.get('noticeRead', who(), 'ids'))?.data as { ids?: string[] } | undefined)?.ids ?? [])
        const notices = buildNotices({
          payment: trip.payment, finalDue: trip.plan.finalDue, documentsMissing: trip.documents?.missing ?? 0, passportProblems: trip.documents?.passportProblems ?? 0,
          checkinState: trip.checkin.state, checkinOpens: dateIn(trip.checkin.opensAt, 'America/New_York'),
        })
        const prefsRecord = await ctx.store.get('prefs', who(), 'notifications')
        return { notices: notices.map((n) => ({ ...n, read: read.has(n.id) })), prefs: normalizePrefs(prefsRecord?.data) }
      }),
      markRead: (ids) => run('notifications.markRead', async () => {
        const record = await ctx.store.get('noticeRead', who(), 'ids')
        const have = (record?.data as { ids?: string[] } | undefined)?.ids ?? []
        await save('noticeRead', who(), 'ids', { ids: [...new Set([...have, ...ids.filter((i) => typeof i === 'string')])] })
      }),
      savePrefs: (prefs) => run('notifications.savePrefs', async () => {
        adult()
        const next: NotificationPrefs = normalizePrefs(prefs)
        await save('prefs', who(), 'notifications', next)
        return next
      }),
    },
    support: {
      tickets: () => run('support.tickets', async () => (await mine('ticket')).reverse().map((i) => ({ id: i.id, at: i.at, ...(i.data as { kind: Ticket['kind']; detail: string }), status: ticketStatus(i.at, now()) }))),
      callback: (phone) => run('support.callback', async () => {
        if (!phoneOk(phone)) throw new ApiError('invalid', 'Check the phone number')
        return ticket(await put('ticket', { kind: 'callback', detail: phone.trim() }))
      }),
      email: (message) => run('support.email', async () => {
        if (!message.trim()) throw new ApiError('invalid', 'Write a message first')
        return ticket(await put('ticket', { kind: 'email', detail: message.trim().slice(0, 1000) }))
      }),
    },
    booking: booking.api,
    plan: plan.api,
    help: {
      contacts: () => run('help.contacts', () => ({ guestServices: GUEST_SERVICES_NUMBER, emergency: EMERGENCY_NUMBER })),
    },
  }
}
