import { addDays, dateIn, offsetMinutes, zonedToEpoch } from './timezones'

/** One mock 7-night Western Caribbean departure from Fort Lauderdale (requirements §22.7; reference sailing 21 Mar 2027). */
export interface Sailing {
  id: string
  /** Departure date, "YYYY-MM-DD". */
  departure: string
  /** The 27 Dec holiday variant. */
  holiday?: boolean
  /** The authored reference sailing the demo opens on. */
  reference?: boolean
}

/** The sailings come from the server's table (`replaceSailings`, see `sailingsServed.ts`); nothing is authored here. Replaced in place so earlier imports see the change. */
export const SAILINGS: readonly Sailing[] = []

export const REFERENCE_SAILING: Sailing = { id: '', departure: '1970-01-01', reference: true }
// The reference object is kept (and updated in place) when the served table replaces the list, so imports of it stay current.

export const sailingById = (id: unknown): Sailing | undefined => SAILINGS.find((s) => s.id === id)

/** A port id from the served catalogue (a short lower-case slug), or `'sea'` for a day at sea. */
export type PortId = string

export interface Port {
  id: PortId
  name: string
  /** IANA zone of local time at the port. Cozumel stays on standard time all year, as do Belize and Roatán. */
  zone: string
  tender: boolean
  /** Catalogue facts, present for ports that came from the served catalogue. */
  country?: string
  countryCode?: string
  region?: string
  lat?: number
  lon?: number
  currency?: string
  languages?: readonly string[]
  tier?: 'A' | 'B' | 'C'
  artId?: string
}

/** The ports of the older route, from the served sailings table. Zones are the ones the tz database uses today: America/Cancun covers Cozumel (UTC-5 all year), Belize and Honduras are UTC-6 all year. */
export const PORTS: Record<string, Port> = {}

/** Every port of the served catalogue (`shipCatalogue.ts` fills it); replaced in place. */
export const CATALOGUE_PORTS: Record<string, Port> = {}

/** A port of any sailing: the catalogue first, then the older route's own table. */
export const portById = (id: string): Port | undefined => PORTS[id] ?? CATALOGUE_PORTS[id]

export interface ItineraryDay {
  /** 1 to 8. */
  day: number
  /** Calendar date in ship time at the start of the day. */
  date: string
  port: PortId
  /** Local port times, "HH:MM". */
  arrive?: string
  allAboard?: string
  depart?: string
  /** The zone the ship's clocks follow on this day (after any change at 02:00 that morning). Absent: the ship's home zone. */
  zone?: string
}

/** The authored reference timeline (ship profile §11.2); the same order for every sailing. */
/** Nights on a sailing, read from its itinerary (the last day is the morning of arrival, so nights are days minus one). */
export const sailingNights = (s: Sailing): number => Math.max(1, itinerary(s).length - 1)

/** One day of the timeline before it is dated: the same for every sailing. */
export type ItineraryTemplateDay = Omit<ItineraryDay, 'date'>

let TEMPLATE: readonly ItineraryTemplateDay[] = []

/** The days a sailing was served with by `GET /reference/sailings/{id}/itinerary` (any length, any route); kept by sailing id. */
const SERVED_DAYS = new Map<string, readonly ItineraryDay[]>()

/** Puts one sailing's served days in use. Returns false when they are not usable (none, or not numbered 1, 2, 3 in order). */
export function setSailingDays(sailingId: string, days: readonly ItineraryDay[]): boolean {
  if (days.length < 2 || days.some((d, i) => d.day !== i + 1)) return false
  SERVED_DAYS.set(sailingId, days.map((d) => ({ ...d })))
  return true
}

export const hasSailingDays = (sailingId: string): boolean => SERVED_DAYS.has(sailingId)

/** The days of a sailing: its own served days when they have been loaded, otherwise the older route's template dated from the departure. */
export function itinerary(s: Sailing): ItineraryDay[] {
  const own = SERVED_DAYS.get(s.id)
  if (own) return own.map((d) => ({ ...d }))
  return TEMPLATE.map((t) => ({ ...t, date: addDays(s.departure, t.day - 1) }))
}

/** What the server's table puts in use (called by `applySailings` only). Sailings and ports are updated in place so earlier imports see the change. */
export function replaceSailings(next: { sailings: readonly Sailing[]; ports: Record<string, Port>; template: readonly ItineraryTemplateDay[] }): void {
  const list = SAILINGS as Sailing[]
  const merged = next.sailings.map((n) => (n.reference ? Object.assign(REFERENCE_SAILING, { holiday: undefined }, n) : { ...n }))
  list.splice(0, list.length, ...merged)
  for (const id of Object.keys(PORTS)) delete (PORTS as Record<string, Port>)[id]
  Object.assign(PORTS, next.ports)
  TEMPLATE = next.template
}

/** The zone the ship's clocks follow when it leaves: the first day's zone, or the zone of the first port. */
export function shipHomeZone(s: Sailing): string {
  const first = itinerary(s)[0]
  return first?.zone ?? portById(first?.port ?? '')?.zone ?? 'UTC'
}

