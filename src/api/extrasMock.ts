import { assignmentFor } from '../domain/boarding'
import { KID_ZONES, MEETING_PLACES, checkInProblem, clubById, clubFor, clubOpen, defaultZones, kidStatus, lastSeen, normalizeAuth, normalizeReunion, type Authorisation, type ReunionPlan } from '../domain/family'
import { GASTRO, isRequestKind, isSymptom, isolating, medicalOpen, nextOpening, reportProblem, type DayType, type RequestKind, type Symptom } from '../domain/health'
import { orderFolioLines, breakfastMornings, canCancel, canMove, itemById, locationProblem, orderProblem, orderProgress, OUT_AT_MENU, OUT_WHILE_PREPARING, priceOrder, type Choice, type Location, type OrderInput, type OrderKind, type OrderLine, type Priced } from '../domain/orders'
import { DOWNLOAD_BATCH, INCLUDED_WITH_PREMIER, OPTION_IDS, PHOTOGRAPHERS, PRICES, cheapest, photoOptions, photosFor, REDOWNLOAD_DAYS, type OptionId } from '../domain/photos'
import { LAUNDRY_NOTE_MAX, laundryPrice, laundryStage, laundryCancellable, pickupOptions, serviceById, SERVICES, type LaundryService } from '../domain/laundry'
import { DEFAULT_DEVICES, amenitiesFor, devicesProblem, dndCheckDue, hasView, housekeepingProblem, normalizeDevices, normalizeHousekeeping, stewardFor, type Devices, type Housekeeping } from '../domain/room'
import { INCLUDED_PLAN, MAX_DAYS, addProblem, expiresAt, planById, upgradeCost, usedTodayMb, type StoredDevice } from '../domain/wifi'
import type { FolioLine } from '../domain/folio'
import { partyOf, personaById, type PersonaId } from '../domain/personas'
import { itinerary, portAt, shipZoneAt, stageAt, type Sailing } from '../domain/sailings'
import { addDays, timeIn, zonedToEpoch } from '../domain/timezones'
import type { ScenarioId } from '../domain/scenarios'
import type { DemoState } from '../demo/state'
import type { BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import type { PlanReads } from './planMock'
import { ABOARD_STAGES, cruiseDay } from './onboardMock'
import type {
  FamilyApi, FamilyKid, FamilyView, HealthApi, HealthView, LaundryApi, LaundryRequest, LaundryView, OrderGuest, OrderMenuView, OrderView, OrdersApi, PhotoQuote, PhotoReceipt, PhotosApi, PhotosView, RoomApi, RoomView, WifiApi, WifiDeviceView, WifiView,
} from './types'

export interface ExtrasDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'newId' | 'run' | 'profileOf'> {
  sailing: () => Sailing
  demo: () => DemoState
  reads: PlanReads
}

export interface ExtrasApi {
  orders: OrdersApi
  family: FamilyApi
  health: HealthApi
  room: RoomApi
  photos: PhotosApi
  laundry: LaundryApi
  wifi: WifiApi
  /** Every charge these services have put on the account, for the folio. */
  folioLines: () => Promise<FolioLine[]>
}

interface StoredOrder {
  kind: OrderKind
  lines: OrderLine[]
  location: Location
  tip: number
  placedAt: number
  deliverAt?: number
  runsOut: number[]
  choices: Record<number, Choice>
  resolvedAt?: number
  cancelledAt?: number
  free: boolean
  by: PersonaId
  contacted: number
}

interface StoredReceipt { option: OptionId | 'included'; photoIds: string[]; paid: number; included: number; at: number; saved: number; by: PersonaId }
interface StoredLaundry { service: LaundryService; qty: number; pickupAt: number; hours: number; total: number; free: number; note: string; placedAt: number; seq: number; cancelledAt?: number; by: PersonaId }

export function createExtrasApi(d: ExtrasDeps): ExtrasApi {
  const booker = () => d.actor().booker
  const party = () => partyOf(d.who())
  const scenario = (id: ScenarioId) => d.demo().scenarios.includes(id)
  const aboard = () => (ABOARD_STAGES as readonly string[]).includes(stageAt(d.sailing(), d.now()))
  /** Actions on board need the ship to be under way (or boarded). */
  const needAboard = () => { if (!aboard()) throw new ApiError('conflict', 'closed') }
  const zone = () => shipZoneAt(d.sailing(), d.now())
  const dayAt = (at: number) => Math.min(8, Math.max(1, cruiseDay(d.sailing(), at)))
  const rows = async <T>(kind: string, owner: string = booker()): Promise<{ id: string; at: number; data: T }[]> => (await d.store.list(kind, owner)).map((r) => ({ id: r.id, at: r.updatedAt, data: r.data as T }))
  const one = async <T>(kind: string, id: string, owner: string = booker()): Promise<T | null> => ((await d.store.get(kind, owner, id))?.data as T | undefined) ?? null
  const put = (kind: string, id: string, data: unknown, owner: string = booker()) => d.save(kind, owner, id, data)
  const drop = async (kind: string, id: string, owner: string = booker()) => { await d.store.delete(kind, owner, id); d.channel?.post({ type: 'records', kind, owner }) }
  const inParty = (id: PersonaId) => party().some((g) => g.id === id)

  const entitlementsOfBooker = async () => (await d.reads.entitlementsOf(booker())).entitlements

  // ---- Orders (DIN-04, DIN-05, DIN-11) ----
  const guestsInfo = async (): Promise<OrderGuest[]> =>
    Promise.all(party().map(async (g) => ({ id: g.id, name: g.name, age: g.age, drinkCapUsd: (await d.reads.entitlementsOf(g.id)).entitlements.drinkCapUsd })))

  /** Whether anyone on the booking has reported illness recently, which makes meals and delivery free. */
  const partyIsolating = async (): Promise<boolean> => {
    const ats: number[] = []
    for (const g of party()) for (const r of await rows<{ guests: string[] }>('illness', g.id)) ats.push(r.at)
    return isolating(ats, d.now())
  }

  const orderView = async (id: string, o: StoredOrder, guests: OrderGuest[]): Promise<OrderView> => {
    const now = d.now()
    const priced = priceOrder(o.lines, { kind: o.kind, location: o.location, tip: o.tip, guests, free: o.free, choices: o.choices })
    const waiting = o.runsOut.filter((i) => !(i in o.choices))
    const progress = orderProgress({ kind: o.kind, placedAt: o.placedAt, deliverAt: o.deliverAt, cancelledAt: o.cancelledAt, pending: waiting.length > 0, resolvedAt: o.resolvedAt }, now)
    return {
      id, kind: o.kind, placedAt: o.placedAt, deliverAt: o.deliverAt ?? null, location: o.location, tip: o.tip, stage: progress.stage, etaAt: progress.etaAt,
      lines: priced.lines, fee: priced.fee, service: priced.service, total: priced.total, covered: priced.covered,
      unavailable: progress.stage === 'needsChoice' ? waiting : [], refund: o.cancelledAt !== undefined ? priced.total : 0,
      canCancel: canCancel(progress.stage), canMove: canMove(progress.stage), contacted: o.contacted, free: o.free,
    }
  }

  const orderOf = async (id: string): Promise<StoredOrder> => {
    const o = await one<StoredOrder>('orders', id)
    if (!o) throw new ApiError('notFound')
    return o
  }

  const orders: OrdersApi = {
    menu: () => d.run('orders.menu', async (): Promise<OrderMenuView> => {
      const open = aboard()
      const a = assignmentFor(booker(), d.sailing().id, (await d.profileOf(booker())).needs.includes('mobility'))
      return {
        open, outOfStock: scenario('orderStock') ? [...OUT_AT_MENU] : [], guests: await guestsInfo(), cabin: a.number, deck: a.deck,
        mornings: open ? breakfastMornings(d.sailing(), d.now()) : [], isolating: await partyIsolating(), canOrder: open && !d.actor().child,
      }
    }),

    list: () => d.run('orders.list', async () => {
      const guests = await guestsInfo()
      const all = await rows<StoredOrder>('orders')
      const views = await Promise.all(all.map((r) => orderView(r.id, r.data, guests)))
      return views.sort((a, b) => b.placedAt - a.placedAt)
    }),

    place: (input) => d.run('orders.place', async () => {
      d.adult()
      needAboard()
      const guests = await guestsInfo()
      const out = scenario('orderStock') ? OUT_AT_MENU : []
      const problem = orderProblem(input as OrderInput, guests, out)
      if (problem === 'unavailable') throw new ApiError('conflict', 'unavailable')
      if (problem) throw new ApiError('invalid', problem)
      if (input.kind === 'breakfast' && !breakfastMornings(d.sailing(), d.now(), 8).some((m) => m.slots.some((s) => s.at === input.deliverAt))) throw new ApiError('invalid', 'noTime')
      const now = d.now()
      const o: StoredOrder = {
        kind: input.kind, lines: input.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, extras: [...l.extras], guest: l.guest, ...(l.note ? { note: String(l.note).slice(0, 100) } : {}) })),
        location: input.location.kind === 'other' ? { kind: 'other', text: input.location.text.trim() } : input.location, tip: input.tip, placedAt: now,
        ...(input.kind === 'breakfast' ? { deliverAt: input.deliverAt } : {}),
        runsOut: scenario('orderStock') ? input.lines.map((l, i) => (OUT_WHILE_PREPARING.includes(l.itemId) ? i : -1)).filter((i) => i >= 0) : [],
        choices: {}, free: await partyIsolating(), by: d.who(), contacted: 0,
      }
      const id = d.newId('ord')
      await put('orders', id, o)
      return orderView(id, o, guests)
    }),

    resolve: (id, choices) => d.run('orders.resolve', async () => {
      d.adult()
      const o = await orderOf(id)
      const guests = await guestsInfo()
      const now = d.now()
      const before = await orderView(id, o, guests)
      if (before.stage !== 'needsChoice') throw new ApiError('conflict', 'nothingToChoose')
      const next: Record<number, Choice> = { ...o.choices }
      for (const i of before.unavailable) {
        const c = choices[i]
        if (c !== 'substitute' && c !== 'remove') throw new ApiError('invalid', 'incomplete')
        if (c === 'substitute' && !itemById(o.lines[i].itemId)?.substitute) throw new ApiError('invalid', 'noSubstitute')
        next[i] = c
      }
      const allGone = o.lines.every((_, i) => next[i] === 'remove')
      const updated: StoredOrder = { ...o, choices: next, resolvedAt: now, ...(allGone ? { cancelledAt: now } : {}) }
      await put('orders', id, updated)
      return orderView(id, updated, guests)
    }),

    cancel: (id) => d.run('orders.cancel', async () => {
      d.adult()
      const o = await orderOf(id)
      const guests = await guestsInfo()
      if (!(await orderView(id, o, guests)).canCancel) throw new ApiError('conflict', 'tooLate')
      const updated: StoredOrder = { ...o, cancelledAt: d.now() }
      await put('orders', id, updated)
      return orderView(id, updated, guests)
    }),

    moveTo: (id, location) => d.run('orders.moveTo', async () => {
      d.adult()
      if (locationProblem(location)) throw new ApiError('invalid', 'badLocation')
      const o = await orderOf(id)
      const guests = await guestsInfo()
      if (!(await orderView(id, o, guests)).canMove) throw new ApiError('conflict', 'tooLate')
      const updated: StoredOrder = { ...o, location: location.kind === 'other' ? { kind: 'other', text: location.text.trim() } : location }
      await put('orders', id, updated)
      return orderView(id, updated, guests)
    }),

    contact: (id) => d.run('orders.contact', async () => {
      d.adult()
      const o = await orderOf(id)
      const updated: StoredOrder = { ...o, contacted: o.contacted + 1 }
      await put('orders', id, updated)
      return orderView(id, updated, await guestsInfo())
    }),
  }

  // ---- Family and children's clubs (SAF-05, ENT-04) ----
  const kids = () => party().filter((g) => g.age < 18)
  const adults = () => party().filter((g) => g.age >= 18)
  const adultIds = () => adults().map((g) => g.id)

  const logKid = async (text: string) => put('kidLog', d.newId('kl'), { text, n: (await rows('kidLog')).length })

  const familyView = async (): Promise<FamilyView> => {
    const now = d.now()
    const time = timeIn(now, zone())
    const youngest = kids().reduce<PersonaId | null>((best, g) => (best === null || g.age < personaById(best)!.age ? g.id : best), null)
    const list: FamilyKid[] = []
    for (const g of kids()) {
      const club = clubFor(g.age)
      const stored = await one<{ clubId: string; at: number }>('kidClub', g.id)
      const inClub = stored && clubById(stored.clubId) ? { clubId: clubById(stored.clubId)!.id, at: stored.at } : null
      const zones = (await one<{ zones: string[] }>('kidZones', g.id))?.zones ?? defaultZones(g.age)
      const auth = normalizeAuth((await one('kidAuth', g.id)) ?? undefined, adultIds())
      const seen = lastSeen(g.id, g.age, now, inClub, scenario('childMissing') && g.id === youngest && !inClub)
      const me = d.actor()
      list.push({
        id: g.id, name: g.name, age: g.age,
        club: club ? { id: club.id, name: club.name, open: clubOpen(club, time), opens: club.opens, closes: club.closes } : null,
        inClub, seen, status: kidStatus(seen, zones, now), zones, auth,
        canCheckOut: !!inClub && (auth.pickup.includes(me.id) || (me.id === g.id && auth.signOutAlone && club?.aloneFrom !== null && club !== undefined && g.age >= (club.aloneFrom ?? 99))),
      })
    }
    const log = (await rows<{ text: string; n?: number }>('kidLog')).sort((a, b) => b.at - a.at || (b.data.n ?? 0) - (a.data.n ?? 0)).slice(0, 10).map((r) => ({ id: r.id, at: r.at, text: r.data.text }))
    return {
      kids: list, adults: adults().map((g) => ({ id: g.id, name: g.name })), reunion: normalizeReunion(await one('kidReunion', 'plan')), log, canEdit: !d.actor().child,
    }
  }

  const kidOf = (id: PersonaId) => {
    const g = kids().find((k) => k.id === id)
    if (!g) throw new ApiError('forbidden', 'Not a child on your booking')
    return g
  }

  const family: FamilyApi = {
    view: () => d.run('family.view', familyView),

    setZones: (child, zones) => d.run('family.setZones', async () => {
      d.adult()
      kidOf(child)
      if (!Array.isArray(zones) || zones.length === 0 || !zones.every((z) => KID_ZONES.includes(z))) throw new ApiError('invalid', 'badZones')
      await put('kidZones', child, { zones: [...new Set(zones)] })
      return familyView()
    }),

    setAuth: (child, auth) => d.run('family.setAuth', async () => {
      d.adult()
      const g = kidOf(child)
      const club = clubFor(g.age)
      const pickup = Array.isArray(auth.pickup) ? auth.pickup.filter((p) => adultIds().includes(p)) : []
      if (pickup.length === 0) throw new ApiError('invalid', 'noPickup')
      if (auth.signOutAlone && (!club || club.aloneFrom === null || g.age < club.aloneFrom)) throw new ApiError('invalid', 'tooYoungAlone')
      const clean: Authorisation = { pickup, signOutAlone: auth.signOutAlone === true, photos: auth.photos === true }
      await put('kidAuth', child, clean)
      return familyView()
    }),

    checkIn: (child) => d.run('family.checkIn', async () => {
      const me = d.adult()
      needAboard()
      const g = kidOf(child)
      const club = clubFor(g.age)
      if (!club) throw new ApiError('invalid', 'tooYoung')
      const problem = checkInProblem(club, g.age, timeIn(d.now(), zone()), !!(await one('kidClub', child)))
      if (problem) throw new ApiError('invalid', problem)
      await put('kidClub', child, { clubId: club.id, at: d.now() })
      await logKid(`${g.firstName} checked in to ${club.name} (by ${me.firstName})`)
      return familyView()
    }),

    checkOut: (child) => d.run('family.checkOut', async () => {
      const me = d.actor()
      const g = kidOf(child)
      const view = (await familyView()).kids.find((k) => k.id === child)!
      if (!view.inClub) throw new ApiError('conflict', 'notIn')
      if (!view.canCheckOut) throw new ApiError('forbidden', 'notAuthorised')
      await drop('kidClub', child)
      await logKid(`${g.firstName} checked out of ${clubById(view.inClub.clubId)!.name} (by ${me.firstName})`)
      return familyView()
    }),

    setReunion: (plan) => d.run('family.setReunion', async () => {
      d.adult()
      const ok = (p: unknown) => typeof p === 'string' && MEETING_PLACES.includes(p)
      if (!ok(plan.placeId) || !ok(plan.backupId) || plan.placeId === plan.backupId) throw new ApiError('invalid', 'badMeeting')
      const clean: ReunionPlan = { ...normalizeReunion(plan), note: String(plan.note ?? '').slice(0, 200) }
      await put('kidReunion', 'plan', clean)
      return familyView()
    }),
  }

  // ---- Health (SAF-03) ----
  const healthView = async (): Promise<HealthView> => {
    const s = d.sailing()
    const now = d.now()
    const day: DayType = aboard() && portAt(s, now).port !== 'sea' ? 'port' : 'sea'
    const time = timeIn(now, zone())
    const reports = (await rows<{ guests: string[]; symptoms: Symptom[]; startedHoursAgo: number }>('illness', d.who())).sort((a, b) => b.at - a.at)
    const requests = (await rows<{ kind: RequestKind; note: string }>('medreq', d.who())).sort((a, b) => b.at - a.at)
    return {
      day, open: medicalOpen(day, time), nextOpen: nextOpening(day, time), notice: scenario('illness'), isolating: await partyIsolating(),
      reports: reports.map((r) => ({ id: r.id, at: r.at, guests: r.data.guests, symptoms: r.data.symptoms, startedHoursAgo: r.data.startedHoursAgo })),
      requests: requests.map((r) => ({ id: r.id, at: r.at, kind: r.data.kind, note: r.data.note })),
      guests: party().map((g) => ({ id: g.id, name: g.name })),
    }
  }

  /** Health records are the reporter's own, not the booking's, and never appear in the shared account history (SEC-07). */
  const health: HealthApi = {
    view: () => d.run('health.view', healthView),
    report: (input) => d.run('health.report', async () => {
      d.adult()
      needAboard()
      if (!input.guests.every(inParty)) throw new ApiError('forbidden', 'Not on your booking')
      const problem = reportProblem(input.guests, input.symptoms, input.startedHoursAgo)
      if (problem) throw new ApiError('invalid', problem)
      await put('illness', d.newId('ill'), { guests: [...input.guests], symptoms: input.symptoms.filter(isSymptom), startedHoursAgo: input.startedHoursAgo, gastro: input.symptoms.some((s) => GASTRO.includes(s)) }, d.who())
      return healthView()
    }),
    request: (kind, note) => d.run('health.request', async () => {
      d.adult()
      needAboard()
      if (!isRequestKind(kind)) throw new ApiError('invalid', 'badKind')
      if (typeof note !== 'string' || note.length > 300) throw new ApiError('invalid', 'badNote')
      await put('medreq', d.newId('med'), { kind, note: note.trim() }, d.who())
      return healthView()
    }),
  }

  // ---- Stateroom (ROM-01 to ROM-03, ROM-05) ----
  const roomView = async (): Promise<RoomView> => {
    const p = personaById(booker())!
    const a = assignmentFor(booker(), d.sailing().id, (await d.profileOf(booker())).needs.includes('mobility'))
    const hk = normalizeHousekeeping(await one('room', 'housekeeping'))
    return {
      number: a.number, deck: a.deck, steward: stewardFor(a.number), amenities: [...amenitiesFor(p.stateroom)], muster: a.muster, hasView: hasView(p.stateroom),
      housekeeping: hk, devices: normalizeDevices(await one('room', 'devices')), checkDue: dndCheckDue(hk, d.now()), canEdit: !d.actor().child,
    }
  }

  const room: RoomApi = {
    view: () => d.run('room.view', roomView),
    setHousekeeping: (patch) => d.run('room.setHousekeeping', async () => {
      d.adult()
      needAboard()
      const problem = housekeepingProblem(patch)
      if (problem) throw new ApiError('invalid', problem)
      const current = normalizeHousekeeping(await one('room', 'housekeeping'))
      const mode = patch.mode ?? current.mode
      const next: Housekeeping = {
        mode, window: patch.window ?? current.window, turndown: patch.turndown ?? current.turndown,
        since: mode === 'none' ? null : mode === current.mode ? current.since : d.now(),
      }
      await put('room', 'housekeeping', next)
      return roomView()
    }),
    setDevices: (patch) => d.run('room.setDevices', async () => {
      d.adult()
      needAboard()
      const view = hasView(personaById(booker())!.stateroom)
      const problem = devicesProblem(patch, view)
      if (problem) throw new ApiError('invalid', problem)
      const current = normalizeDevices(await one('room', 'devices'))
      const next: Devices = normalizeDevices({ ...DEFAULT_DEVICES, ...current, ...patch })
      await put('room', 'devices', next)
      return roomView()
    }),
  }

  // ---- Photos (SHP-02, SHP-07) ----
  const throughDay = () => (aboard() ? Math.min(8, Math.max(0, cruiseDay(d.sailing(), d.now()))) : 0)
  const allPhotos = () => photosFor(party().map((g) => g.id), throughDay())
  const receiptRows = async () => (await rows<StoredReceipt>('photoBuy')).sort((a, b) => a.at - b.at)
  const redownloadUntil = () => {
    const days = itinerary(d.sailing())
    return zonedToEpoch(addDays(days[days.length - 1].date, REDOWNLOAD_DAYS), '23:59', 'America/New_York')
  }
  const receiptView = (r: { id: string; data: StoredReceipt }): PhotoReceipt => ({
    id: r.id, at: r.data.at, option: r.data.option, photoIds: r.data.photoIds, paid: r.data.paid, saved: r.data.saved, verified: r.data.saved >= r.data.photoIds.length, until: redownloadUntil(),
  })
  const ownedIds = (receipts: { data: StoredReceipt }[]) => new Set(receipts.flatMap((r) => r.data.photoIds))
  const includedLeft = async (receipts: { data: StoredReceipt }[]): Promise<number> =>
    personaById(booker())!.package === 'premier' ? Math.max(0, INCLUDED_WITH_PREMIER - receipts.reduce((n, r) => n + r.data.included, 0)) : 0

  const choosePhotos = (ids: string[], owned: Set<string>) => {
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError('invalid', 'empty')
    const known = new Set(allPhotos().map((p) => p.id))
    const unique = [...new Set(ids)]
    if (!unique.every((i) => known.has(i))) throw new ApiError('invalid', 'unknownPhoto')
    if (unique.some((i) => owned.has(i))) throw new ApiError('invalid', 'alreadyOwned')
    return unique
  }

  const photos: PhotosApi = {
    list: () => d.run('photos.list', async (): Promise<PhotosView> => {
      const receipts = await receiptRows()
      const favs = (await one<{ ids: string[] }>('photoFav', 'list', d.who()))?.ids
      return {
        photos: allPhotos(), favourites: Array.isArray(favs) ? favs : [], owned: [...ownedIds(receipts)], receipts: receipts.map(receiptView).reverse(), includedLeft: await includedLeft(receipts),
        schedule: PHOTOGRAPHERS.map((p) => ({ ...p })), people: party().map((g) => ({ id: g.id, name: g.name })), throughDay: throughDay(),
      }
    }),

    toggleFavourite: (photoId) => d.run('photos.toggleFavourite', async () => {
      if (!allPhotos().some((p) => p.id === photoId)) throw new ApiError('invalid', 'unknownPhoto')
      const have = (await one<{ ids: string[] }>('photoFav', 'list', d.who()))?.ids ?? []
      const next = have.includes(photoId) ? have.filter((i) => i !== photoId) : [...have, photoId]
      await put('photoFav', 'list', { ids: next }, d.who())
      return next
    }),

    quote: (photoIds) => d.run('photos.quote', async (): Promise<PhotoQuote> => {
      const receipts = await receiptRows()
      const ids = choosePhotos(photoIds, ownedIds(receipts))
      const q = photoOptions(ids.length, await includedLeft(receipts))
      return { ...q, cheapest: cheapest(q.options) }
    }),

    buy: (photoIds, option) => d.run('photos.buy', async () => {
      d.adult()
      needAboard()
      const receipts = await receiptRows()
      const ids = choosePhotos(photoIds, ownedIds(receipts))
      const q = photoOptions(ids.length, await includedLeft(receipts))
      if (q.paid > 0 && !OPTION_IDS.includes(option)) throw new ApiError('invalid', 'badOption')
      const chosen = q.paid === 0 ? null : q.options.find((o) => o.id === option)!
      const all = chosen?.id === 'all'
      const stored: StoredReceipt = {
        option: chosen ? chosen.id : 'included', photoIds: all ? allPhotos().map((p) => p.id).filter((i) => !ownedIds(receipts).has(i)) : ids,
        paid: chosen?.total ?? 0, included: q.included, at: d.now(), saved: 0, by: d.who(),
      }
      const id = d.newId('pho')
      await put('photoBuy', id, stored)
      return receiptView({ id, data: stored })
    }),

    download: (receiptId) => d.run('photos.download', async () => {
      d.adult()
      const stored = await one<StoredReceipt>('photoBuy', receiptId)
      if (!stored) throw new ApiError('notFound')
      if (d.now() > redownloadUntil()) throw new ApiError('conflict', 'expired')
      const next: StoredReceipt = { ...stored, saved: Math.min(stored.photoIds.length, stored.saved + DOWNLOAD_BATCH) }
      await put('photoBuy', receiptId, next)
      return receiptView({ id: receiptId, data: next })
    }),
  }

  // ---- Laundry (SHP-03) ----
  const freeBagUsed = async (): Promise<boolean> => (await rows<StoredLaundry>('laundry')).some((r) => r.data.free > 0 && r.data.cancelledAt === undefined)
  const laundryView = async (): Promise<LaundryView> => {
    const now = d.now()
    const mine = (await rows<StoredLaundry>('laundry')).sort((a, b) => b.data.placedAt - a.data.placedAt || b.data.seq - a.data.seq)
    const perk = (await entitlementsOfBooker()).perks.includes('freeLaundry')
    const requests: LaundryRequest[] = mine.map((r) => {
      const track = laundryStage(r.data, now)
      return { id: r.id, service: r.data.service, qty: r.data.qty, pickupAt: r.data.pickupAt, returnAt: track.returnAt, stage: track.stage, total: r.data.total, free: r.data.free, note: r.data.note }
    })
    const open = aboard()
    return {
      requests, freeBagLeft: perk && !(await freeBagUsed()), canRequest: open && !d.actor().child,
      pickups: Object.fromEntries(SERVICES.map((s) => [s.id, open ? pickupOptions(d.sailing(), now, s) : []])) as LaundryView['pickups'],
    }
  }

  const laundry: LaundryApi = {
    view: () => d.run('laundry.view', laundryView),
    request: (input) => d.run('laundry.request', async () => {
      d.adult()
      needAboard()
      const svc = serviceById(input.service)
      if (!svc) throw new ApiError('invalid', 'badService')
      if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > svc.maxQty) throw new ApiError('invalid', 'badQuantity')
      if (typeof input.note !== 'string' || input.note.length > LAUNDRY_NOTE_MAX) throw new ApiError('invalid', 'badNote')
      if (!pickupOptions(d.sailing(), d.now(), svc, 100).some((p) => p.at === input.pickupAt)) throw new ApiError('invalid', 'badPickup')
      const perk = (await entitlementsOfBooker()).perks.includes('freeLaundry')
      const price = laundryPrice(svc, input.qty, perk && !(await freeBagUsed()))
      const stored: StoredLaundry = { service: svc.id, qty: input.qty, pickupAt: input.pickupAt, hours: svc.hours, total: price.total, free: price.free, note: input.note.trim(), placedAt: d.now(), seq: (await rows('laundry')).length, by: d.who() }
      await put('laundry', d.newId('lau'), stored)
      return laundryView()
    }),
    cancel: (id) => d.run('laundry.cancel', async () => {
      d.adult()
      const r = await one<StoredLaundry>('laundry', id)
      if (!r) throw new ApiError('notFound')
      if (!laundryCancellable(laundryStage(r, d.now()).stage)) throw new ApiError('conflict', 'tooLate')
      await put('laundry', id, { ...r, cancelledAt: d.now() })
      return laundryView()
    }),
  }

  // ---- Wi-Fi (NET-02) ----
  const wifiView = async (): Promise<WifiView> => {
    const now = d.now()
    const stored = (await rows<StoredDevice>('wifi')).sort((a, b) => a.data.addedAt - b.data.addedAt)
    const included = (await entitlementsOfBooker()).wifiDevices
    const devices: WifiDeviceView[] = stored.map((r) => {
      const dev = { ...r.data, id: r.id }
      const cap = planById(dev.plan)?.capMb ?? null
      return { ...dev, usedMb: usedTodayMb(dev, now), capMb: cap, expiresAt: expiresAt(dev), expired: expiresAt(dev) <= now }
    })
    return { devices, includedLeft: Math.max(0, included - stored.filter((r) => r.data.included).length), canBuy: aboard() && !d.actor().child }
  }

  const wifiOf = async (id: string): Promise<StoredDevice> => {
    const dev = await one<StoredDevice>('wifi', id)
    if (!dev) throw new ApiError('notFound')
    return dev
  }

  const wifi: WifiApi = {
    view: () => d.run('wifi.view', wifiView),
    add: (input) => d.run('wifi.add', async () => {
      d.adult()
      needAboard()
      const existing = (await rows<StoredDevice>('wifi')).map((r) => r.data)
      const problem = addProblem(input.name, input.plan, input.days, existing)
      if (problem) throw new ApiError('invalid', problem)
      const plan = planById(input.plan)!
      const free = (await wifiView()).includedLeft > 0 && plan.rank <= planById(INCLUDED_PLAN)!.rank
      const dev: StoredDevice = free
        ? { id: '', name: input.name.trim(), plan: INCLUDED_PLAN, addedAt: d.now(), days: MAX_DAYS, included: true, paid: 0 }
        : { id: '', name: input.name.trim(), plan: plan.id, addedAt: d.now(), days: input.days, included: false, paid: plan.perDay * input.days }
      await put('wifi', d.newId('wifi'), dev)
      return wifiView()
    }),
    upgrade: (id, to) => d.run('wifi.upgrade', async () => {
      d.adult()
      const dev = await wifiOf(id)
      const plan = planById(to)
      if (!plan) throw new ApiError('invalid', 'badPlan')
      const now = d.now()
      if (expiresAt(dev) <= now) throw new ApiError('invalid', 'expired')
      if (plan.rank <= (planById(dev.plan)?.rank ?? 0)) throw new ApiError('invalid', 'notAnUpgrade')
      await put('wifi', id, { ...dev, plan: plan.id, paid: dev.paid + upgradeCost(dev, plan, now) })
      return wifiView()
    }),
    remove: (id) => d.run('wifi.remove', async () => {
      d.adult()
      await wifiOf(id)
      await drop('wifi', id)
      return wifiView()
    }),
  }

  // ---- What these services have put on the bill ----
  const folioLines = async (): Promise<FolioLine[]> => {
    const lines: FolioLine[] = []
    const guests = await guestsInfo()
    for (const r of await rows<StoredOrder>('orders')) {
      const o = r.data
      const priced: Priced = priceOrder(o.lines, { kind: o.kind, location: o.location, tip: o.tip, guests, free: o.free, choices: o.choices })
      lines.push(...orderFolioLines(r.id, priced, o.placedAt, dayAt(o.placedAt), o.cancelledAt, o.by))
    }
    const receipts = await receiptRows()
    for (const r of receipts) {
      const n = r.data.photoIds.length
      lines.push({
        id: `photos-${r.id}`, day: dayAt(r.data.at), at: r.data.at, category: 'photos', guest: r.data.by, cents: r.data.paid,
        description: r.data.option === 'all' ? 'Photos, all digital for the cruise' : `Photos, ${n} digital`,
        ...(r.data.included > 0 ? { value: r.data.included * PRICES.each + r.data.paid, coveredBy: 'package' as const } : {}),
      })
    }
    for (const r of await rows<StoredLaundry>('laundry')) {
      if (r.data.cancelledAt !== undefined) continue
      const svc = serviceById(r.data.service)!
      lines.push({
        id: `laundry-${r.id}`, day: dayAt(r.data.pickupAt), at: r.data.pickupAt, category: 'laundry', guest: r.data.by, cents: r.data.total,
        description: `${r.data.qty} × ${svc.id === 'washFold' ? 'wash and fold' : svc.id === 'press' ? 'pressing' : 'dry cleaning'}`,
        ...(r.data.free > 0 ? { value: r.data.free + r.data.total, coveredBy: 'fare' as const } : {}),
      })
    }
    for (const r of await rows<StoredDevice>('wifi')) {
      const plan = planById(r.data.plan)!
      lines.push({
        id: `wifi-${r.id}`, day: dayAt(r.data.addedAt), at: r.data.addedAt, category: 'internet', guest: d.who(), cents: r.data.paid,
        description: `Wi-Fi ${plan.id}, ${r.data.name}, ${r.data.days} ${r.data.days === 1 ? 'day' : 'days'}`,
        ...(r.data.included ? { value: plan.perDay * r.data.days, coveredBy: 'package' as const } : {}),
      })
    }
    return lines
  }

  return { orders, family, health, room, photos, laundry, wifi, folioLines }
}
