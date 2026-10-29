import type { Cents } from './pricing'
import { placeById } from './deck'
import { allAboardEpoch, itinerary, shipZoneOnDate, type Sailing } from './sailings'
import { zonedToEpoch } from './timezones'

/** The daily programme ("Patter", OB-02, OB-09): what is on, where, and for whom. Titles, times and prices are authored concept values. */
export type AgeGroup = 'all' | 'kids' | 'teens' | 'adults'
export type EventInterest = 'shows' | 'music' | 'games' | 'wellness' | 'learning' | 'family' | 'nightlife'

export const AGE_GROUPS: readonly AgeGroup[] = ['all', 'kids', 'teens', 'adults']
export const EVENT_INTERESTS: readonly EventInterest[] = ['shows', 'music', 'games', 'wellness', 'learning', 'family', 'nightlife']

export interface ShipEvent {
  id: string
  /** Days of the cruise it runs on, 1 to 8. */
  days: readonly number[]
  /** Ship time, "HH:MM". */
  start: string
  minutes: number
  title: string
  placeId: string
  age: AgeGroup
  interest: EventInterest
  /** Extra cost per person; 0 is included in the fare. */
  extra: Cents
  /** Listed on a port day only after the ship is back aboard. */
  afterAllAboard?: boolean
}

const ev = (id: string, days: readonly number[], start: string, minutes: number, title: string, placeId: string, age: AgeGroup, interest: EventInterest, extra: Cents = 0): ShipEvent => ({ id, days, start, minutes, title, placeId, age, interest, extra })

const SEA = [2, 6, 7]
const PORT = [3, 4, 5]
const NIGHTS = [1, 2, 3, 4, 5, 6, 7]

export const EVENTS: readonly ShipEvent[] = [
  ev('muster', [1], '14:00', 30, 'Muster drill: go to your station', 'piazza', 'all', 'learning'),
  ev('sailaway', [1], '15:00', 60, 'Sail-away party', 'lido-pool', 'all', 'music'),
  ev('welcome-piazza', [1], '19:00', 45, 'Welcome music in the Piazza', 'piazza', 'all', 'music'),
  ev('welcome-show', [1], '20:30', 60, 'Welcome aboard show', 'arena', 'all', 'shows'),
  ev('kids-open-house', [1], '16:30', 60, 'Kids’ club open house', 'firefly', 'kids', 'family'),
  ev('teen-open-house', [1], '17:00', 45, 'Teen lounge meet-up', 'underground', 'teens', 'family'),

  ev('stretch', SEA, '08:00', 45, 'Morning stretch', 'fitness', 'adults', 'wellness'),
  ev('trivia', SEA, '10:30', 45, 'Team trivia', 'live', 'all', 'games'),
  ev('cooking', SEA, '11:00', 60, 'Cooking demo with the executive chef', 'eclipse', 'all', 'learning'),
  ev('bingo', SEA, '14:00', 60, 'Bingo', 'live', 'adults', 'games', 2500),
  ev('art-talk', [2, 6], '15:00', 45, 'Art talk: the ship’s collection', 'piazza', 'all', 'learning'),
  ev('craft', SEA, '10:00', 60, 'Craft time', 'firefly', 'kids', 'family'),
  ev('tween-games', SEA, '13:30', 60, 'Tween games afternoon', 'neon-grove', 'kids', 'family'),
  ev('teen-night', SEA, '21:30', 90, 'Teen dance night', 'underground', 'teens', 'nightlife'),
  ev('spa-tour', [2, 6], '11:30', 30, 'Spa tour and tasting', 'lotus', 'adults', 'wellness'),
  ev('stage-show', [2, 6, 7], '20:30', 60, 'Main stage production', 'arena', 'all', 'shows'),
  ev('stage-early', [2], '18:30', 60, 'Main stage production, early show', 'arena', 'all', 'shows'),
  ev('jazz', NIGHTS, '21:30', 90, 'Live jazz', 'crooners', 'adults', 'music'),
  ev('piazza-band', NIGHTS, '17:30', 45, 'Piazza live band', 'piazza', 'all', 'music'),
  ev('dome-show', [2, 3, 5, 6], '22:00', 45, 'Acrobatic show in the Dome', 'dome', 'all', 'shows'),
  ev('dome-dj', [2, 6, 7], '23:00', 90, 'Dance party in the Dome', 'dome', 'adults', 'nightlife'),
  ev('movie', NIGHTS, '20:00', 120, 'Movie under the stars', 'lido-pool', 'all', 'family'),
  ev('wine', [2, 6], '16:00', 60, 'Wine tasting', 'bellinis', 'adults', 'learning', 3500),
  ev('farewell-show', [7], '19:30', 60, 'Farewell show', 'arena', 'all', 'shows'),
  ev('packing', [7], '15:00', 40, 'Disembarkation talk', 'piazza', 'all', 'learning'),

  { ...ev('port-lecture', PORT, '19:00', 40, 'Tomorrow’s port: talk and questions', 'piazza', 'all', 'learning'), afterAllAboard: true },
  { ...ev('port-music', PORT, '18:00', 60, 'Sail-away steel drums', 'lido-pool', 'all', 'music'), afterAllAboard: true },
  { ...ev('port-show', PORT, '20:30', 60, 'Main stage production', 'arena', 'all', 'shows'), afterAllAboard: true },
  { ...ev('port-kids', PORT, '19:30', 60, 'Evening kids’ club', 'firefly', 'kids', 'family'), afterAllAboard: true },
  { ...ev('port-quiet', PORT, '17:45', 60, 'Quiet hour in the spa', 'lotus', 'adults', 'wellness', 2500), afterAllAboard: true },
]