export interface ShipClockChange {
  /** The moment the change happens. */
  at: number
  fromZone: string
  toZone: string
  /** Hours the clock moves: negative is back. */
  hours: number
}

/** Each change of the ship's clock on a sailing: wherever the day rows move the zone, at 02:00 ship time overnight. Whether a jump is one hour or two depends on daylight saving that week. */
export function shipClockChanges(s: Sailing): ShipClockChange[] {
  const days = itinerary(s)
  const changes: ShipClockChange[] = []
  let zone = shipHomeZone(s)
  for (const d of days) {
    if (!d.zone || d.zone === zone) continue
    const at = zonedToEpoch(d.date, '02:00', zone)
    changes.push({ at, fromZone: zone, toZone: d.zone, hours: (offsetMinutes(at, d.zone) - offsetMinutes(at - 1, zone)) / 60 })
    zone = d.zone
  }
  return changes
}

/** The zone the ship's clocks follow at a moment. */
export function shipZoneAt(s: Sailing, at: number): string {
  let zone = shipHomeZone(s)
  for (const c of shipClockChanges(s)) if (at >= c.at) zone = c.toZone
  return zone
}

/** The zone the ship's clocks follow on a calendar date: the zone of the last day on or before it (changes happen at 02:00, so a day keeps one zone). */
export function shipZoneOnDate(s: Sailing, date: string): string {
  let zone = shipHomeZone(s)
  for (const d of itinerary(s)) if (d.date <= date && d.zone) zone = d.zone
  return zone
}

/** The port the ship is at (or 'sea') at a moment, going by calendar day in ship time and the posted hours. The first and last days (embarkation and disembarkation) belong to the home port all day. */
export function portAt(s: Sailing, at: number): { port: PortId; day: number | null } {
  const days = itinerary(s)
  const home = shipHomeZone(s)
  const first = zonedToEpoch(days[0].date, '00:00', home)
  const last = zonedToEpoch(days[days.length - 1].date, '23:59', shipZoneOnDate(s, days[days.length - 1].date))
  if (at < first || at > last + 24 * 3_600_000) return { port: 'sea', day: null }
  const zone = shipZoneAt(s, at)
  const today = days.find((x) => x.date === dateIn(at, zone))
  if (!today) return { port: 'sea', day: null }
  const port = portById(today.port)
  if (today.port === 'sea' || !today.arrive || !today.depart || !port) return { port: today.port, day: today.day }
  const arrive = zonedToEpoch(today.date, today.arrive, port.zone)
  const depart = zonedToEpoch(today.date, today.depart, port.zone)
  return at >= arrive && at < depart ? { port: today.port, day: today.day } : { port: 'sea', day: today.day }
}

/** The all-aboard moment on a port day, or null when the day has none. */
export function allAboardEpoch(s: Sailing, day: number): number | null {
  const d = itinerary(s)[day - 1]
  const port = d ? portById(d.port) : undefined
  if (!d?.allAboard || d.port === 'sea' || !port) return null
  return zonedToEpoch(d.date, d.allAboard, port.zone)
}

export type StageId = 'booked' | 'preCruise' | 'checkIn' | 'embarkation' | 'seaDay' | 'cozumel' | 'belize' | 'roatan' | 'seaDay2' | 'farewell' | 'disembark' | 'postCruise'

/** Journey stages in order, with when each begins (ship time unless the stage is before or after the cruise). */
export function stageStarts(s: Sailing): { id: StageId; at: number }[] {
  const days = itinerary(s)
  const homeZone = shipHomeZone(s)
  const at = (n: number, time: string) => zonedToEpoch(days[n - 1].date, time, shipZoneOnDate(s, days[n - 1].date))
  const home = (offset: number, time: string) => zonedToEpoch(addDays(s.departure, offset), time, homeZone)
  return [
    { id: 'booked', at: home(-90, '10:00') },
    { id: 'preCruise', at: home(-14, '10:00') },
    { id: 'checkIn', at: home(-3, '10:00') },
    { id: 'embarkation', at: at(1, '11:00') },
    { id: 'seaDay', at: at(2, '08:00') },
    { id: 'cozumel', at: at(3, '08:00') },
    { id: 'belize', at: at(4, '08:00') },
    { id: 'roatan', at: at(5, '09:00') },
    { id: 'seaDay2', at: at(6, '08:00') },
    { id: 'farewell', at: at(7, '08:00') },
    { id: 'disembark', at: at(8, '06:00') },
    { id: 'postCruise', at: home(10, '10:00') },
  ]
}

export const STAGE_IDS: readonly StageId[] = ['booked', 'preCruise', 'checkIn', 'embarkation', 'seaDay', 'cozumel', 'belize', 'roatan', 'seaDay2', 'farewell', 'disembark', 'postCruise']

/** The stage a moment falls in; any time before the first stage counts as "booked". */
export function stageAt(s: Sailing, at: number): StageId {
  let current: StageId = 'booked'
  for (const st of stageStarts(s)) if (at >= st.at) current = st.id
  return current
}

/** A moment inside the stage, used by "jump to a stage". */
export function timeForStage(s: Sailing, stage: StageId): number {
  return stageStarts(s).find((x) => x.id === stage)!.at
}
