import { assistKind, ASSIST_KINDS, deadline, requestStatus, type AssistId } from '../domain/assistance'
import { buildChecklist, milestones, nextItem, progress, type AutoKey } from '../domain/checklist'
import { DINNER_DAYS, DINNER_TIMES, diningWindow, mealCharge, MAX_PARTY, planOf, SEATINGS, slotsFor, tableClash, venueById, type ReservedTable } from '../domain/dining'
import { balances, computeEntitlements, type Entitlements } from '../domain/entitlements'
import { conflictingGuests, daysToTour, dayOf, backBy, EXCURSIONS, excursionById, guestPrice, minAge, spotsLeft, timingProblem, tourRefund, needsTender, type ExcursionItem } from '../domain/excursions'
import { ADD_ONS, ADD_ON_IDS, addOnPrice, bestPackage, canCancelPurchase, isAddOnId, priceState, SEEDED_PURCHASES, unitPrice, units, upgradeBase, upgradePrice, upgradesFrom } from '../domain/packages'
import { buildPackingList, elegantNights, weatherFor } from '../domain/packing'
import { buildPlan } from '../domain/plan'
import { partyOf, personaById, type PackageId, type PersonaId } from '../domain/personas'
import { NIGHTS } from '../domain/pricing'
import type { Sailing } from '../domain/sailings'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { arrivalWindows, EMPTY_PLAN, isMode, isWindow, normalizePlan, suggestedWindow, HOTELS, type TravelPlan } from '../domain/travel'
import { daysBetween } from '../domain/trip'
import type { DietaryId, NeedId } from '../domain/account'
import { createAuthoriser, type BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import type { AddOnOffer, AssistanceView, AssistRequest, BuyInput, CartLine, DiningView, ExcursionsView, PackagesView, PartyMember, PersonEntitlements, PlanApi, PurchaseView, Reservation, TourBooking, TripView, DocumentsView } from './types'

/** What the pre-book part of the mock needs from the rest of the mock. */
export interface PlanDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'today' | 'save' | 'log' | 'newId' | 'cardsOf' | 'profileOf' | 'run'> {
  sailing: () => Sailing
  trip: () => Promise<TripView>
  documents: () => Promise<DocumentsView>
}

interface StoredTour { excursionId: string; guests: PersonaId[]; total: number; credit: number; cash: number; kept: number; refunded: number; methods: string[]; status: 'booked' | 'cancelled' }
interface StoredTable { venueId: string; day: number; time: string; guests: PersonaId[]; note: string; covered: PersonaId[]; charge: number }
interface StoredPurchase { kind: 'addOn' | 'upgrade'; item: string; from?: PackageId; guests: PersonaId[]; unit: number; units: number; methods: string[]; at: number; seededDaysBefore?: number }
interface PurchaseMod { status?: 'active' | 'cancelled'; credited?: number }
interface Row<T> { id: string; at: number; data: T }

const UPGRADE_CHANGE = { atDays: 15, share: 0.1 }

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function createPlanApi(d: PlanDeps): { api: PlanApi; entitlementsOf: (id: PersonaId) => Promise<{ entitlements: Entitlements; balances: ReturnType<typeof balances> }> } {
  const authorise = createAuthoriser(d)
  const owner = () => d.actor().booker
  const rows = async <T>(kind: string): Promise<Row<T>[]> => (await d.store.list(kind, owner())).map((r) => ({ id: r.id, at: r.updatedAt, data: r.data as T }))
  const one = async <T>(kind: string, id: string): Promise<T | null> => ((await d.store.get(kind, owner(), id))?.data as T | undefined) ?? null
  const put = (kind: string, id: string, data: unknown) => d.save(kind, owner(), id, data)
  const drop = async (kind: string, id: string) => { await d.store.delete(kind, owner(), id); d.channel?.post({ type: 'records', kind, owner: owner() }) }

  const party = (): PartyMember[] => partyOf(d.who()).map((p) => ({ id: p.id, name: p.name, age: p.age, child: p.child }))
  const inParty = (id: unknown): id is PersonaId => partyOf(d.who()).some((p) => p.id === id)
  const guestsIn = (raw: readonly unknown[]): PersonaId[] => {
    const list = [...new Set(raw)]
    if (list.length === 0 || !list.every(inParty)) throw new ApiError('invalid', 'Choose who is going from your booking')
    return list as PersonaId[]
  }
  const ageOf = (id: PersonaId) => personaById(id)!.age
  const daysToDeparture = () => daysBetween(d.today(), d.sailing().departure)
  const writable = () => { d.adult(); if (daysToDeparture() < 1) throw new ApiError('conflict', 'closed') }

  // ---- Purchases and entitlements ----

  const purchases = async (): Promise<PurchaseView[]> => {
    const stored = await rows<StoredPurchase>('purchase')
    const s = d.sailing()
    const seeds = (SEEDED_PURCHASES[owner()] ?? []).map((p): Row<StoredPurchase> => {
      const a = ADD_ONS[p.item]
      return { id: `seed-${p.item}`, at: zonedToEpoch(addDays(s.departure, -p.boughtDaysBefore), '12:00', 'America/New_York'), data: { kind: 'addOn', item: p.item, guests: p.guests as PersonaId[], unit: unitPrice(a.base, a.change, p.boughtDaysBefore), units: units(a.unit, p.guests.length), methods: ['Visa ending 4242'], at: 0, seededDaysBefore: p.boughtDaysBefore } }
    })
    const mods = new Map((await rows<PurchaseMod>('purchaseMod')).map((m) => [m.id, m.data]))
    const days = daysToDeparture()
    return [...seeds, ...stored].map((r): PurchaseView => {
      const x = r.data
      const mod = mods.get(r.id) ?? {}
      const now = x.kind === 'addOn' ? addOnPrice(x.item as keyof typeof ADD_ONS, days) : upgradePrice({ from: x.from!, to: x.item as 'plus' | 'premier', base: upgradeBase(x.from!, x.item as 'plus' | 'premier'), change: UPGRADE_CHANGE }, days)
      const p = priceState(x.unit, now)
      const status = mod.status ?? 'active'
      return {
        id: r.id, kind: x.kind, item: x.item as PurchaseView['item'], guests: x.guests, unit: x.unit, units: x.units, total: x.unit * x.units, at: r.at, methods: x.methods, status,
        price: { state: p.state, perUnit: p.perUnit, total: p.perUnit * x.units }, credited: mod.credited ?? 0, canCancel: status === 'active' && canCancelPurchase(days),
      }
    })
  }
  const tours = async (): Promise<Row<StoredTour>[]> => rows<StoredTour>('tour')
  const tables = async (): Promise<Row<StoredTable>[]> => rows<StoredTable>('table')

  const effective = (id: PersonaId, ps: readonly PurchaseView[]): PackageId =>
    ps.filter((p) => p.kind === 'upgrade' && p.status === 'active' && p.guests.includes(id)).reduce((best, p) => bestPackage(best, p.item as PackageId), personaById(id)!.package)

  const entitlementsFor = (id: PersonaId, ps: readonly PurchaseView[]): Entitlements => {
    const p = personaById(id)!
    const e = computeEntitlements({ tier: p.tier, package: effective(id, ps), sanctuary: p.sanctuary })
    for (const x of ps) {
      if (x.kind !== 'addOn' || x.status !== 'active' || !x.guests.includes(id)) continue
      if (x.item === 'drinks') e.drinkCapUsd = Math.max(e.drinkCapUsd, 15)
      if (x.item === 'wifi') e.wifiDevices += 1
      if (x.item === 'specialtyPass') e.specialtyMeals += 3
      if (x.item === 'laundry' && !e.perks.includes('freeLaundry')) e.perks = [...e.perks, 'freeLaundry']
    }
    return e
  }

  const mealsUsed = (ts: readonly Row<StoredTable>[], id: PersonaId): number => ts.filter((t) => t.data.covered.includes(id)).length

  const creditOf = (ps: readonly PurchaseView[], ts: readonly Row<StoredTour>[]) => {
    const total = party().reduce((n, g) => n + entitlementsFor(g.id, ps).excursionCreditUsd * 100, 0)
    const used = ts.reduce((n, t) => n + t.data.credit, 0)
    return { total, used, remaining: Math.max(0, total - used) }
  }

  const entitlementsOf = async (id: PersonaId) => {
    const ps = await purchases()
    const e = entitlementsFor(id, ps)
    return { entitlements: e, balances: balances(e, { specialtyMeals: mealsUsed(await tables(), id) }) }
  }

  // ---- Excursions ----

  const cartLines = async (): Promise<{ excursionId: string; guests: PersonaId[] }[]> => {
    const raw = (await one<{ lines?: unknown }>('tourCart', 'cart'))?.lines
    if (!Array.isArray(raw)) return []
    return raw.flatMap((l: { excursionId?: unknown; guests?: unknown }) => (excursionById(l?.excursionId) && Array.isArray(l.guests) && l.guests.every(inParty) ? [{ excursionId: l.excursionId as string, guests: l.guests as PersonaId[] }] : []))
  }
  const saveCart = (lines: { excursionId: string; guests: PersonaId[] }[]) => put('tourCart', 'cart', { lines })
  const priceFor = (x: ExcursionItem, guests: readonly PersonaId[]) => guests.reduce((n, g) => n + guestPrice(x, ageOf(g)), 0)

  const excursionsView = async (): Promise<ExcursionsView> => {
    const s = d.sailing()
    const [ts, ps, lines] = [await tours(), await purchases(), await cartLines()]
    const days = daysToDeparture()
    const active = ts.filter((t) => t.data.status === 'booked')
    const credit = creditOf(ps, ts)
    const cart: CartLine[] = lines.map((l) => ({ ...l, total: priceFor(excursionById(l.excursionId)!, l.guests) }))
    const cartTotal = cart.reduce((n, l) => n + l.total, 0)
    const booked: TourBooking[] = ts
      .map((t): TourBooking => {
        const x = excursionById(t.data.excursionId)!
        const cancel = t.data.status === 'booked' ? tourRefund(t.data.total, daysToTour(d.today(), s, x)) : { fee: t.data.kept, refund: t.data.refunded, free: t.data.kept === 0 }
        return { id: t.id, excursionId: x.id, guests: t.data.guests, total: t.data.total, credit: t.data.credit, methods: t.data.methods, at: t.at, status: t.data.status, cancel }
      })
      .sort((a, b) => a.at - b.at)
    return {
      offers: EXCURSIONS.map((x) => {
        const day = dayOf(s, x)
        const here = active.filter((t) => t.data.excursionId === x.id).reduce((n, t) => n + t.data.guests.length, 0)
        return { item: x, date: day.date, day: day.day, spots: spotsLeft(x, s.id, here), timing: timingProblem(x, day), backBy: backBy(x, day), daysToTour: daysToTour(d.today(), s, x), tender: needsTender(x) }
      }),
      booked, cart, cartTotal, creditLeft: credit.remaining, creditApplied: Math.min(credit.remaining, cartTotal), party: party(), canBook: !d.actor().child && days >= 1, daysToDeparture: days,
    }
  }

  /** Checks one tour for a set of guests against what is already booked or in the cart. Throws a `conflict` that names the problem. */
  const checkTour = async (x: ExcursionItem, guests: PersonaId[], others: { excursionId: string; guests: string[] }[], ignoreBooking?: string): Promise<void> => {
    const s = d.sailing()
    const day = dayOf(s, x)
    if (daysToTour(d.today(), s, x) < 0 || daysToDeparture() < 1) throw new ApiError('conflict', 'closed')
    if (guests.some((g) => ageOf(g) < minAge(x)) || !guests.some((g) => ageOf(g) >= 18)) throw new ApiError('conflict', 'age')
    if (timingProblem(x, day)) throw new ApiError('conflict', 'timing')
    const bookedHere = (await tours()).filter((t) => t.data.status === 'booked' && t.data.excursionId === x.id && t.id !== ignoreBooking).reduce((n, t) => n + t.data.guests.length, 0)
    if (spotsLeft(x, s.id, bookedHere) < guests.length) throw new ApiError('conflict', 'soldOut')
    if (others.some((o) => o.excursionId === x.id && o.guests.some((g) => guests.includes(g as PersonaId)))) throw new ApiError('conflict', 'duplicate')
    if (conflictingGuests(others, x, guests).length > 0) throw new ApiError('conflict', 'overlap')
  }
  const activeTours = async (ignore?: string) => (await tours()).filter((t) => t.data.status === 'booked' && t.id !== ignore).map((t) => ({ excursionId: t.data.excursionId, guests: t.data.guests as string[] }))

  // ---- Dining ----

  const diningOf = async (): Promise<DiningView> => {
    const booker = personaById(owner())!
    const [trip, ps, ts] = [await d.trip(), await purchases(), await tables()]
    const plan = planOf(booker.id)
    const ent = entitlementsFor(booker.id, ps)
    const profiles = await Promise.all(party().map(async (g) => ({ id: g.id, needs: (await d.profileOf(g.id)).dietary as DietaryId[] })))
    const meals = party().reduce((n, g) => n + Math.max(0, entitlementsFor(g.id, ps).specialtyMeals - mealsUsed(ts, g.id)), 0)
    const s = d.sailing()
    const reservations: Reservation[] = ts
      .map((t): Reservation => {
        const date = addDays(s.departure, t.data.day - 1)
        return {
          id: t.id, venueId: t.data.venueId, day: t.data.day, time: t.data.time, guests: t.data.guests, note: t.data.note, covered: t.data.covered, charge: t.data.charge, at: t.at, reminderOn: addDays(date, -1),
          dietary: t.data.guests.flatMap((g) => { const p = profiles.find((x) => x.id === g); return p && p.needs.length > 0 ? [{ name: personaById(g)!.firstName, needs: p.needs }] : [] }),
        }
      })
      .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    return {
      window: diningWindow(ent, trip.payment, trip.plan.finalDue), plan, seating: plan === 'anytime' ? null : SEATINGS[plan], reservations, party: party(), mealsLeft: meals,
      canBook: !d.actor().child && daysToDeparture() >= 1, daysToDeparture: daysToDeparture(),
    }
  }

  // ---- Assistance, checklist, packing, travel ----

  const requests = async (): Promise<AssistRequest[]> => {
    const s = d.sailing()
    return (await rows<{ kind: AssistId; guest: PersonaId; note: string; madeOn: string }>('assist')).map((r) => ({ id: r.id, kind: r.data.kind, guest: r.data.guest, note: r.data.note, at: r.at, status: requestStatus(assistKind(r.data.kind)!, s.departure, r.data.madeOn, r.at, d.now()) })).sort((a, b) => b.at - a.at)
  }
  const ticks = async (kind: 'checklist' | 'packing'): Promise<string[]> => {
    const ids = (await one<{ ids?: unknown }>('tick', kind))?.ids
    return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : []
  }
  const setTick = async (kind: 'checklist' | 'packing', id: string, done: boolean, known: readonly string[]) => {
    d.adult()
    if (!known.includes(id)) throw new ApiError('invalid', 'Unknown item')
    const have = (await ticks(kind)).filter((x) => x !== id)
    await put('tick', kind, { ids: done ? [...have, id] : have })
  }
  const priority = (): boolean => {
    const p = personaById(owner())!
    return computeEntitlements({ tier: p.tier, package: p.package, sanctuary: p.sanctuary }).perks.includes('priorityEmbarkation')
  }
  const travelPlan = async (): Promise<TravelPlan> => normalizePlan(await one('travel', 'plan'), priority())

  const checklistView = async () => {
    const trip = await d.trip()
    const docs = trip.documents
    const auto: Record<AutoKey, boolean> = {
      paid: trip.payment === 'paid',
      documents: !docs || (docs.missing === 0 && docs.passportProblems === 0),
      tours: (await tours()).some((t) => t.data.status === 'booked'),
      dining: (await tables()).length > 0,
      assistance: (await requests()).length > 0,
      travel: (await travelPlan()).window !== null,
      checkin: trip.checkin.state === 'done',
    }
    const entries = buildChecklist({ departure: trip.departure, today: d.today(), daysToDeparture: trip.daysToDeparture, auto, ticked: await ticks('checklist') })
    return { entries, milestones: milestones(entries), progress: progress(entries), next: nextItem(entries), daysToDeparture: trip.daysToDeparture }
  }

  const packingView = async () => {
    const s = d.sailing()
    const profiles = await Promise.all(party().map((g) => d.profileOf(g.id)))
    const assist = await requests()
    const needs = [...new Set([...profiles.flatMap((p) => p.needs), ...assist.flatMap((r) => assistKind(r.kind)?.need ?? [])])]
    const items = buildPackingList({
      departure: s.departure, nights: NIGHTS, tours: (await tours()).filter((t) => t.data.status === 'booked').map((t) => t.data.excursionId), ages: party().map((g) => g.age), needs, tender: true, elegantNights: elegantNights(NIGHTS),
    })
    const known = new Set(items.map((i) => i.id))
    return { items, ticked: (await ticks('packing')).filter((i) => known.has(i)), weather: weatherFor(s.departure), nights: NIGHTS, daysToDeparture: daysToDeparture() }
  }

  const packagesView = async (): Promise<PackagesView> => {
    const days = daysToDeparture()
    const s = d.sailing()
    const [ps, ts] = [await purchases(), await tours()]
    const active = ps.filter((p) => p.status === 'active')
    const held = (id: string, g: PersonaId) => active.some((p) => p.kind === 'addOn' && p.item === id && p.guests.includes(g))
    const changeOn = (atDays: number) => addDays(s.departure, -(atDays - 1))
    const addOns: AddOnOffer[] = ADD_ON_IDS.map((id) => {
      const a = ADD_ONS[id]
      const after = unitPrice(a.base, a.change, a.change.atDays - 1)
      return { id, unit: a.unit, price: addOnPrice(id, days), base: a.base, changeOn: a.change.share === 0 ? '' : changeOn(a.change.atDays), changesTo: after, eligible: party().filter((g) => g.age >= a.minAge && !held(id, g.id)) }
    })
    const upgrades = party().flatMap((g) => {
      const from = effective(g.id, ps)
      const options = upgradesFrom(from).map((u) => ({ to: u.to, price: upgradePrice(u, days), changeOn: changeOn(u.change.atDays), changesTo: unitPrice(u.base, u.change, u.change.atDays - 1) }))
      return options.length > 0 ? [{ guest: g.id, name: g.name, from, options }] : []
    })
    const used = await tables()
    const people: PersonEntitlements[] = party().map((g) => {
      const e = entitlementsFor(g.id, ps)
      return { id: g.id, name: g.name, package: effective(g.id, ps), entitlements: e, balances: balances(e, { specialtyMeals: mealsUsed(used, g.id) }) }
    })
    return { addOns, upgrades, purchases: ps.sort((a, b) => b.at - a.at), people, credit: creditOf(ps, ts), party: party(), daysToDeparture: days, canBuy: !d.actor().child && days >= 1 }
  }

  const assistanceView = async (): Promise<AssistanceView> => {
    const s = d.sailing()
    const needs: Partial<Record<PersonaId, NeedId[]>> = {}
    for (const g of party()) { const n = (await d.profileOf(g.id)).needs; if (n.length > 0) needs[g.id] = n }
    return { deadlines: ASSIST_KINDS.map((k) => ({ kind: k.id, deadline: deadline(k, s.departure, d.today()) })), requests: await requests(), party: party(), canRequest: !d.actor().child && daysToDeparture() >= 1, daysToDeparture: daysToDeparture(), needs }
  }

  const api: PlanApi = {
    overview: () => d.run('plan.overview', async () => {
      const s = d.sailing()
      const ts = (await tours()).filter((t) => t.data.status === 'booked').map((t) => ({ id: t.id, excursionId: t.data.excursionId, guests: t.data.guests as string[] }))
      const tb = (await tables()).map((t) => ({ id: t.id, venueId: t.data.venueId, day: t.data.day, time: t.data.time, guests: t.data.guests as string[] }))
      return { days: buildPlan(s, ts, tb), daysToDeparture: daysToDeparture(), departure: s.departure }
    }),

    excursions: {
      list: () => d.run('plan.excursions.list', excursionsView),
      addToCart: (excursionId, guests) => d.run('plan.excursions.addToCart', async () => {
        writable()
        const x = excursionById(excursionId)
        if (!x) throw new ApiError('invalid', 'Unknown tour')
        const who = guestsIn(guests)
        const lines = await cartLines()
        await checkTour(x, who, [...(await activeTours()), ...lines.filter((l) => l.excursionId !== x.id)])
        await saveCart([...lines.filter((l) => l.excursionId !== x.id), { excursionId: x.id, guests: who }])
        return excursionsView()
      }),
      removeFromCart: (excursionId) => d.run('plan.excursions.removeFromCart', async () => {
        d.adult()
        await saveCart((await cartLines()).filter((l) => l.excursionId !== excursionId))
        return excursionsView()
      }),
      checkout: (parts, challenge) => d.run('plan.excursions.checkout', async () => {
        writable()
        const lines = await cartLines()
        if (lines.length === 0) throw new ApiError('invalid', 'The cart is empty')
        const booked = await activeTours()
        const added: { excursionId: string; guests: string[] }[] = []
        for (const l of lines) {
          await checkTour(excursionById(l.excursionId)!, l.guests, [...booked, ...added])
          added.push(l)
        }
        const priced = lines.map((l) => ({ ...l, total: priceFor(excursionById(l.excursionId)!, l.guests) }))
        const total = priced.reduce((n, l) => n + l.total, 0)
        const credit = creditOf(await purchases(), await tours())
        const applied = Math.min(credit.remaining, total)
        const due = total - applied
        const methods = due > 0 ? await authorise(parts, due, challenge) : []
        let creditLeft = applied
        for (const l of priced) {
          const useCredit = Math.min(creditLeft, l.total)
          creditLeft -= useCredit
          await put('tour', d.newId('tour'), { excursionId: l.excursionId, guests: l.guests, total: l.total, credit: useCredit, cash: l.total - useCredit, kept: 0, refunded: 0, methods, status: 'booked' } satisfies StoredTour)
        }
        await saveCart([])
        await d.log('tour', priced.map((l) => excursionById(l.excursionId)!.name).join(', '))
        return excursionsView()
      }),
      changeGuests: (bookingId, guests) => d.run('plan.excursions.changeGuests', async () => {
        d.adult()
        const t = (await tours()).find((r) => r.id === bookingId && r.data.status === 'booked')
        if (!t) throw new ApiError('notFound')
        const x = excursionById(t.data.excursionId)!
        const keep = guestsIn(guests)
        if (!keep.every((g) => t.data.guests.includes(g))) throw new ApiError('invalid', 'Only people already on the tour can stay')
        if (keep.length === t.data.guests.length) return excursionsView()
        if (!keep.some((g) => ageOf(g) >= 18)) throw new ApiError('conflict', 'age')
        await shrink(t, x, keep)
        await d.log('tour', `${x.name}: guests changed`)
        return excursionsView()
      }),
      cancel: (bookingId) => d.run('plan.excursions.cancel', async () => {
        d.adult()
        const t = (await tours()).find((r) => r.id === bookingId && r.data.status === 'booked')
        if (!t) throw new ApiError('notFound')
        const x = excursionById(t.data.excursionId)!
        await shrink(t, x, [])
        await d.log('tour', `${x.name}: cancelled`)
        return excursionsView()
      }),
    },

    dining: {
      view: () => d.run('plan.dining.view', diningOf),
      slots: (venueId, day) => d.run('plan.dining.slots', async () => {
        const v = venueById(venueId)
        if (!v || v.walkIn || !DINNER_DAYS.includes(day)) throw new ApiError('invalid', 'Choose a restaurant and a night')
        const mine = (await tables()).filter((t) => t.data.venueId === venueId && t.data.day === day)
        return slotsFor(venueId, d.sailing().id, day).map((s) => ({ ...s, tables: Math.max(0, s.tables - mine.filter((t) => t.data.time === s.time).length) }))
      }),
      reserve: (input) => d.run('plan.dining.reserve', async () => {
        writable()
        const v = venueById(input.venueId)
        if (!v || v.walkIn || !DINNER_DAYS.includes(input.day) || !DINNER_TIMES.includes(input.time)) throw new ApiError('invalid', 'Choose a restaurant, a night and a time')
        const who = guestsIn(input.guests)
        if (who.length > MAX_PARTY) throw new ApiError('invalid', 'Too many people for one table')
        if (!who.some((g) => ageOf(g) >= 18)) throw new ApiError('conflict', 'age')
        const view = await diningOf()
        if (!view.window.open) throw new ApiError('conflict', 'notOpen')
        if (v.kind === 'main' && view.plan !== 'anytime') throw new ApiError('conflict', 'fixedSeating')
        if (addDays(d.sailing().departure, input.day - 1) < d.today()) throw new ApiError('conflict', 'closed')
        const existing = await tables()
        const mine = existing.filter((t) => t.data.venueId === v.id && t.data.day === input.day && t.data.time === input.time).length
        const grid = slotsFor(v.id, d.sailing().id, input.day).find((s) => s.time === input.time)!
        if (grid.tables - mine <= 0) throw new ApiError('conflict', 'full')
        const reserved: ReservedTable[] = existing.map((t) => ({ venueId: t.data.venueId, day: t.data.day, time: t.data.time, guests: t.data.guests }))
        if (tableClash(reserved, input.day, input.time, who).length > 0) throw new ApiError('conflict', 'clash')
        const ps = await purchases()
        const left = new Map(party().map((g) => [g.id, Math.max(0, entitlementsFor(g.id, ps).specialtyMeals - mealsUsed(existing, g.id))]))
        const covered = v.kind === 'specialty' ? who.filter((g) => (left.get(g) ?? 0) > 0) : []
        const charge = mealCharge(v, who.length, covered.length).charge
        await put('table', d.newId('table'), { venueId: v.id, day: input.day, time: input.time, guests: who, note: str(input.note, 200), covered, charge } satisfies StoredTable)
        await d.log('dining', `${v.name}, night ${input.day}, ${input.time}`)
        return diningOf()
      }),
      cancel: (id) => d.run('plan.dining.cancel', async () => {
        d.adult()
        const t = (await tables()).find((r) => r.id === id)
        if (!t) throw new ApiError('notFound')
        await drop('table', id)
        await d.log('dining', `${venueById(t.data.venueId)?.name ?? t.data.venueId}, night ${t.data.day}: cancelled`)
        return diningOf()
      }),
    },

    packages: {
      view: () => d.run('plan.packages.view', packagesView),
      buy: (input: BuyInput, parts, challenge) => d.run('plan.packages.buy', async () => {
        writable()
        const days = daysToDeparture()
        const ps = (await purchases()).filter((p) => p.status === 'active')
        const who = guestsIn(input.guests)
        let record: StoredPurchase
        let total: number
        if (input.kind === 'addOn') {
          if (!isAddOnId(input.item)) throw new ApiError('invalid', 'Unknown add-on')
          const a = ADD_ONS[input.item]
          if (who.some((g) => ageOf(g) < a.minAge)) throw new ApiError('invalid', 'Some guests are too young for this')
          if (who.some((g) => ps.some((p) => p.kind === 'addOn' && p.item === a.id && p.guests.includes(g)))) throw new ApiError('conflict', 'held')
          const unit = addOnPrice(a.id, days)
          const n = units(a.unit, who.length)
          total = unit * n
          record = { kind: 'addOn', item: a.id, guests: who, unit, units: n, methods: [], at: 0 }
        } else {
          if (input.to !== 'plus' && input.to !== 'premier') throw new ApiError('invalid', 'Unknown package')
          const froms = who.map((g) => effective(g, ps))
          if (froms.some((f) => !upgradesFrom(f).some((u) => u.to === input.to))) throw new ApiError('invalid', 'A guest already has this package or better')
          if (new Set(froms).size > 1) throw new ApiError('invalid', 'Buy separately for guests who start from different packages')
          const unit = upgradePrice({ from: froms[0], to: input.to, base: upgradeBase(froms[0], input.to), change: UPGRADE_CHANGE }, days)
          total = unit * who.length
          record = { kind: 'upgrade', item: input.to, from: froms[0], guests: who, unit, units: who.length, methods: [], at: 0 }
        }
        if (total <= 0) throw new ApiError('invalid', 'Nothing to pay')
        record.methods = await authorise(parts, total, challenge)
        await put('purchase', d.newId('buy'), record)
        await d.log('purchase', input.kind === 'addOn' ? ADD_ONS[input.item].name : `${input.to} package`)
        return packagesView()
      }),
      claimDrop: (id) => d.run('plan.packages.claimDrop', async () => {
        d.adult()
        const p = (await purchases()).find((x) => x.id === id)
        if (!p) throw new ApiError('notFound')
        if (p.status !== 'active' || p.price.state !== 'dropped' || p.price.total <= p.credited) throw new ApiError('conflict', 'nothing')
        await put('purchaseMod', id, { status: p.status, credited: p.price.total } satisfies PurchaseMod)
        await d.log('purchase', `${p.item}: price drop credit`)
        return packagesView()
      }),
      cancel: (id) => d.run('plan.packages.cancel', async () => {
        d.adult()
        const p = (await purchases()).find((x) => x.id === id)
        if (!p) throw new ApiError('notFound')
        if (!p.canCancel) throw new ApiError('conflict', 'locked')
        await put('purchaseMod', id, { status: 'cancelled', credited: p.credited } satisfies PurchaseMod)
        await d.log('purchase', `${p.item}: cancelled`)
        return packagesView()
      }),
    },

    checklist: {
      get: () => d.run('plan.checklist.get', checklistView),
      tick: (id, done) => d.run('plan.checklist.tick', async () => {
        await setTick('checklist', id, done, (await checklistView()).entries.filter((e) => !e.automatic).map((e) => e.id))
        return checklistView()
      }),
    },

    packing: {
      get: () => d.run('plan.packing.get', packingView),
      tick: (id, done) => d.run('plan.packing.tick', async () => {
        await setTick('packing', id, done, (await packingView()).items.map((i) => i.id))
        return packingView()
      }),
    },

    travel: {
      get: () => d.run('plan.travel.get', async () => ({ plan: await travelPlan(), windows: arrivalWindows(priority()), priority: priority(), suggested: suggestedWindow(priority()), canEdit: !d.actor().child })),
      save: (plan) => d.run('plan.travel.save', async () => {
        d.adult()
        if ((plan.window !== null && !isWindow(plan.window, priority())) || (plan.mode !== null && !isMode(plan.mode)) || (plan.hotel !== null && !HOTELS.some((h) => h.id === plan.hotel))) throw new ApiError('invalid', 'Check your choices')
        await put('travel', 'plan', { ...EMPTY_PLAN, ...plan })
        await d.log('travel', plan.window ? `Arrive ${plan.window}` : 'Travel plan')
        return { plan: await travelPlan(), windows: arrivalWindows(priority()), priority: priority(), suggested: suggestedWindow(priority()), canEdit: true }
      }),
    },

    assistance: {
      get: () => d.run('plan.assistance.get', assistanceView),
      request: (input) => d.run('plan.assistance.request', async () => {
        writable()
        const kind = assistKind(input.kind)
        if (!kind) throw new ApiError('invalid', 'Unknown request')
        if (!inParty(input.guest)) throw new ApiError('invalid', 'Choose who it is for')
        const note = str(input.note, 300)
        if (kind.noteRequired && !note) throw new ApiError('invalid', 'Add a note')
        if ((await requests()).some((r) => r.kind === kind.id && r.guest === input.guest)) throw new ApiError('conflict', 'duplicate')
        await put('assist', d.newId('assist'), { kind: kind.id, guest: input.guest, note, madeOn: d.today() })
        if (kind.need) {
          const profile = await d.profileOf(input.guest)
          if (!profile.needs.includes(kind.need)) await d.save('profile', input.guest, 'me', { ...profile, needs: [...profile.needs, kind.need] })
        }
        await d.log('assistance', `${personaById(input.guest)!.firstName}: ${kind.id}`)
        return assistanceView()
      }),
      cancel: (id) => d.run('plan.assistance.cancel', async () => {
        d.adult()
        const r = (await requests()).find((x) => x.id === id)
        if (!r) throw new ApiError('notFound')
        await drop('assist', id)
        await d.log('assistance', `${personaById(r.guest)!.firstName}: ${r.kind} withdrawn`)
        return assistanceView()
      }),
    },
  }

  /** Removes guests from a tour (all of them cancels it). A refund goes to the card first, then back to the excursion credit; any fee is kept. */
  async function shrink(t: Row<StoredTour>, x: ExcursionItem, keep: PersonaId[]): Promise<void> {
    const cur = t.data
    const removed = priceFor(x, cur.guests.filter((g) => !keep.includes(g)))
    const rule = tourRefund(removed, daysToTour(d.today(), d.sailing(), x))
    const cash = Math.min(cur.cash, rule.refund)
    const credit = rule.refund - cash
    await put('tour', t.id, {
      ...cur, guests: keep.length > 0 ? keep : cur.guests, total: keep.length > 0 ? cur.total - removed : 0, cash: cur.cash - cash, credit: cur.credit - credit,
      kept: cur.kept + rule.fee, refunded: cur.refunded + rule.refund, status: keep.length > 0 ? 'booked' : 'cancelled',
    } satisfies StoredTour)
  }

  return { api, entitlementsOf }
}