export const eventById = (id: unknown): ShipEvent | undefined => EVENTS.find((e) => e.id === id)

export type EventStatus = 'on' | 'moved' | 'cancelled'

/** A change the ship makes mid-day (OB-08): the scenario "Daily plan changes mid-day". */
export interface PlanChange { eventId: string; day: number; kind: 'moved' | 'cancelled'; start?: string; reason: string }

export const PLAN_CHANGES: readonly PlanChange[] = [
  { eventId: 'stage-show', day: 2, kind: 'moved', start: '21:15', reason: 'The ship is running behind the weather. The show starts 45 minutes later.' },
  { eventId: 'trivia', day: 2, kind: 'cancelled', reason: 'The host is unwell. Bingo at 2:00 pm is on as planned.' },
]

export interface DatedEvent extends ShipEvent {
  day: number
  date: string
  startAt: number
  endAt: number
  status: EventStatus
  /** The time before a move, "HH:MM". */
  was?: string
  reason?: string
}

/** The events on a day of the cruise, in time order, with any mid-day changes applied when `changes` is on. */
export function eventsOn(s: Sailing, day: number, changes: boolean): DatedEvent[] {
  const date = itinerary(s)[day - 1]?.date
  if (!date) return []
  const zone = shipZoneOnDate(s, date)
  const aboard = allAboardEpoch(s, day)
  const out: DatedEvent[] = []
  for (const e of EVENTS) {
    if (!e.days.includes(day)) continue
    const change = changes ? PLAN_CHANGES.find((c) => c.eventId === e.id && c.day === day) : undefined
    const start = change?.kind === 'moved' && change.start ? change.start : e.start
    const startAt = zonedToEpoch(date, start, zone)
    if (e.afterAllAboard && aboard !== null && startAt < aboard) continue
    out.push({ ...e, start, day, date, startAt, endAt: startAt + e.minutes * 60_000, status: change?.kind ?? 'on', was: change?.kind === 'moved' ? e.start : undefined, reason: change?.reason })
  }
  return out.sort((a, b) => a.startAt - b.startAt || a.title.localeCompare(b.title))
}

export interface EventFilter {
  interests: readonly EventInterest[]
  /** Show only events for this age group (kids, teens or adults), plus those for everyone. */
  age: AgeGroup | null
  stepFree: boolean
  cost: 'included' | 'extra' | null
  /** Hide events already over. */
  upcomingOnly: boolean
}

export const NO_EVENT_FILTER: EventFilter = { interests: [], age: null, stepFree: false, cost: null, upcomingOnly: false }

export type EventSort = 'time' | 'venue' | 'deck'

export function filterEvents(list: readonly DatedEvent[], f: EventFilter, now: number): DatedEvent[] {
  return list.filter((e) => {
    if (f.interests.length > 0 && !f.interests.includes(e.interest)) return false
    if (f.age && e.age !== 'all' && e.age !== f.age) return false
    if (f.stepFree && !placeById(e.placeId)?.stepFree) return false
    if (f.cost === 'included' && e.extra > 0) return false
    if (f.cost === 'extra' && e.extra === 0) return false
    if (f.upcomingOnly && e.endAt <= now) return false
    return true
  })
}

export function sortEvents(list: readonly DatedEvent[], by: EventSort): DatedEvent[] {
  const name = (e: DatedEvent) => placeById(e.placeId)?.name ?? ''
  const deck = (e: DatedEvent) => placeById(e.placeId)?.deck ?? 0
  const cmp: Record<EventSort, (a: DatedEvent, b: DatedEvent) => number> = {
    time: (a, b) => a.startAt - b.startAt,
    venue: (a, b) => name(a).localeCompare(name(b)) || a.startAt - b.startAt,
    deck: (a, b) => deck(a) - deck(b) || a.startAt - b.startAt,
  }
  return [...list].sort(cmp[by])
}

/** What is on now and what comes next (OB-09), ignoring cancelled events. "Next up" is the earliest start after now. */
export function nowAndNext(list: readonly DatedEvent[], now: number): { now: DatedEvent[]; next: DatedEvent[] } {
  const live = list.filter((e) => e.status !== 'cancelled')
  const on = live.filter((e) => e.startAt <= now && now < e.endAt)
  const later = live.filter((e) => e.startAt > now)
  const first = later.reduce<number | null>((m, e) => (m === null || e.startAt < m ? e.startAt : m), null)
  return { now: on, next: first === null ? [] : later.filter((e) => e.startAt === first) }
}

/** Minutes before an event that its reminder fires. Always counted in ship time. */
export const REMINDER_MINUTES = 15

export const reminderAt = (e: Pick<DatedEvent, 'startAt'>): number => e.startAt - REMINDER_MINUTES * 60_000

/** Two events in the plan at the same time, for the same person: a warning, not a block. */
export function overlapping(plan: readonly DatedEvent[]): [DatedEvent, DatedEvent][] {
  const live = plan.filter((e) => e.status !== 'cancelled').sort((a, b) => a.startAt - b.startAt)
  const pairs: [DatedEvent, DatedEvent][] = []
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length && live[j].startAt < live[i].endAt; j++) pairs.push([live[i], live[j]])
  return pairs
}
