import { allAboardEpoch, itinerary, PORTS, shipZoneAt, type PortId, type Sailing } from './sailings'
import { clockTime } from './syncAge'
import { zonedToEpoch } from './timezones'

/** The all-aboard countdown, reminders and tender arrangements (POR-02, POR-04, POR-08, POR-11). Times, groups and waits are authored concept values (verify before real use). */
export const REMINDER_THRESHOLDS: readonly number[] = [120, 60, 30]

export type AboardLevel = 'plenty' | 'soon' | 'now' | 'late' | 'gone'

export interface AboardState {
  /** The all-aboard moment. */
  at: number
  /** Whole minutes left, never below zero. */
  minutesLeft: number
  level: AboardLevel
  /** Reminder points already passed: 120, 60, 30. */
  reminders: number[]
  /** The next reminder point still ahead, or null. */
  nextReminder: number | null
}

/** The sailing leaves 30 minutes after all-aboard on the authored days (e.g. all aboard 16:30, depart 17:00). */
export const SAIL_AFTER_MINUTES = 30

/** Where a guest stands against the all-aboard time: plenty of time, under two hours (soon), under thirty minutes (now), past it but before sailing (late), or the ship has gone. */
export function aboardState(allAboardAt: number, now: number): AboardState {
  const minutesLeft = Math.max(0, Math.ceil((allAboardAt - now) / 60_000))
  const sailAt = allAboardAt + SAIL_AFTER_MINUTES * 60_000
  const level: AboardLevel = now >= sailAt ? 'gone' : now >= allAboardAt ? 'late' : minutesLeft <= 30 ? 'now' : minutesLeft <= 120 ? 'soon' : 'plenty'
  const reminders = REMINDER_THRESHOLDS.filter((m) => minutesLeft <= m && now < allAboardAt)
  const nextReminder = [...REMINDER_THRESHOLDS].sort((a, b) => b - a).find((m) => m < minutesLeft) ?? null
  return { at: allAboardAt, minutesLeft, level, reminders, nextReminder }
}

/** The moment each reminder fires: the threshold before all-aboard, in ship time. Reminders always follow the ship's clock, never the phone's. */
export const reminderTimes = (allAboardAt: number): { minutes: number; at: number }[] => REMINDER_THRESHOLDS.map((minutes) => ({ minutes, at: allAboardAt - minutes * 60_000 }))

export interface PortDay {
  day: number
  port: Exclude<PortId, 'sea' | 'fll'>
  date: string
  /** All-aboard, ship time and local port time, "9:30 am". */
  allAboardShip: string
  allAboardLocal: string
  allAboardAt: number
  arriveAt: number
  departAt: number
  shipZone: string
  portZone: string
  tender: boolean
}

/** The port day a moment falls in, or the nearest one still to come, or null when none is left. */
export function portDayAt(s: Sailing, now: number): PortDay | null {
  const days = itinerary(s).filter((x) => x.port !== 'sea' && x.port !== 'fll')
  for (const x of days) {
    if (x.port === 'sea' || x.port === 'fll') continue
    const zone = PORTS[x.port].zone
    const depart = zonedToEpoch(x.date, x.depart!, zone)
    if (now > depart) continue
    const allAboardAt = allAboardEpoch(s, x.day)!
    const shipZone = shipZoneAt(s, allAboardAt)
    return {
      day: x.day, port: x.port, date: x.date, allAboardAt, shipZone, portZone: zone, tender: PORTS[x.port].tender,
      allAboardShip: clockTime(new Date(allAboardAt), shipZone), allAboardLocal: clockTime(new Date(allAboardAt), zone),
      arriveAt: zonedToEpoch(x.date, x.arrive!, zone), departAt: zonedToEpoch(x.date, x.depart!, zone),
    }
  }
  return null
}

// ---- Tender (POR-04) ----

export interface TenderGroup { id: string; name: string; /** Minutes after the first call. */ offset: number }

/** Ticket groups called in order from the first call; ship-tour guests and priority guests go first. */
export const TENDER_GROUPS: readonly TenderGroup[] = [
  { id: 'tour', name: 'Ship tours', offset: 0 },
  { id: 'priority', name: 'Priority and assistance', offset: 15 },
  { id: 'g1', name: 'Group 1', offset: 30 },
  { id: 'g2', name: 'Group 2', offset: 60 },
  { id: 'g3', name: 'Group 3', offset: 90 },
  { id: 'g4', name: 'Group 4', offset: 120 },
]

/** The first call, local port time, after the ship anchors. */
export const FIRST_CALL = '07:45'
/** The last tender leaves the landing this long before all-aboard. */
export const LAST_TENDER_MINUTES = 45

export const isTenderGroup = (id: unknown): id is string => TENDER_GROUPS.some((g) => g.id === id)

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A guest's group: ship-tour guests first, priority or assistance guests next, the rest spread over four groups. */
export function tenderGroupFor(who: { shipTour: boolean; priority: boolean; assistance: boolean; seed: string }): TenderGroup {
  if (who.shipTour) return TENDER_GROUPS[0]
  if (who.priority || who.assistance) return TENDER_GROUPS[1]
  return TENDER_GROUPS[2 + (hash(who.seed) % 4)]
}

export type TenderStatus = 'before' | 'waiting' | 'calling' | 'running' | 'delayed'

export interface TenderView {
  group: TenderGroup
  /** When the group is called, ship epoch. */
  callAt: number
  status: TenderStatus
  /** Minutes the whole operation is running late; zero when on time. */
  delayMinutes: number
  /** Minutes to wait at the landing, an estimate. */
  waitMinutes: number
  lastTenderAt: number
}

/** Tender state for a port day. `delayMinutes` is the scenario's late start; a delayed operation calls every group that much later. */
export function tenderView(day: PortDay, group: TenderGroup, now: number, delayMinutes: number): TenderView {
  const scheduled = zonedToEpoch(day.date, FIRST_CALL, day.portZone)
  const first = scheduled + delayMinutes * 60_000
  const callAt = first + group.offset * 60_000
  const status: TenderStatus = now < scheduled - 30 * 60_000 ? 'before' : delayMinutes > 0 && now < first ? 'delayed' : now < callAt - 5 * 60_000 ? 'waiting' : now < callAt + 30 * 60_000 ? 'calling' : 'running'
  const waitMinutes = status === 'running' ? 10 + (hash(`${day.date}|${Math.floor(now / 900_000)}`) % 11) : status === 'calling' ? 15 : 0
  return { group, callAt, status, delayMinutes, waitMinutes, lastTenderAt: day.allAboardAt - LAST_TENDER_MINUTES * 60_000 }
}

/** Whether the ship may tender instead of docking: Roatán in the weather scenario (POR-04). */
export const mayTenderInstead = (port: PortDay['port'], weather: boolean): boolean => weather && port === 'roatan'

// ---- Running late (POR-08) ----

export type LateStep = 'call' | 'agent' | 'meet' | 'documents'

/** What to do if the ship is about to leave without you; the same steps whether the tour was booked with the ship or not. */
export const LATE_STEPS: readonly LateStep[] = ['call', 'agent', 'meet', 'documents']
