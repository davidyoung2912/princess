import { aboardState, mayTenderInstead, portDayAt, tenderGroupFor, tenderView } from '../domain/allaboard'
import { chatState, channelById, cleanMessage, crewReply, CHANNELS, isChannelId, replyAt, SLOW_FACTOR, type ChannelId } from '../domain/chat'
import { assignmentFor } from '../domain/boarding'
import { directoryVenue } from '../domain/menus'
import { emergencyCard, DRILL } from '../domain/safety'
import { MUSTER_STATIONS, placeById } from '../domain/deck'
import { buildFolio, folioTotals } from '../domain/folio'
import { eventById, eventsOn } from '../domain/program'
import { excursionById, backBy, dayOf } from '../domain/excursions'
import { partyOf, personaById, type PersonaId } from '../domain/personas'
import { categoryById } from '../domain/ship'
import { categoryOfStateroom } from '../domain/trip'
import { itinerary, portAt, shipClockChanges, shipZoneAt, stageAt, type Sailing } from '../domain/sailings'
import { weatherFor } from '../domain/packing'
import { phoneOk } from '../domain/account'
import type { ScenarioId } from '../domain/scenarios'
import { dateIn, zonedToEpoch } from '../domain/timezones'
import type { DemoState } from '../demo/state'
import type { BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import type { PlanReads } from './planMock'
import type { FolioView, MusterView, OnboardApi, OnboardToday, PortDayView, ProgramView, ServiceApi, ServiceChannelView, ServiceMessage, ServiceThread, TourToday, WeatherToday } from './types'

export interface OnboardDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'profileOf' | 'run'> {
  sailing: () => Sailing
  demo: () => DemoState
  reads: PlanReads
}

const ABOARD_STAGES = ['embarkation', 'seaDay', 'cozumel', 'belize', 'roatan', 'seaDay2', 'farewell'] as const
const HOME = 'America/New_York'

/** The cruise day, 1 to 8, for a moment in ship time; 0 before the first day and 9 after the last. */
export function cruiseDay(s: Sailing, at: number): number {
  const days = itinerary(s)
  const date = dateIn(at, shipZoneAt(s, at))
  if (date < days[0].date) return 0
  if (date > days[7].date) return 9
  return days.find((d) => d.date === date)?.day ?? 0
}

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const SEAS = ['Calm sea and a light breeze.', 'A gentle swell and a moderate breeze.', 'A slight sea and a fresh breeze.'] as const

function weatherOn(date: string, rough: boolean): WeatherToday {
  const w = weatherFor(date)
  const summary = w.rain === 'high' ? 'Showers likely, warm between them' : w.rain === 'some' ? 'Sunny with a passing shower or two' : 'Mostly sunny'
  return { summary, highF: w.highF, lowF: w.lowF, sea: rough ? 'A rougher sea is expected. The ship may tender where it planned to dock.' : SEAS[hash(date) % SEAS.length] }
}

export function createOnboardApi(d: OnboardDeps): OnboardApi {
  const booker = () => d.actor().booker
  const party = () => partyOf(d.who())
  const scenario = (id: ScenarioId) => d.demo().scenarios.includes(id)
  const needsStepFree = async () => (await d.profileOf(booker())).needs.includes('mobility')
  const place = async () => assignmentFor(booker(), d.sailing().id, await needsStepFree())

  const confirmed = async (): Promise<Map<PersonaId, number>> => {
    const out = new Map<PersonaId, number>()
    for (const g of party()) {
      const r = await d.store.get('muster', booker(), g.id)
      const at = (r?.data as { at?: unknown } | undefined)?.at
      if (typeof at === 'number') out.set(g.id, at)
    }
    return out
  }

  const drillAt = () => {
    const s = d.sailing()
    return zonedToEpoch(itinerary(s)[DRILL.day - 1].date, DRILL.time, HOME)
  }

  const musterView = async (): Promise<MusterView> => {
    const done = await confirmed()
    const p = await place()
    const station = p.muster
    const letter = station.slice(-1) as keyof typeof MUSTER_STATIONS
    const where = MUSTER_STATIONS[letter]
    const at = drillAt()
    const all = party().every((g) => done.has(g.id))
    return {
      at, required: !all, done: all, station, stationName: where?.name ?? station, stationPlace: placeById(where?.placeId)?.name ?? '', deck: where?.deck ?? 7,
      guests: party().map((g) => ({ id: g.id, name: g.name, confirmedAt: done.get(g.id) ?? null })), canConfirm: !d.actor().child,
    }
  }

  const stored = async (): Promise<string[]> => {
    const ids = (await d.store.get('plan', d.who(), 'events'))?.data as { ids?: unknown } | undefined
    return Array.isArray(ids?.ids) ? ids.ids.filter((i): i is string => typeof i === 'string' && !!eventById(i)) : []
  }

  const api: OnboardApi = {
    today: () => d.run('onboard.today', async () => {
      const s = d.sailing()
      const now = d.now()
      const stage = stageAt(s, now)
      const aboard = (ABOARD_STAGES as readonly string[]).includes(stage)
      const zone = shipZoneAt(s, now)
      const day = cruiseDay(s, now)
      const date = dateIn(now, zone)
      const portDay = aboard ? portDayAt(s, now) : null
      const m = await confirmed()
      const sail = zonedToEpoch(itinerary(s)[0].date, itinerary(s)[0].depart!, HOME)
      const change = shipClockChanges(s).find((c) => c.at > now && c.at - now < 24 * 3_600_000)
      return {
        aboard, day: day >= 1 && day <= 8 ? day : null, date, port: portAt(s, now).port, shipZone: zone, weather: aboard ? weatherOn(date, scenario('belizeTender')) : null,
        portDay: portDay ? { ...portDay, state: aboardState(portDay.allAboardAt, now) } : null,
        muster: { required: aboard && !party().every((g) => m.has(g.id)), done: party().every((g) => m.has(g.id)), at: drillAt() },
        sailAwayAt: now < sail ? sail : null, changes: scenario('planChange'), clockChange: change ? { at: change.at, hours: change.hours } : null,
      } satisfies OnboardToday
    }),

    program: (day) => d.run('onboard.program', async () => {
      if (!Number.isInteger(day) || day < 1 || day > 8) throw new ApiError('invalid', 'Choose a day from 1 to 8')
      const s = d.sailing()
      const changes = scenario('planChange')
      const events = eventsOn(s, day, changes)
      const x = itinerary(s)[day - 1]
      return { day, date: x.date, port: x.port, events, mine: await stored(), changed: events.some((e) => e.status !== 'on'), canEdit: !d.actor().child } satisfies ProgramView
    }),

    togglePlan: (eventId, on) => d.run('onboard.togglePlan', async () => {
      d.adult()
      if (!eventById(eventId)) throw new ApiError('invalid', 'Unknown event')
      const have = (await stored()).filter((i) => i !== eventId)
      const next = on ? [...have, eventId] : have
      await d.save('plan', d.who(), 'events', { ids: next })
      return next
    }),

    portDay: () => d.run('onboard.portDay', async () => {
      const s = d.sailing()
      const now = d.now()
      const day = portDayAt(s, now)
      if (!day) return null
      const withState = { ...day, state: aboardState(day.allAboardAt, now) }
      const guests = party()
      const myTours = (await d.reads.tours()).filter((t) => excursionById(t.excursionId)?.port === day.port && t.guests.some((g) => guests.some((x) => x.id === g)))
      const tours: TourToday[] = myTours.map((t) => {
        const x = excursionById(t.excursionId)!
        const it = dayOf(s, x)
        return {
          id: t.id, excursionId: x.id, name: x.name, meeting: x.meeting, start: x.start, backBy: backBy(x, it), tender: day.tender,
          guests: t.guests.filter((g) => guests.some((m) => m.id === g)).map((g) => ({ id: g, name: personaById(g)!.name, code: `PCX1|${booker()}|${t.id}|${g}` })),
        }
      })
      const rough = scenario('belizeTender')
      const mayTender = mayTenderInstead(day.port, rough)
      const delayMinutes = rough && day.port === 'belize' ? 40 : 0
      const me = d.actor()
      const assistance = await needsStepFree()
      const group = tenderGroupFor({ shipTour: tours.length > 0, priority: me.tier === 'platinum' || me.tier === 'elite' || me.sanctuary, assistance, seed: `${me.booker}|${day.date}` })
      const tender = day.tender || mayTender ? { ...tenderView(day, group, now, delayMinutes), mayTender, assistance } : null
      return { day: withState, tender, tours, delayMinutes, skipped: scenario('portSkipped') && day.port === 'cozumel' } satisfies PortDayView
    }),

    muster: () => d.run('onboard.muster', musterView),

    confirmMuster: (guests) => d.run('onboard.confirmMuster', async () => {
      d.adult()
      const ok = party().map((g) => g.id)
      if (guests.length === 0 || !guests.every((g) => ok.includes(g))) throw new ApiError('forbidden', 'Not on your booking')
      const now = d.now()
      const at = drillAt()
      if (now < at - 60 * 60_000) throw new ApiError('conflict', 'notOpen')
      if (now > at + 18 * 3_600_000) throw new ApiError('conflict', 'closed')
      for (const g of guests) await d.save('muster', booker(), g, { at: now })
      return musterView()
    }),

    emergency: () => d.run('onboard.emergency', async () => {
      const me = d.actor()
      const p = await place()
      return emergencyCard(me.name, p.number, p.deck, p.muster)
    }),

    folio: () => d.run('onboard.folio', async () => {
      d.adult()
      const s = d.sailing()
      const now = d.now()
      const day = cruiseDay(s, now)
      const throughDay = day >= 9 ? 8 : Math.max(0, day)
      const guests = await Promise.all(
        party().map(async (g) => {
          const { entitlements } = await d.reads.entitlementsOf(g.id)
          const p = personaById(g.id)!
          return { id: g.id, firstName: p.firstName, age: p.age, entitlements, suite: categoryById(categoryOfStateroom(p.stateroom))?.suite ?? false }
        }),
      )
      const dining = (await d.reads.tables()).map((t) => ({ id: t.id, day: t.day, time: t.time, venue: directoryVenue(t.venueId)?.name ?? t.venueId, guests: t.guests as string[], charge: t.charge, covered: t.covered as string[] }))
      const lines = throughDay === 0 ? [] : buildFolio({ sailing: s, throughDay, guests, dining, welcomeCredit: guests[0]?.entitlements.perks.includes('welcomeGift') ?? false }).filter((l) => l.at <= now)
      return { lines, totals: folioTotals(lines), guests: party().map((g) => ({ id: g.id, name: g.name })), throughDay } satisfies FolioView
    }),
  }
  return api
}

export interface ServiceDeps extends Pick<BookingDeps, 'store' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'newId' | 'run'> {
  demo: () => DemoState
  /** Records a call-back request, as `support.callback` does. */
  callback: (phone: string) => Promise<void>
}

export function createServiceApi(d: ServiceDeps): ServiceApi {
  const slow = () => d.demo().scenarios.includes('chatSlow')

  const threadOf = async (id: ChannelId): Promise<ServiceThread> => {
    const channel = channelById(id)!
    const now = d.now()
    const mine = (await d.store.list('svc', d.who())).filter((r) => (r.data as { channel?: unknown }).channel === id).sort((a, b) => a.updatedAt - b.updatedAt)
    const escRecord = await d.store.get('svcEsc', d.who(), id)
    const esc = escRecord ? { at: escRecord.updatedAt, phone: String((escRecord.data as { phone?: unknown }).phone ?? '') } : null
    const messages: ServiceMessage[] = []
    let openFrom: number | null = null
    const window = channel.minutes * (slow() ? SLOW_FACTOR : 1) * 3 * 60_000
    for (const r of mine) {
      messages.push({ id: r.id, from: 'me', text: String((r.data as { text?: unknown }).text ?? ''), at: r.updatedAt })
      if (openFrom === null || r.updatedAt > openFrom + window) {
        openFrom = r.updatedAt
        const at = replyAt(channel, r.updatedAt, slow())
        if (at <= now) messages.push({ id: `reply-${r.id}`, from: 'crew', crew: channel.crew, text: crewReply(id), at })
      }
    }
    if (esc && esc.at <= now) messages.push({ id: `call-${id}`, from: 'crew', crew: channel.crew, text: `We will phone you on ${esc.phone}. You can also dial Guest Services from any ship phone.`, at: esc.at + 1 })
    messages.sort((a, b) => a.at - b.at)
    const state = openFrom === null ? null : chatState(channel, openFrom, now, slow(), esc && esc.at >= openFrom ? esc.at : null)
    return { channel: id, messages, state, slow: slow() }
  }

  const need = (id: unknown): ChannelId => {
    if (!isChannelId(id)) throw new ApiError('invalid', 'Unknown channel')
    return id
  }

  return {
    channels: () => d.run('service.channels', async () =>
      Promise.all(CHANNELS.map(async (c): Promise<ServiceChannelView> => ({ id: c.id, minutes: c.minutes * (slow() ? SLOW_FACTOR : 1), slow: slow(), unanswered: (await threadOf(c.id)).state?.status === 'waiting' }))),
    ),
    thread: (channel) => d.run('service.thread', () => threadOf(need(channel))),
    send: (channel, text) => d.run('service.send', async () => {
      d.adult()
      const id = need(channel)
      const clean = cleanMessage(text)
      if (!clean) throw new ApiError('invalid', 'Write a message first')
      await d.save('svc', d.who(), d.newId('svc'), { channel: id, text: clean })
      return threadOf(id)
    }),
    escalate: (channel, phone) => d.run('service.escalate', async () => {
      d.adult()
      const id = need(channel)
      if (!phoneOk(phone)) throw new ApiError('invalid', 'Check the phone number')
      await d.callback(phone.trim())
      await d.save('svcEsc', d.who(), id, { phone: phone.trim() })
      return threadOf(id)
    }),
  }
}
