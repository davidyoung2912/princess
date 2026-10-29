import { portDayAt } from '../domain/allaboard'
import { chargeFor, itemById, placesLeft, selectionKey, selectionProblem, takenByOthers, type Selection } from '../domain/catalogue'
import type { FolioLine } from '../domain/folio'
import { VOD_CHANNEL, channelByNumber, titleAllowed, titleById } from '../domain/tv'
import { normalizeGame, TRIVIA, HUNT, type GameState } from '../domain/games'
import { guestPrice, minAge, spotsLeft, excursionById, EXCURSIONS, type ExcursionItem } from '../domain/excursions'
import { partyOf, personaById, visibleTo, type PersonaId } from '../domain/personas'
import { itinerary, shipZoneAt, stageAt, type Sailing } from '../domain/sailings'
import { categoryById } from '../domain/ship'
import { categoryOfStateroom } from '../domain/trip'
import { dateIn, zonedToEpoch } from '../domain/timezones'
import {
  CASH_DESK_MIN, GRATUITY_REASON_MIN, LAST_MINUTE_LEAD_MIN, MAX_OPEN_REQUESTS, MAX_REPORT_TEXT, REPORT_REASONS, childSafeProblem, currencyByCode, drinkById, drinkSummary, friendProblem, gratuityDue, partyProblem, photoProblem,
  pinDigest, pinProblem, reportProblem, requestItem, requestStage, rsvp, topUpProblem, type ChatReportReason, type Friend, type GratuityChoice, type PartyInput, type ReportKind, URGENT_REPORTS,
} from '../domain/services'
import type { DemoState } from '../demo/state'
import type { BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import { ABOARD_STAGES, cruiseDay } from './onboardMock'
import type { PlanReads } from './planMock'
import type {
  AboardApi, DrinksView, FeedbackKind, GratuityView, GroupTable, LastMinuteTour, LastMinuteView, MoneyView, PartyRow, ReportRow, RequestRow, SelectionView, TopUp, TvState,
} from './aboardTypes'

export interface AboardDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'newId' | 'run' | 'cardsOf'> {
  sailing: () => Sailing
  demo: () => DemoState
  reads: PlanReads
}

export interface AboardMock {
  api: AboardApi
  /** What these services have put on the account, for the folio. */
  folioLines: () => Promise<FolioLine[]>
  /** Persona ids the signed-in person has blocked in chat. */
  blocked: () => Promise<PersonaId[]>
}

interface StoredSelection extends Selection { by: PersonaId }
interface StoredRequest { item: string; qty: number; note: string; cancelledAt?: number }
interface StoredTopUp { dollars: number; source: 'card' | 'cash'; reference: string }
interface StoredGratuity { choice: GratuityChoice; reason: string; at: number; paid: number }
interface StoredTour { excursionId: string; guests: PersonaId[]; total: number; credit: number; cash: number; kept: number; refunded: number; methods: string[]; status: 'booked' | 'cancelled'; onboard?: boolean }

const MIN = 60_000
const DEFAULT_TV: TvState = { on: false, channel: 1, volume: 20, muted: false, casting: null, vod: null }

export function createAboardApi(d: AboardDeps): AboardMock {
  const booker = () => d.actor().booker
  const party = () => partyOf(d.who())
  const aboard = () => (ABOARD_STAGES as readonly string[]).includes(stageAt(d.sailing(), d.now()))
  const needAboard = () => { if (!aboard()) throw new ApiError('conflict', 'closed') }
  /** Before sailing or aboard, but not after the cruise: the things you can book or buy ahead (PRE-04, PRE-05, PRE-07, PRE-10). */
  const beforeOrAboard = () => aboard() || ['booked', 'preCruise', 'checkIn'].includes(stageAt(d.sailing(), d.now()))
  const needOpen = () => { if (!beforeOrAboard()) throw new ApiError('conflict', 'closed') }
  const dayNow = () => Math.min(8, Math.max(1, cruiseDay(d.sailing(), d.now())))
  const dayAt = (at: number) => Math.min(8, Math.max(1, cruiseDay(d.sailing(), at)))
  const rows = async <T>(kind: string, owner: string = booker()) => (await d.store.list(kind, owner)).map((r) => ({ id: r.id, at: r.updatedAt, data: r.data as T }))
  const one = async <T>(kind: string, id: string, owner: string = booker()): Promise<T | null> => ((await d.store.get(kind, owner, id))?.data as T | undefined) ?? null
  const put = (kind: string, id: string, data: unknown, owner: string = booker()) => d.save(kind, owner, id, data)
  const drop = async (kind: string, id: string, owner: string = booker()) => { await d.store.delete(kind, owner, id); d.channel?.post({ type: 'records', kind, owner }) }
  const me = () => d.who()

  // ---- Bookings and orders on board (ENT-03, SHP-01, SHP-04, SHP-06, ACS-04) ----
  const selectionRows = () => rows<StoredSelection>('pick')
  const selectionViews = async (): Promise<SelectionView[]> =>
    (await selectionRows()).map((r) => ({ id: r.id, item: r.data.item, day: r.data.day, time: r.data.time, qty: r.data.qty, at: r.at, total: chargeFor(r.data) })).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.at - b.at)
  const startedAt = (s: Selection): boolean => {
    if (s.day === 0) return false
    const date = itinerary(d.sailing())[s.day - 1].date
    const zone = shipZoneAt(d.sailing(), zonedToEpoch(date, '12:00', 'America/New_York'))
    const start = zonedToEpoch(date, s.time || '23:59', zone)
    return d.now() >= start
  }
  const selections: AboardApi['selections'] = {
    list: () => d.run('aboard.selections.list', selectionViews),
    add: (s) => d.run('aboard.selections.add', async () => {
      d.adult()
      needOpen()
      const problem = selectionProblem(s, d.actor().age, itemById(s?.item) ? takenByOthers(itemById(s.item)!, s.day, s.time) : 0)
      if (problem === 'soldOut') throw new ApiError('conflict', 'soldOut')
      if (problem) throw new ApiError('invalid', problem)
      const item = itemById(s.item)!
      if (item.mode !== 'order' && startedAt(s)) throw new ApiError('conflict', 'past')
      const id = selectionKey(s)
      const existing = (await selectionRows()).find((r) => r.id === id)
      if (existing && item.mode !== 'order') throw new ApiError('conflict', 'duplicate')
      const left = placesLeft(item, s.day, s.time, 0)
      if (left !== null && s.qty > left) throw new ApiError('conflict', 'soldOut')
      await put('pick', id, { item: s.item, day: s.day, time: s.time, qty: s.qty, by: me() } satisfies StoredSelection)
      return selectionViews()
    }),
    remove: (id) => d.run('aboard.selections.remove', async () => {
      d.adult()
      if (!(await one('pick', id))) throw new ApiError('notFound')
      await drop('pick', id)
      return selectionViews()
    }),
  }

  // ---- One-tap requests (MSG-03) ----
  const requestView = (r: { id: string; at: number; data: StoredRequest }): RequestRow => {
    const item = requestItem(r.data.item)!
    const stage = requestStage(r.at, item.etaMin, d.now(), r.data.cancelledAt)
    return { id: r.id, item: r.data.item, qty: r.data.qty, note: r.data.note, placedAt: r.at, etaAt: r.at + item.etaMin * MIN, stage, canCancel: stage === 'received' }
  }
  const requestViews = async (): Promise<RequestRow[]> => (await rows<StoredRequest>('sreq')).map(requestView).sort((a, b) => b.placedAt - a.placedAt)
  const requests: AboardApi['requests'] = {
    list: () => d.run('aboard.requests.list', requestViews),
    create: (itemId, qty, note) => d.run('aboard.requests.create', async () => {
      d.adult()
      const item = requestItem(itemId)
      if (!item || !Number.isInteger(qty) || qty < 1 || qty > item.maxQty) throw new ApiError('invalid', 'Choose an item and how many')
      needAboard()
      const open = (await requestViews()).filter((r) => r.stage === 'received' || r.stage === 'onTheWay')
      if (open.some((r) => r.item === itemId)) throw new ApiError('conflict', 'duplicate')
      if (open.length >= MAX_OPEN_REQUESTS) throw new ApiError('conflict', 'tooMany')
      await put('sreq', d.newId('sreq'), { item: itemId, qty, note: String(note ?? '').trim().slice(0, 200) } satisfies StoredRequest)
      return requestViews()
    }),
    cancel: (id) => d.run('aboard.requests.cancel', async () => {
      d.adult()
      const r = (await rows<StoredRequest>('sreq')).find((x) => x.id === id)
      if (!r) throw new ApiError('notFound')
      if (!requestView(r).canCancel) throw new ApiError('conflict', 'tooLate')
      await put('sreq', id, { ...r.data, cancelledAt: d.now() })
      return requestViews()
    }),
  }

  // ---- Reports (SAF-04) ----
  const reportViews = async (): Promise<ReportRow[]> =>
    (await rows<Omit<ReportRow, 'id' | 'at'>>('secreport')).map((r) => ({ ...r.data, id: r.id, at: r.at }))
    .sort((a, b) => b.at - a.at || b.reference.localeCompare(a.reference))
  const reports: AboardApi['reports'] = {
    list: () => d.run('aboard.reports.list', reportViews),
    create: (input) => d.run('aboard.reports.create', async () => {
      const problem = reportProblem(input?.kind, input?.where, input?.note)
      if (problem) throw new ApiError('invalid', problem)
      needAboard()
      const kind = input.kind as ReportKind
      const count = (await rows('secreport')).length
      await put('secreport', d.newId('rep'), { kind, where: input.where.trim(), note: input.note.trim().slice(0, MAX_REPORT_TEXT), anonymous: !!input.anonymous && !URGENT_REPORTS.includes(kind), reference: `SEC-${String(count + 1).padStart(3, '0')}` })
      return reportViews()
    }),
  }

  // ---- Drinks tracker (DIN-06) ----
  const drinksView = async (): Promise<DrinksView> => {
    const day = dayNow()
    const logs = (await rows<{ drinkId: string; day: number }>('drink', me())).filter((r) => r.data.day === day)
    const { entitlements } = await d.reads.entitlementsOf(me())
    const rowsOut = logs.map((r) => ({ id: r.id, drinkId: r.data.drinkId, at: r.at })).sort((a, b) => a.at - b.at)
    return { capUsd: entitlements.drinkCapUsd, logs: rowsOut, summary: drinkSummary(rowsOut.map((l) => ({ id: l.id, drinkId: l.drinkId, at: l.at })), entitlements.drinkCapUsd, d.now()), adult: d.actor().age >= 21 }
  }
  const drinks: AboardApi['drinks'] = {
    view: () => d.run('aboard.drinks.view', drinksView),
    log: (drinkId) => d.run('aboard.drinks.log', async () => {
      const drink = drinkById(drinkId)
      if (!drink) throw new ApiError('invalid', 'Choose a drink')
      if (drink.alcohol && d.actor().age < 21) throw new ApiError('forbidden', 'age')
      needAboard()
      await put('drink', d.newId('drk'), { drinkId, day: dayNow() }, me())
      return drinksView()
    }),
    undo: (id) => d.run('aboard.drinks.undo', async () => {
      if (!(await one('drink', id, me()))) throw new ApiError('notFound')
      await drop('drink', id, me())
      return drinksView()
    }),
  }

  // ---- Money (ACC-03, ACC-05, ACC-07) ----
  const topUpRows = async (): Promise<TopUp[]> =>
    (await rows<StoredTopUp>('topup')).map((r) => ({ id: r.id, dollars: r.data.dollars, source: r.data.source, at: r.at, reference: r.data.reference, settledAt: r.data.source === 'card' ? r.at : d.now() >= r.at + CASH_DESK_MIN * MIN ? r.at + CASH_DESK_MIN * MIN : null })).sort((a, b) => b.at - a.at)
  const gratuityGuests = () => Promise.all(party().map(async (p) => ({ suite: categoryById(categoryOfStateroom(p.stateroom))?.suite ?? false, included: (await d.reads.entitlementsOf(p.id)).entitlements.gratuitiesIncluded })))
  const moneyView = async (): Promise<MoneyView> => {
    const tops = await topUpRows()
    const stored = await one<StoredGratuity>('gratuity', 'choice')
    const due = gratuityDue(await gratuityGuests())
    const gratuity: GratuityView = {
      due, choice: stored?.choice ?? 'standard', reason: stored?.reason ?? '', canChange: due > 0 && !stored && beforeOrAboard() && (!aboard() || dayNow() < 7), paidAt: stored?.choice === 'prepaid' ? stored.at : null,
    }
    const prefs = await one<{ currency: string }>('moneyPrefs', 'me', me())
    return {
      currency: currencyByCode(prefs?.currency) ? prefs!.currency : 'USD', topUps: tops, topUpTotal: tops.reduce((n, t) => n + t.dollars, 0),
      hasCard: (await d.cardsOf()).length > 0, pinSet: !!(await one('pin', 'pin', me())), gratuity, canEdit: !d.actor().child,
    }
  }
  const money: AboardApi['money'] = {
    view: () => d.run('aboard.money.view', moneyView),
    topUp: (dollars, source) => d.run('aboard.money.topUp', async () => {
      d.adult()
      if (source !== 'card' && source !== 'cash') throw new ApiError('invalid', 'badSource')
      const problem = topUpProblem(dollars, (await topUpRows()).reduce((n, t) => n + t.dollars, 0))
      if (problem === 'tooMuch') throw new ApiError('conflict', 'tooMuch')
      if (problem) throw new ApiError('invalid', problem)
      needOpen()
      if (source === 'card' && (await d.cardsOf()).length === 0) throw new ApiError('conflict', 'noCard')
      const count = (await rows('topup')).length
      await put('topup', d.newId('top'), { dollars, source, reference: `TOP-${String(count + 1).padStart(3, '0')}` } satisfies StoredTopUp)
      return moneyView()
    }),
    setPin: (next, current) => d.run('aboard.money.setPin', async () => {
      d.adult()
      const problem = pinProblem(next)
      if (problem) throw new ApiError('invalid', problem)
      const stored = await one<{ digest: string; salt: string }>('pin', 'pin', me())
      if (stored && pinDigest(String(current ?? ''), stored.salt) !== stored.digest) throw new ApiError('forbidden', 'wrongPin')
      const salt = d.newId('salt')
      await put('pin', 'pin', { digest: pinDigest(next, salt), salt }, me())
      await drop('pinDesk', 'pinDesk', me())
      return moneyView()
    }),
    forgotPin: () => d.run('aboard.money.forgotPin', async () => {
      d.adult()
      await put('pinDesk', 'pinDesk', { at: d.now() }, me())
      return moneyView()
    }),
    gratuity: (choice, reason = '') => d.run('aboard.money.gratuity', async () => {
      d.adult()
      if (choice !== 'prepaid' && choice !== 'removal') throw new ApiError('invalid', 'badChoice')
      needOpen()
      const view = (await moneyView()).gratuity
      if (view.due <= 0) throw new ApiError('conflict', 'nothingDue')
      if (!view.canChange) throw new ApiError('conflict', 'already')
      if (choice === 'removal' && reason.trim().length < GRATUITY_REASON_MIN) throw new ApiError('invalid', 'noReason')
      if (choice === 'prepaid' && (await d.cardsOf()).length === 0) throw new ApiError('conflict', 'noCard')
      await put('gratuity', 'choice', { choice, reason: reason.trim().slice(0, 300), at: d.now(), paid: choice === 'prepaid' ? view.due : 0 } satisfies StoredGratuity)
      return moneyView()
    }),
    setCurrency: (code) => d.run('aboard.money.setCurrency', async () => {
      if (!currencyByCode(code)) throw new ApiError('invalid', 'badCurrency')
      await put('moneyPrefs', 'me', { currency: code }, me())
      return moneyView()
    }),
  }

  // ---- Cabin parties (ROM-06) ----
  const partyRows = async (): Promise<PartyRow[]> =>
    (await rows<{ title: string; day: number; time: string; cabins: string[] }>('cabinParty')).map((r) => ({ id: r.id, title: r.data.title, day: r.data.day, time: r.data.time, invited: r.data.cabins.map((cabin) => ({ cabin, answer: rsvp(cabin, r.data.title) })) })).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  const parties: AboardApi['parties'] = {
    list: () => d.run('aboard.parties.list', partyRows),
    create: (input: PartyInput) => d.run('aboard.parties.create', async () => {
      d.adult()
      if (d.actor().age < 21) throw new ApiError('forbidden', 'age')
      const problem = partyProblem({ title: String(input?.title ?? ''), day: input?.day, time: String(input?.time ?? ''), cabins: Array.isArray(input?.cabins) ? input.cabins : [] })
      if (problem) throw new ApiError('invalid', problem)
      needAboard()
      if (input.day < dayNow()) throw new ApiError('conflict', 'past')
      await put('cabinParty', d.newId('party'), { title: input.title.trim(), day: input.day, time: input.time, cabins: [...input.cabins] })
      return partyRows()
    }),
    cancel: (id) => d.run('aboard.parties.cancel', async () => {
      d.adult()
      if (!(await one('cabinParty', id))) throw new ApiError('notFound')
      await drop('cabinParty', id)
      return partyRows()
    }),
  }

  // ---- Group dining (DIN-09) ----
  const tableOf = async (id: string): Promise<GroupTable> => {
    const raw = await one<{ friends?: Friend[]; split?: string }>('groupTable', id)
    return { friends: Array.isArray(raw?.friends) ? raw!.friends : [], split: raw?.split === 'even' ? 'even' : 'mine' }
  }
  const groups: AboardApi['groups'] = {
    get: (id) => d.run('aboard.groups.get', () => tableOf(String(id))),
    addFriend: (id, friend, partySize) => d.run('aboard.groups.addFriend', async () => {
      d.adult()
      const t = await tableOf(id)
      const problem = friendProblem({ name: String(friend?.name ?? ''), cabin: String(friend?.cabin ?? '') }, t.friends, partySize)
      if (problem === 'full') throw new ApiError('conflict', 'full')
      if (problem) throw new ApiError('invalid', problem)
      const next = { ...t, friends: [...t.friends, { name: friend.name.trim(), cabin: friend.cabin }] }
      await put('groupTable', id, next)
      return next
    }),
    removeFriend: (id, index) => d.run('aboard.groups.removeFriend', async () => {
      d.adult()
      const t = await tableOf(id)
      if (!Number.isInteger(index) || index < 0 || index >= t.friends.length) throw new ApiError('notFound')
      const next = { ...t, friends: t.friends.filter((_, i) => i !== index) }
      await put('groupTable', id, next)
      return next
    }),
    setSplit: (id, split) => d.run('aboard.groups.setSplit', async () => {
      d.adult()
      if (split !== 'mine' && split !== 'even') throw new ApiError('invalid', 'badSplit')
      const next = { ...(await tableOf(id)), split }
      await put('groupTable', id, next)
      return next
    }),
  }

  // ---- Games (ENT-05) ----
  const gameOf = async (): Promise<GameState> => normalizeGame(await one('game', 'state', me()))
  const saveGame = async (g: GameState) => { await put('game', 'state', g, me()); return g }
  const games: AboardApi['games'] = {
    get: () => d.run('aboard.games.get', gameOf),
    find: (clueId, on) => d.run('aboard.games.find', async () => {
      if (!HUNT.some((c) => c.id === clueId)) throw new ApiError('invalid', 'badClue')
      const g = await gameOf()
      return saveGame({ ...g, found: on ? [...new Set([...g.found, clueId])] : g.found.filter((x) => x !== clueId) })
    }),
    answer: (questionId, option) => d.run('aboard.games.answer', async () => {
      const q = TRIVIA.find((x) => x.id === questionId)
      if (!q || !Number.isInteger(option) || option < 0 || option >= q.options.length) throw new ApiError('invalid', 'badAnswer')
      const g = await gameOf()
      if (questionId in g.answers) throw new ApiError('conflict', 'answered')
      return saveGame({ ...g, answers: { ...g.answers, [questionId]: option } })
    }),
    mark: (n, on) => d.run('aboard.games.mark', async () => {
      if (!Number.isInteger(n) || n < 1 || n > 75) throw new ApiError('invalid', 'badNumber')
      const g = await gameOf()
      return saveGame({ ...g, marked: on ? [...new Set([...g.marked, n])] : g.marked.filter((x) => x !== n) })
    }),
  }

  // ---- In-room TV (ENT-06) ----
  const tvOf = async (): Promise<TvState> => {
    const raw = (await one<Partial<TvState>>('tv', 'tv')) ?? {}
    return {
      on: raw.on === true, channel: Number.isInteger(raw.channel) && channelByNumber(raw.channel!) ? raw.channel! : 1,
      volume: Number.isInteger(raw.volume) && raw.volume! >= 0 && raw.volume! <= 100 ? raw.volume! : DEFAULT_TV.volume, muted: raw.muted === true, casting: typeof raw.casting === 'string' ? raw.casting : null, vod: titleById(raw.vod) ? raw.vod! : null,
    }
  }
  const tv: AboardApi['tv'] = {
    get: () => d.run('aboard.tv.get', tvOf),
    set: (input) => d.run('aboard.tv.set', async () => {
      let patch = input
      d.adult()
      const now = await tvOf()
      if (patch.channel !== undefined && !channelByNumber(patch.channel)) throw new ApiError('invalid', 'badChannel')
      if (patch.volume !== undefined && (!Number.isInteger(patch.volume) || patch.volume < 0 || patch.volume > 100)) throw new ApiError('invalid', 'badVolume')
      if (patch.casting !== undefined && patch.casting !== null && !/^[A-Za-z0-9 ._'-]{1,40}$/.test(patch.casting)) throw new ApiError('invalid', 'badDevice')
      if (patch.vod !== undefined && patch.vod !== null) {
        const title = titleById(patch.vod)
        if (!title) throw new ApiError('invalid', 'badTitle')
        if (!titleAllowed(title.rating, d.actor().age)) throw new ApiError('forbidden', 'age')
        patch = { ...patch, channel: VOD_CHANNEL, on: true }
      }
      const next: TvState = { ...now, ...patch, on: patch.on ?? now.on }
      await put('tv', 'tv', next)
      return next
    }),
  }

  // ---- Last-minute excursions (POR-05) ----
  const takenOn = async () => {
    const taken = new Map<string, number>()
    for (const t of await d.reads.tours()) taken.set(t.excursionId, (taken.get(t.excursionId) ?? 0) + t.guests.length)
    return taken
  }
  const lastMinuteView = async (): Promise<LastMinuteView> => {
    const guests = party().map((p) => ({ id: p.id, name: p.name, age: p.age }))
    const s = d.sailing()
    const day = aboard() ? portDayAt(s, d.now()) : null
    if (!day || dateIn(d.now(), day.portZone) !== day.date) return { port: null, tours: [], guests }
    const taken = await takenOn()
    const mine = new Set((await d.reads.tours()).filter((t) => t.guests.some((g) => guests.some((m) => m.id === g))).map((t) => t.excursionId))
    const tours = EXCURSIONS.filter((x) => x.port === day.port).map((x): LastMinuteTour => {
      const leaves = zonedToEpoch(day.date, x.start, day.portZone)
      const left = spotsLeft(x, s.id, taken.get(x.id) ?? 0)
      const closed = mine.has(x.id) ? 'booked' : left <= 0 ? 'soldOut' : d.now() >= leaves ? 'started' : leaves - d.now() < LAST_MINUTE_LEAD_MIN * MIN ? 'tooLate' : null
      return { excursionId: x.id, start: x.start, leaves, left, price: x.price, closed }
    })
    return { port: day.port, tours, guests }
  }
  const lastMinute: AboardApi['lastMinute'] = {
    list: () => d.run('aboard.lastMinute.list', lastMinuteView),
    book: (excursionId, guestIds) => d.run('aboard.lastMinute.book', async () => {
      d.adult()
      needAboard()
      const x: ExcursionItem | undefined = excursionById(excursionId)
      const ok = new Set(party().map((p) => p.id))
      if (!x || !Array.isArray(guestIds) || guestIds.length === 0 || !guestIds.every((g) => ok.has(g))) throw new ApiError('invalid', 'Choose a tour and people on your booking')
      const guests = [...new Set(guestIds)]
      const view = await lastMinuteView()
      const row = view.tours.find((t) => t.excursionId === x.id)
      if (!row) throw new ApiError('conflict', 'closed')
      if (row.closed === 'booked') throw new ApiError('conflict', 'duplicate')
      if (row.closed) throw new ApiError('conflict', row.closed)
      if (guests.some((g) => personaById(g)!.age < minAge(x)) || !guests.some((g) => personaById(g)!.age >= 18)) throw new ApiError('conflict', 'age')
      if (row.left < guests.length) throw new ApiError('conflict', 'soldOut')
      const total = guests.reduce((n, g) => n + guestPrice(x, personaById(g)!.age), 0)
      await put('tour', d.newId('tour'), { excursionId: x.id, guests, total, credit: 0, cash: total, kept: 0, refunded: 0, methods: ['Onboard account'], status: 'booked', onboard: true } satisfies StoredTour)
      return lastMinuteView()
    }),
  }

  // ---- Port-day readiness (POR-13) ----
  const readyKey = () => `ready-${dayNow()}`
  const ready: AboardApi['ready'] = {
    get: () => d.run('aboard.ready.get', async () => (await one<{ ids: string[] }>('portReady', readyKey(), me()))?.ids ?? []),
    set: (id, on) => d.run('aboard.ready.set', async () => {
      const ids = (await one<{ ids: string[] }>('portReady', readyKey(), me()))?.ids ?? []
      const next = on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)
      await put('portReady', readyKey(), { ids: next }, me())
      return next
    }),
  }

  // ---- Chat safeguards (MSG-01, MSG-05) ----
  const blockedIds = async (): Promise<PersonaId[]> => ((await one<{ ids: PersonaId[] }>('chatBlock', 'ids', me()))?.ids ?? []).filter((id) => !!personaById(id))
  const chat: AboardApi['chat'] = {
    blocked: () => d.run('aboard.chat.blocked', blockedIds),
    block: (id, on) => d.run('aboard.chat.block', async () => {
      if (!visibleTo(me()).some((p) => p.id === id)) throw new ApiError('invalid', 'Choose someone in your chat')
      const ids = await blockedIds()
      const next = on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)
      await put('chatBlock', 'ids', { ids: next }, me())
      return next
    }),
    report: (messageId, reason: ChatReportReason) => d.run('aboard.chat.report', async () => {
      if (!REPORT_REASONS.includes(reason)) throw new ApiError('invalid', 'badReason')
      await put('chatReport', d.newId('crep'), { messageId: String(messageId), reason }, me())
    }),
    sendPhoto: (input) => d.run('aboard.chat.sendPhoto', async () => {
      const problem = photoProblem(String(input?.type), Number(input?.bytes), d.actor().age)
      if (problem === 'age') throw new ApiError('forbidden', 'age')
      if (problem) throw new ApiError('invalid', problem)
      if (typeof input.dataUrl !== 'string' || !input.dataUrl.startsWith(`data:${input.type};base64,`) || input.dataUrl.length > 1_400_000) throw new ApiError('invalid', 'size')
      const caption = String(input.caption ?? '').trim().slice(0, 200)
      const bad = childSafeProblem(caption, d.actor().age)
      if (bad) throw new ApiError('invalid', bad)
      await put('message', d.newId('msg'), { text: caption, photo: input.dataUrl }, me())
    }),
  }

  // ---- Feedback and bug reports (SUP-05) ----
  const feedbackRows = async () => (await rows<{ kind: FeedbackKind; text: string; log: string[]; hasShot: boolean }>('feedback', me())).map((r) => ({ id: r.id, kind: r.data.kind, text: r.data.text, at: r.at, log: r.data.log, reference: `FB-${r.id.slice(-4).toUpperCase()}`, screenshot: r.data.hasShot })).sort((a, b) => b.at - a.at)
  const feedback: AboardApi['feedback'] = {
    list: () => d.run('aboard.feedback.list', feedbackRows),
    send: (input) => d.run('aboard.feedback.send', async () => {
      const text = String(input?.text ?? '').trim()
      if (!['bug', 'idea', 'praise'].includes(input?.kind) || text.length < 5 || text.length > 1000) throw new ApiError('invalid', 'Tell us a little more')
      const shot = typeof input.screenshot === 'string' && input.screenshot.startsWith('data:image/') && input.screenshot.length <= 1_400_000
      await put('feedback', d.newId('fb'), { kind: input.kind, text, log: (Array.isArray(input.log) ? input.log : []).slice(-20).map((l) => String(l).slice(0, 160)), hasShot: shot }, me())
      return feedbackRows()
    }),
  }

  // ---- What these have put on the account ----
  const folioLines = async (): Promise<FolioLine[]> => {
    const lines: FolioLine[] = []
    for (const r of await selectionRows()) {
      const item = itemById(r.data.item)
      const cents = chargeFor(r.data)
      if (!item || cents <= 0) continue
      lines.push({ id: `pick-${r.id}`, day: dayAt(r.at), at: r.at, category: item.group === 'spa' || item.group === 'fitness' ? 'spa' : 'shops', description: r.data.qty > 1 ? `${r.data.qty} × ${item.title}` : item.title, guest: r.data.by, cents })
    }
    for (const r of await rows<StoredTour>('tour')) {
      if (!r.data.onboard || r.data.status !== 'booked') continue
      const x = excursionById(r.data.excursionId)
      if (x) lines.push({ id: `tour-${r.id}`, day: dayAt(r.at), at: r.at, category: 'excursions', description: `${x.name} (booked on board)`, guest: r.data.guests[0], cents: r.data.total })
    }
    for (const t of await topUpRows()) {
      if (t.settledAt === null) continue
      lines.push({ id: `top-${t.id}`, day: dayAt(t.settledAt), at: t.settledAt, category: 'credit', description: t.source === 'cash' ? 'Cash deposit' : 'Top-up by card', guest: booker(), cents: -t.dollars * 100 })
    }
    const g = await one<StoredGratuity>('gratuity', 'choice')
    if (g?.choice === 'prepaid' && g.paid > 0) lines.push({ id: 'gratuity-prepaid', day: dayAt(g.at), at: g.at, category: 'credit', description: 'Gratuities prepaid by card', guest: booker(), cents: -g.paid })
    return lines
  }

  return { api: { selections, requests, reports, drinks, money, parties, groups, games, tv, lastMinute, ready, chat, feedback }, folioLines, blocked: blockedIds }
}
