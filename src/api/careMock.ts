import { normalizeBudget, MAX_BUDGET, ALERT_LEVELS, type Budget } from '../domain/budget'
import { disruptionById, validOption } from '../domain/disruption'
import { DIRECTORY, directoryVenue, openAt, reservableVenue, type DayType } from '../domain/menus'
import { partyOf, personaById, type PersonaId } from '../domain/personas'
import { CONSENTS, MAX_ACCESS, RETENTION, consentsFor, deleteOn, kindsToDelete, normalizeConsents, type AccessEntry } from '../domain/privacy'
import { DINNER_DAYS, DINNER_TIMES, slotsFor, venueById } from '../domain/dining'
import { canJoinWaitlist, queueState, startingPosition, waitlistState } from '../domain/queue'
import { activeDisruptions } from '../domain/disruption'
import { eventById, eventsOn } from '../domain/program'
import { itinerary, portAt, shipZoneAt, shipZoneOnDate, stageAt, type Sailing } from '../domain/sailings'
import type { ScenarioId } from '../domain/scenarios'
import { canReturn, isTicketed, seatsLeft, ticketProblem } from '../domain/tickets'
import { timeIn, zonedToEpoch, dateIn } from '../domain/timezones'
import type { DemoState } from '../demo/state'
import type { BookingDeps } from './bookingMock'
import type { BudgetApi, PrivacyApi, ShowsApi, TicketView, UpdatesApi, WaitsApi, WaitsView } from './careTypes'
import { ApiError } from './errors'
import { ABOARD_STAGES } from './onboardMock'
import type { DiningView } from './types'

export interface CareDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'newId' | 'run'> {
  sailing: () => Sailing
  demo: () => DemoState
  reserveFromWaitlist: (input: { venueId: string; day: number; time: string; guests: PersonaId[]; note: string }) => Promise<DiningView>
}

export interface CareApi {
  budget: BudgetApi
  shows: ShowsApi
  waits: WaitsApi
  updates: UpdatesApi
  privacy: PrivacyApi
  /** Notes that a sensitive record was looked at or changed. */
  access: (what: AccessEntry['what'], action: AccessEntry['action']) => Promise<void>
}

