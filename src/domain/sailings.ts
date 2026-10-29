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

export const SAILINGS: readonly Sailing[] = [
  { id: 'sun-2026-11-08', departure: '2026-11-08' },
  { id: 'sun-2026-11-22', departure: '2026-11-22' },
  { id: 'sun-2026-12-06', departure: '2026-12-06' },
  { id: 'sun-2026-12-27', departure: '2026-12-27', holiday: true },
  { id: 'sun-2027-01-17', departure: '2027-01-17' },
  { id: 'sun-2027-02-07', departure: '2027-02-07' },
  { id: 'sun-2027-02-28', departure: '2027-02-28' },
  { id: 'sun-2027-03-21', departure: '2027-03-21', reference: true },
]

export const REFERENCE_SAILING: Sailing = SAILINGS.find((s) => s.reference)!

export const sailingById = (id: unknown): Sailing | undefined => SAILINGS.find((s) => s.id === id)

export type PortId = 'fll' | 'sea' | 'cozumel' | 'belize' | 'roatan'

export interface Port {
  id: PortId
  name: string
  /** IANA zone of local time at the port. Cozumel stays on standard time all year, as do Belize and Roatán. */
  zone: string
  tender: boolean
}

/** Zones are the ones the tz database uses today: America/Cancun covers Cozumel (UTC-5 all year), Belize and Honduras are UTC-6 all year. */
export const PORTS: Record<Exclude<PortId, 'sea'>, Port> = {
  fll: { id: 'fll', name: 'Fort Lauderdale (Port Everglades)', zone: 'America/New_York', tender: false },
  cozumel: { id: 'cozumel', name: 'Cozumel, Mexico', zone: 'America/Cancun', tender: false },
  belize: { id: 'belize', name: 'Belize City, Belize', zone: 'America/Belize', tender: true },
  roatan: { id: 'roatan', name: 'Roatán, Honduras', zone: 'America/Tegucigalpa', tender: false },
}

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
}

/** The authored reference timeline (ship profile §11.2); the same order for every sailing. */
export function itinerary(s: Sailing): ItineraryDay[] {
  const d = (n: number) => addDays(s.departure, n - 1)
  return [
    { day: 1, date: d(1), port: 'fll', depart: '15:00' },
    { day: 2, date: d(2), port: 'sea' },
    { day: 3, date: d(3), port: 'cozumel', arrive: '07:00', allAboard: '16:30', depart: '17:00' },
    { day: 4, date: d(4), port: 'belize', arrive: '07:00', allAboard: '16:00', depart: '17:00' },
    { day: 5, date: d(5), port: 'roatan', arrive: '08:00', allAboard: '16:30', depart: '17:00' },
    { day: 6, date: d(6), port: 'sea' },
    { day: 7, date: d(7), port: 'sea' },
    { day: 8, date: d(8), port: 'fll', arrive: '06:00' },
  ]
}

/** Where the ship's own clock stands: Eastern Time from Fort Lauderdale, Belize time through the Belize and Roatán days, Eastern again for the return. */
export const SHIP_HOME_ZONE = 'America/New_York'
export const SHIP_WEST_ZONE = 'America/Belize'

export interface ShipClockChange {
  /** The moment the change happens. */
  at: number
  fromZone: string
  toZone: string
  /** Hours the clock moves: negative is back. */
  hours: number
}

/** The two clock changes of a sailing, each at 02:00 ship time overnight. Whether the jump is one hour or two depends on daylight saving that week. */
export function shipClockChanges(s: Sailing): ShipClockChange[] {
  const days = itinerary(s)
  const make = (day: number, fromZone: string, toZone: string): ShipClockChange => {
    const at = zonedToEpoch(days[day - 1].date, '02:00', fromZone)
    const hours = (offsetMinutes(at, toZone) - offsetMinutes(at - 1, fromZone)) / 60
    return { at, fromZone, toZone, hours }
  }
  return [make(4, SHIP_HOME_ZONE, SHIP_WEST_ZONE), make(7, SHIP_WEST_ZONE, SHIP_HOME_ZONE)]
}

/** The zone the ship's clocks follow at a moment. */
export function shipZoneAt(s: Sailing, at: number): string {
  let zone = SHIP_HOME_ZONE
  for (const c of shipClockChanges(s)) if (at >= c.at) zone = c.toZone
  return zone
}

/** The port the ship is at (or 'sea') at a moment, going by calendar day in ship time and the posted hours. */
export function portAt(s: Sailing, at: number): { port: PortId; day: number | null } {
  const days = itinerary(s)
  const first = zonedToEpoch(days[0].date, '00:00', SHIP_HOME_ZONE)
  const last = zonedToEpoch(days[7].date, '23:59', SHIP_HOME_ZONE)
  if (at < first || at > last + 24 * 3_600_000) return { port: 'sea', day: null }
  const zone = shipZoneAt(s, at)
  const today = days.find((x) => x.date === dateIn(at, zone))
  if (!today) return { port: 'sea', day: null }
  if (today.port === 'sea' || today.port === 'fll') return { port: today.port, day: today.day }
  const port = PORTS[today.port]
  const arrive = zonedToEpoch(today.date, today.arrive!, port.zone)
  const depart = zonedToEpoch(today.date, today.depart!, port.zone)
  return at >= arrive && at < depart ? { port: today.port, day: today.day } : { port: 'sea', day: today.day }
}

/** The all-aboard moment on a port day, or null when the day has none. */
export function allAboardEpoch(s: Sailing, day: number): number | null {
  const d = itinerary(s)[day - 1]
  if (!d?.allAboard || d.port === 'sea' || d.port === 'fll') return null
  return zonedToEpoch(d.date, d.allAboard, PORTS[d.port].zone)
}

export type StageId = 'booked' | 'preCruise' | 'checkIn' | 'embarkation' | 'seaDay' | 'cozumel' | 'belize' | 'roatan' | 'seaDay2' | 'farewell' | 'disembark' | 'postCruise'

/** Journey stages in order, with when each begins (ship time unless the stage is before or after the cruise). */
export function stageStarts(s: Sailing): { id: StageId; at: number }[] {
  const days = itinerary(s)
  const at = (n: number, time: string) => zonedToEpoch(days[n - 1].date, time, shipZoneAt(s, zonedToEpoch(days[n - 1].date, '12:00', SHIP_HOME_ZONE)))
  const home = (offset: number, time: string) => zonedToEpoch(addDays(s.departure, offset), time, SHIP_HOME_ZONE)
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