export function createCareApi(d: CareDeps): CareApi {
  const booker = () => d.actor().booker
  const party = () => partyOf(d.who())
  const scenario = (id: ScenarioId) => d.demo().scenarios.includes(id)
  const aboard = () => (ABOARD_STAGES as readonly string[]).includes(stageAt(d.sailing(), d.now()))
  const needAboard = () => { if (!aboard()) throw new ApiError('conflict', 'closed') }
  const rows = async <T>(kind: string, owner: string = booker()) => (await d.store.list(kind, owner)).map((r) => ({ id: r.id, at: r.updatedAt, data: r.data as T }))
  const one = async <T>(kind: string, id: string, owner: string = booker()): Promise<T | null> => ((await d.store.get(kind, owner, id))?.data as T | undefined) ?? null
  const put = (kind: string, id: string, data: unknown, owner: string = booker()) => d.save(kind, owner, id, data)
  const drop = async (kind: string, id: string, owner: string = booker()) => { await d.store.delete(kind, owner, id); d.channel?.post({ type: 'records', kind, owner }) }
  const nameOf = (id: string) => personaById(id)?.name ?? id
  const guestsIn = (ids: readonly PersonaId[]): PersonaId[] => {
    const ok = new Set(party().map((p) => p.id))
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((g) => ok.has(g))) throw new ApiError('invalid', 'Choose people on your booking')
    return [...new Set(ids)]
  }

  // ---- Budget (ACC-02) ----
  const budgetView = async () => ({
    budget: normalizeBudget(await one('budget', 'me')),
    kids: party().filter((p) => p.age < 18).map((p) => ({ id: p.id, name: p.name, age: p.age })),
    canEdit: !d.actor().child,
  })
  const budget: BudgetApi = {
    get: () => d.run('budget.get', budgetView),
    save: (b: Budget) => d.run('budget.save', async () => {
      d.adult()
      const total = b.total
      if (total !== null && (!Number.isInteger(total) || total <= 0 || total > MAX_BUDGET)) throw new ApiError('invalid', 'Check the amount')
      if (!ALERT_LEVELS.includes(b.alertAt)) throw new ApiError('invalid', 'Choose when to warn')
      const kidIds = new Set(party().filter((p) => p.age < 18).map((p) => p.id as string))
      for (const [id, limit] of Object.entries(b.kids)) if (!kidIds.has(id) || !Number.isInteger(limit) || limit <= 0 || limit > MAX_BUDGET) throw new ApiError('invalid', 'Check the limit for a child')
      await put('budget', 'me', normalizeBudget(b))
      return budgetView()
    }),
  }

  // ---- Shows (ENT-01) ----
  interface StoredTicket { eventId: string; day: number; guests: PersonaId[] }
  const ticketRows = () => rows<StoredTicket>('ticket')
  const ticketViews = async (): Promise<TicketView[]> => {
    const out: TicketView[] = []
    for (const t of await ticketRows()) {
      const e = eventsOn(d.sailing(), t.data.day, scenario('planChange')).find((x) => x.id === t.data.eventId)
      if (!e) continue
      out.push({ id: t.id, eventId: e.id, title: e.title, day: e.day, startAt: e.startAt, placeId: e.placeId, status: e.status, guests: t.data.guests.map((g) => ({ id: g, name: nameOf(g) })), canReturn: canReturn(e, d.now()) })
    }
    return out.sort((a, b) => a.startAt - b.startAt)
  }
  const shows: ShowsApi = {
    day: (day) => d.run('shows.day', async () => {
      if (!Number.isInteger(day) || day < 1 || day > 8) throw new ApiError('invalid', 'Choose a day')
      const mine = await ticketRows()
      return eventsOn(d.sailing(), day, scenario('planChange')).filter((e) => isTicketed(e.id)).map((e) => ({
        eventId: e.id,
        left: seatsLeft(e.id, day, mine.filter((t) => t.data.eventId === e.id && t.data.day === day).reduce((n, t) => n + t.data.guests.length, 0)),
      }))
    }),
    mine: () => d.run('shows.mine', ticketViews),
    reserve: (eventId, day, guests) => d.run('shows.reserve', async () => {
      d.adult()
      needAboard()
      if (!eventById(eventId) || !Number.isInteger(day)) throw new ApiError('invalid', 'Choose a show')
      const who = guestsIn(guests)
      const event = eventsOn(d.sailing(), day, scenario('planChange')).find((e) => e.id === eventId)
      if (!event) throw new ApiError('invalid', 'Not on that day')
      const mine = (await ticketRows()).filter((t) => t.data.eventId === eventId && t.data.day === day)
      const problem = ticketProblem({
        event, now: d.now(), guests: who.map((id) => ({ id, age: personaById(id)!.age })),
        holders: mine.flatMap((t) => t.data.guests), held: mine.reduce((n, t) => n + t.data.guests.length, 0),
      })
      if (problem) throw new ApiError('conflict', problem)
      if (seatsLeft(eventId, day, mine.reduce((n, t) => n + t.data.guests.length, 0)) < who.length) throw new ApiError('conflict', 'soldOut')
      await put('ticket', d.newId('ticket'), { eventId, day, guests: who } satisfies StoredTicket)
      return ticketViews()
    }),
    cancel: (id) => d.run('shows.cancel', async () => {
      d.adult()
      const t = (await ticketRows()).find((r) => r.id === id)
      if (!t) throw new ApiError('notFound')
      const e = eventsOn(d.sailing(), t.data.day, scenario('planChange')).find((x) => x.id === t.data.eventId)
      if (e && !canReturn(e, d.now())) throw new ApiError('conflict', 'started')
      await drop('ticket', id)
      return ticketViews()
    }),
  }

  // ---- Virtual queue and waitlist (DIN-02) ----
  interface StoredQueue { venueId: string; joinedAt: number; start: number }
  interface StoredWait { venueId: string; day: number; time: string; guests: PersonaId[]; joinedAt: number; taken?: boolean }
  const dayType = (): DayType => (portAt(d.sailing(), d.now()).port === 'sea' ? 'sea' : 'port')
  const slotAt = (day: number, time: string) => { const date = itinerary(d.sailing())[day - 1].date; return zonedToEpoch(date, time, shipZoneOnDate(d.sailing(), date)) }
  const queueable = (id: string) => { const v = directoryVenue(id); return v && !reservableVenue(v) && v.id !== 'soleil' ? v : null }
  const openNow = () => DIRECTORY.filter((v) => !reservableVenue(v) && v.id !== 'soleil' && openAt(v, dayType(), timeIn(d.now(), shipZoneAt(d.sailing(), d.now())))).map((v) => v.id)
  const waitsView = async (): Promise<WaitsView> => {
    const now = d.now()
    const queues = (await rows<StoredQueue>('vqueue'))
      .map((q) => ({ id: q.id, venueId: q.data.venueId, joinedAt: q.data.joinedAt, ...queueState(q.data.joinedAt, q.data.start, now) }))
      .sort((a, b) => a.joinedAt - b.joinedAt)
    const waitlist = (await rows<StoredWait>('waitlist')).filter((w) => !w.data.taken).map((w) => {
      const at = slotAt(w.data.day, w.data.time)
      return { id: w.id, venueId: w.data.venueId, day: w.data.day, time: w.data.time, slotAt: at, guests: w.data.guests.map((g) => ({ id: g, name: nameOf(g) })), ...waitlistState(w.data.joinedAt, at, now, 1 + (w.data.joinedAt % 4)) }
    }).sort((a, b) => a.slotAt - b.slotAt)
    return { open: openNow(), queues, waitlist }
  }
  const waits: WaitsApi = {
    list: () => d.run('waits.list', waitsView),
    joinQueue: (venueId) => d.run('waits.joinQueue', async () => {
      d.adult()
      if (!queueable(venueId)) throw new ApiError('invalid', 'That place has no queue')
      needAboard()
      if (!openNow().includes(venueId)) throw new ApiError('conflict', 'closed')
      const view = await waitsView()
      if (view.queues.some((q) => q.venueId === venueId && q.stage !== 'expired')) throw new ApiError('conflict', 'duplicate')
      for (const q of view.queues.filter((x) => x.venueId === venueId)) await drop('vqueue', q.id)
      const now = d.now()
      await put('vqueue', d.newId('vq'), { venueId, joinedAt: now, start: startingPosition(venueId, now) } satisfies StoredQueue)
      return waitsView()
    }),
    leaveQueue: (id) => d.run('waits.leaveQueue', async () => {
      d.adult()
      if (!(await one('vqueue', id))) throw new ApiError('notFound')
      await drop('vqueue', id)
      return waitsView()
    }),
    joinWaitlist: (input) => d.run('waits.joinWaitlist', async () => {
      d.adult()
      const v = venueById(input.venueId)
      if (!v || v.walkIn || !DINNER_DAYS.includes(input.day) || !DINNER_TIMES.includes(input.time)) throw new ApiError('invalid', 'Choose a restaurant, a night and a time')
      const who = guestsIn(input.guests)
      const grid = slotsFor(v.id, d.sailing().id, input.day).find((s) => s.time === input.time)!
      if (grid.tables > 0) throw new ApiError('conflict', 'notFull')
      if (!canJoinWaitlist(slotAt(input.day, input.time), d.now())) throw new ApiError('conflict', 'tooLate')
      const have = (await rows<StoredWait>('waitlist')).filter((w) => !w.data.taken)
      if (have.some((w) => w.data.venueId === v.id && w.data.day === input.day && w.data.time === input.time)) throw new ApiError('conflict', 'duplicate')
      await put('waitlist', d.newId('wl'), { venueId: v.id, day: input.day, time: input.time, guests: who, joinedAt: d.now() } satisfies StoredWait)
      return waitsView()
    }),
    leaveWaitlist: (id) => d.run('waits.leaveWaitlist', async () => {
      d.adult()
      if (!(await one('waitlist', id))) throw new ApiError('notFound')
      await drop('waitlist', id)
      return waitsView()
    }),
    acceptWaitlist: (id) => d.run('waits.acceptWaitlist', async () => {
      d.adult()
      const w = await one<StoredWait>('waitlist', id)
      if (!w || w.taken) throw new ApiError('notFound')
      const state = waitlistState(w.joinedAt, slotAt(w.day, w.time), d.now(), 1 + (w.joinedAt % 4))
      if (state.stage === 'waiting') throw new ApiError('conflict', 'notOffered')
      if (state.stage === 'expired') throw new ApiError('conflict', 'expired')
      const view = await d.reserveFromWaitlist({ venueId: w.venueId, day: w.day, time: w.time, guests: w.guests, note: 'From the waitlist' })
      await put('waitlist', id, { ...w, taken: true })
      return view
    }),
  }

  // ---- Changes to the trip (SUP-06, SAF-06, MNG-15) ----
  interface StoredAck { option: string; at: number }
  const updatesView = async () => {
    const active = activeDisruptions(d.demo().scenarios)
    const acks = new Map((await rows<StoredAck>('ack', d.who())).map((r) => [r.id, r.data]))
    const list = active.map((def) => ({ id: def.id, severity: def.severity, active: true, ack: acks.get(def.id) ?? null }))
    const ended = [...acks].filter(([id]) => !active.some((a) => a.id === id) && disruptionById(id)).map(([id, ack]) => ({ id: id as ScenarioId, severity: disruptionById(id)!.severity, active: false, ack }))
    return [...list, ...ended]
  }
  const updates: UpdatesApi = {
    list: () => d.run('updates.list', updatesView),
    acknowledge: (id, option) => d.run('updates.acknowledge', async () => {
      d.adult()
      const def = disruptionById(id)
      if (!def || !validOption(def, option)) throw new ApiError('invalid', 'Choose one of the options')
      if (!activeDisruptions(d.demo().scenarios).some((a) => a.id === id)) throw new ApiError('conflict', 'ended')
      await put('ack', id, { option, at: d.now() } satisfies StoredAck, d.who())
      return updatesView()
    }),
  }

  // ---- Privacy centre (SEC-03, SEC-04, ACT-06) ----
  const cruiseEnds = () => itinerary(d.sailing())[7].date
  const access = async (what: AccessEntry['what'], action: AccessEntry['action']) => {
    const log = (await one<{ entries: AccessEntry[] }>('access', 'log', d.who()))?.entries ?? []
    await put('access', 'log', { entries: [...log, { at: d.now(), what, action, by: d.actor().firstName }].slice(-MAX_ACCESS) }, d.who())
  }
  /** Deletes what has passed its retention date, once, and notes it. */
  const purgeDue = async () => {
    const today = dateIn(d.now(), 'America/New_York')
    const kinds = kindsToDelete(cruiseEnds(), today)
    if (kinds.length === 0) return
    const marker = await one<{ done: string[] }>('purged', 'log')
    const fresh = kinds.filter((k) => !marker?.done.includes(k))
    if (fresh.length === 0) return
    for (const p of party()) for (const k of fresh) for (const r of await d.store.list(k, p.id)) await drop(k, r.id, p.id)
    for (const k of fresh) for (const r of await d.store.list(k, booker())) await drop(k, r.id, booker())
    await put('purged', 'log', { done: [...(marker?.done ?? []), ...fresh], steps: [...((marker as { steps?: unknown[] } | null)?.steps ?? []), { kinds: fresh, at: d.now() }] })
    await access('documents', 'deleted')
  }
  const privacyView = async () => {
    await purgeDue()
    const marker = await one<{ steps?: { kinds: string[]; at: number }[] }>('purged', 'log')
    const people = await Promise.all(party().map(async (p) => ({
      id: p.id, name: p.name, age: p.age,
      consents: normalizeConsents(await one('consent', p.id, p.id)),
      canEdit: p.id === d.who() ? !p.child : !d.actor().child && p.booker === d.actor().id,
    })))
    return {
      cruiseEnds: cruiseEnds(),
      deleteOn: Object.fromEntries(RETENTION.map((r) => [r.id, deleteOn(r, cruiseEnds())])),
      deleted: marker?.steps ?? [],
      people,
      access: (await one<{ entries: AccessEntry[] }>('access', 'log', d.who()))?.entries ?? [],
    }
  }
  const privacy: PrivacyApi = {
    view: () => d.run('privacy.view', privacyView),
    setConsent: (person, consent, on) => d.run('privacy.setConsent', async () => {
      const target = party().find((p) => p.id === person)
      if (!target) throw new ApiError('invalid', 'Not on your booking')
      const mayEdit = target.id === d.actor().id ? !d.actor().child : !d.actor().child && target.booker === d.actor().id
      if (!mayEdit) throw new ApiError('forbidden', 'A parent decides for a child')
      if (!CONSENTS.some((c) => c.id === consent) || !consentsFor(target.age).some((c) => c.id === consent)) throw new ApiError('invalid', 'That choice does not apply')
      const current = normalizeConsents(await one('consent', target.id, target.id))
      await put('consent', target.id, { ...current, [consent]: on === true }, target.id)
      return privacyView()
    }),
  }
  return { budget, shows, waits, updates, privacy, access }
}
