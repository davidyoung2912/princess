import type { StringKey } from '../i18n'
import { arrivalWindows } from './travel'
import { EMBARK, departureEpoch, trafficFor, type Traffic } from './boarding'
import { addDays } from './timezones'

/**
 * Door to door (S4A-01, 02, 04, 06, 07, 10, 11, 12): one timeline from leaving home or the hotel to the gangway, with the slack on each leg.
 * Times are authored concept values; flight status, weather and traffic are simulated (`source: 'sim'`) so a real feed can replace them.
 */
export type TripMode = 'fly' | 'drive' | 'local'
export const TRIP_MODES: readonly TripMode[] = ['fly', 'drive', 'local']
export const isTripMode = (v: unknown): v is TripMode => (TRIP_MODES as readonly unknown[]).includes(v)

/** Minutes from landing to leaving the airport (walk, bags), and from the airport to the terminal. Authored. */
export const AIRPORT_EXIT_MINUTES = 50
export const AIRPORT_EXIT_CARRY_ON = 25
export const AIRPORT_TO_TERMINAL_MINUTES = 35
export const HOTEL_CHECKOUT_MINUTES = 30
export const SLACK_COMFORT = 120
export const SLACK_TIGHT = 60

export interface JourneyPlan {
  mode: TripMode
  /** Flight number such as "AA1234"; empty when not flying. */
  flightNumber: string
  /** Planned landing, "HH:MM" Fort Lauderdale time, on sailing day (or the day before when `hotelNight`). */
  landing: string
  /** The guest has only a carry-on and need not wait for bags. */
  carryOnOnly: boolean
  /** Minutes by road to the terminal when driving or living nearby. */
  roadMinutes: number
  /** Staying the night before near the port. */
  hotelNight: boolean
  /** The arrival window chosen in the travel plan, "HH:MM", or null. */
  windowStart: string | null
}

export const EMPTY_JOURNEY: JourneyPlan = { mode: 'fly', flightNumber: '', landing: '09:30', carryOnOnly: false, roadMinutes: 90, hotelNight: false, windowStart: null }

export type LegId = 'leave' | 'flight' | 'airport' | 'transfer' | 'hotel' | 'terminal'
export type Status = 'onTrack' | 'tight' | 'atRisk'

export interface Leg { id: LegId; label: StringKey; start: number; end: number; minutes: number }

export interface Journey {
  legs: Leg[]
  /** When the guest is ready at the terminal door. */
  atTerminal: number
  /** Minutes between that and the moment the gangway closes (negative when late). */
  slack: number
  status: Status
  /** True when the guest reaches the terminal after their chosen window ends. */
  pastWindow: boolean
  /** When to leave the start point (hotel or home). Null when flying on the day with no road leg to time. */
  leaveBy: number | null
}

export const statusFor = (slack: number): Status => (slack >= SLACK_COMFORT ? 'onTrack' : slack >= SLACK_TIGHT ? 'tight' : 'atRisk')

const at = (date: string, time: string): number => departureEpoch(date, time)
const MIN = 60_000

/**
 * Builds the timeline for a sailing day, working back from the terminal. `delayMinutes` is a flight delay (or any late start) that pushes the legs.
 * A guest who stays the night before starts at the hotel, so the flight does not matter on the day.
 */
export function buildJourney(plan: JourneyPlan, departure: string, delayMinutes = 0): Journey {
  const gangway = at(departure, EMBARK.gangwayCloses)
  const window = plan.windowStart ?? EMBARK.terminalOpens
  const windowOpen = at(departure, window)
  const windowEnd = windowOpen + 30 * MIN
  const legs: Leg[] = []
  let atTerminal: number
  let leaveBy: number | null = null

  if (plan.hotelNight) {
    // Leave the hotel in time for checkout, then the road to the terminal; the guest aims for the start of their window.
    const road = Math.max(10, Math.min(60, plan.mode === 'fly' ? AIRPORT_TO_TERMINAL_MINUTES : plan.roadMinutes))
    const leaveStart = windowOpen - (road + HOTEL_CHECKOUT_MINUTES) * MIN
    legs.push({ id: 'hotel', label: 'journey.leg.hotel', start: leaveStart, end: leaveStart + HOTEL_CHECKOUT_MINUTES * MIN, minutes: HOTEL_CHECKOUT_MINUTES })
    legs.push({ id: 'transfer', label: 'journey.leg.transfer', start: leaveStart + HOTEL_CHECKOUT_MINUTES * MIN, end: windowOpen, minutes: road })
    atTerminal = windowOpen + delayMinutes * MIN
    leaveBy = leaveStart
  } else if (plan.mode === 'fly') {
    const landing = at(departure, plan.landing) + delayMinutes * MIN
    const exit = plan.carryOnOnly ? AIRPORT_EXIT_CARRY_ON : AIRPORT_EXIT_MINUTES
    const out = landing + exit * MIN
    legs.push({ id: 'flight', label: 'journey.leg.flight', start: landing, end: landing, minutes: 0 })
    legs.push({ id: 'airport', label: 'journey.leg.airport', start: landing, end: out, minutes: exit })
    legs.push({ id: 'transfer', label: 'journey.leg.transfer', start: out, end: out + AIRPORT_TO_TERMINAL_MINUTES * MIN, minutes: AIRPORT_TO_TERMINAL_MINUTES })
    atTerminal = out + AIRPORT_TO_TERMINAL_MINUTES * MIN
  } else {
    // By road: the guest sets off so as to reach the start of their window, and a delay moves the arrival.
    const road = Math.max(10, Math.min(900, Math.round(plan.roadMinutes)))
    const start = windowOpen - road * MIN
    legs.push({ id: 'leave', label: 'journey.leg.leave', start, end: start, minutes: 0 })
    legs.push({ id: 'transfer', label: 'journey.leg.drive', start, end: windowOpen, minutes: road })
    atTerminal = windowOpen + delayMinutes * MIN
    leaveBy = start
  }

  legs.push({ id: 'terminal', label: 'journey.leg.terminal', start: atTerminal, end: gangway, minutes: Math.max(0, Math.round((gangway - atTerminal) / MIN)) })
  const slack = Math.round((gangway - atTerminal) / MIN)
  // A flying guest who arrives before the window opens waits; one who arrives after it ends is outside it.
  return { legs, atTerminal, slack, status: statusFor(slack), pastWindow: plan.windowStart !== null && atTerminal > windowEnd, leaveBy }
}

/** The earliest sensible landing time on sailing day for a comfortable margin. */
export function latestComfortableLanding(plan: Pick<JourneyPlan, 'carryOnOnly'>): string {
  const exit = plan.carryOnOnly ? AIRPORT_EXIT_CARRY_ON : AIRPORT_EXIT_MINUTES
  const gangwayMin = toMinutes(EMBARK.gangwayCloses)
  const latest = gangwayMin - SLACK_COMFORT - AIRPORT_TO_TERMINAL_MINUTES - exit
  return fromMinutes(latest)
}

export const toMinutes = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export const fromMinutes = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

// ---- Fly the day before (S4A-02) ----

/** Authored guides, "(verify)" wherever shown. */
export const HOTEL_NIGHT_COST_CENTS = 15_900
export const MISSED_SHIP_COST_CENTS = 90_000

export interface EarlyAdvice { recommend: boolean; reason: 'tight' | 'late' | 'early' | 'carryOn' | 'staying' | 'notFlying'; hotelCostCents: number; missedCostCents: number }

/** Recommends flying the day before when the same-day slack is under two hours; says so plainly otherwise. The cost of the hotel is set beside the cost of missing the ship. */
export function flyEarlyAdvice(plan: JourneyPlan, departure: string, delayMinutes = 0): EarlyAdvice {
  const base = { hotelCostCents: HOTEL_NIGHT_COST_CENTS, missedCostCents: MISSED_SHIP_COST_CENTS }
  if (plan.mode !== 'fly') return { ...base, recommend: false, reason: 'notFlying' }
  if (plan.hotelNight) return { ...base, recommend: false, reason: 'staying' }
  const j = buildJourney(plan, departure, delayMinutes)
  if (j.slack < SLACK_TIGHT) return { ...base, recommend: true, reason: 'late' }
  if (j.slack < SLACK_COMFORT) return { ...base, recommend: true, reason: 'tight' }
  return { ...base, recommend: false, reason: plan.carryOnOnly ? 'carryOn' : 'early' }
}

/** The day to fly, one day before sailing. */
export const flyEarlyDate = (departure: string): string => addDays(departure, -1)

// ---- Flight watch (S4A-04), simulated ----

export const FLIGHT_SOURCE = 'sim' as const
export type FlightState = 'onTime' | 'delayed' | 'cancelled'
export interface FlightStatus { source: typeof FLIGHT_SOURCE; state: FlightState; delayMinutes: number }

export const validFlightNumber = (v: string): boolean => /^[A-Z]{2}\d{1,4}$/.test(normalizeFlight(v))
export const normalizeFlight = (v: string): string => v.replace(/\s+/g, '').toUpperCase()

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A stable status per flight and date: most are on time, some late, a few cancelled. Not a real feed. */
export function flightStatus(number: string, date: string): FlightStatus | null {
  const n = normalizeFlight(number)
  if (!validFlightNumber(n)) return null
  const h = hash(`${n}|${date}`) % 100
  if (h < 65) return { source: FLIGHT_SOURCE, state: 'onTime', delayMinutes: 0 }
  if (h < 96) return { source: FLIGHT_SOURCE, state: 'delayed', delayMinutes: [20, 35, 50, 75, 110, 160][h % 6] }
  return { source: FLIGHT_SOURCE, state: 'cancelled', delayMinutes: 0 }
}

/** The delay to push through the timeline: a cancelled flight is a severe one, so the timeline shows risk early. */
export const watchDelay = (s: FlightStatus | null): number => (!s ? 0 : s.state === 'cancelled' ? 480 : s.delayMinutes)

/** The new time to leave for the airport-side leg after a delay, in minutes later than planned. */
export const reviseLeave = (s: FlightStatus | null): number => (s && s.state === 'delayed' ? s.delayMinutes : 0)

// ---- Conditions along the route (S4A-12), simulated ----

export type Sky = 'clear' | 'cloudy' | 'rain' | 'storm'
export interface Conditions { source: typeof FLIGHT_SOURCE; traffic: Traffic; sky: Sky; leaveEarlierMinutes: number }

/** Traffic from how busy the guest's window is; the sky from a stable draw for the date. Suggests leaving earlier when either is poor. */
export function routeConditions(departure: string, windowStart: string | null): Conditions {
  const window = arrivalWindows(true).find((w) => w.start === windowStart)
  const traffic = trafficFor(window?.crowd ?? 'busy')
  const d = hash(`sky|${departure}`) % 10
  const sky: Sky = d < 5 ? 'clear' : d < 8 ? 'cloudy' : d < 9 ? 'rain' : 'storm'
  const extra = (traffic === 'heavy' ? 20 : traffic === 'moderate' ? 10 : 0) + (sky === 'storm' ? 25 : sky === 'rain' ? 10 : 0)
  return { source: FLIGHT_SOURCE, traffic, sky, leaveEarlierMinutes: extra }
}

// ---- Hotel handoff (S4A-11) ----

export interface HotelHandoff { leaveHotel: number; checkoutBy: number; luggageHoldNote: boolean }

/** When to leave the hotel: the road time and checkout before the start of the arrival window, with the heavier traffic margin added. */
export function hotelHandoff(plan: JourneyPlan, departure: string, extraMinutes = 0): HotelHandoff {
  const open = at(departure, plan.windowStart ?? EMBARK.terminalOpens)
  const road = plan.mode === 'fly' ? AIRPORT_TO_TERMINAL_MINUTES : Math.min(60, plan.roadMinutes)
  const leaveHotel = open - (road + extraMinutes) * MIN
  return { leaveHotel, checkoutBy: leaveHotel - HOTEL_CHECKOUT_MINUTES * MIN, luggageHoldNote: true }
}

// ---- Ground transport and driving (S4A-06, S4A-07), authored ----

export type GroundId = 'shuttle' | 'shared' | 'accessibleVan' | 'rideshare' | 'taxi'
export const GROUND: readonly { id: GroundId; stepFree: boolean; cost: string }[] = [
  { id: 'shuttle', stepFree: false, cost: 'Free to about $10 each' },
  { id: 'shared', stepFree: false, cost: 'About $15 to $25 each' },
  { id: 'accessibleVan', stepFree: true, cost: 'About $45 to $70 for the party' },
  { id: 'rideshare', stepFree: false, cost: 'About $25 to $45' },
  { id: 'taxi', stepFree: false, cost: 'About $30 to $50' },
]

export const PICKUP_NOTES = ['journey.pickup.drop', 'journey.pickup.pick', 'journey.pickup.offline'] as const satisfies readonly StringKey[]

export const DRIVE_STEPS = ['journey.drive.bags', 'journey.drive.park', 'journey.drive.fuel', 'journey.drive.directions'] as const satisfies readonly StringKey[]

/** Minutes until the start of the arrival window; negative once it has begun. */
export const minutesToWindow = (now: number, departure: string, windowStart: string | null): number =>
  Math.round((at(departure, windowStart ?? EMBARK.terminalOpens) - now) / MIN)

// ---- Packing split (S4A-10), bag photo log (S4A-09) ----

export const CHECKED_BAGS = ['clothes', 'toiletries', 'formal', 'shoes', 'gear'] as const
export type CheckedId = (typeof CHECKED_BAGS)[number]
export const CARRY_ON_ITEMS = ['documents', 'medication', 'swimwear', 'chargers', 'valuables', 'clothes'] as const
export type CarryItemId = (typeof CARRY_ON_ITEMS)[number]

export const MAX_BAGS = 8
export const MAX_BAG_LABEL = 40
export interface BagEntry { id: string; label: string; /** When the guest ticked "photographed". The picture stays in their phone's camera roll. */ photographedAt: number | null }

export interface JourneyState {
  plan: JourneyPlan
  carryOn: CarryItemId[]
  checked: CheckedId[]
  bags: BagEntry[]
}

export const EMPTY_JOURNEY_STATE: JourneyState = { plan: EMPTY_JOURNEY, carryOn: [], checked: [], bags: [] }

export const toggleIn = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

export function addBag(state: JourneyState, label: string, id: string): JourneyState {
  const clean = label.trim().slice(0, MAX_BAG_LABEL)
  if (!clean || state.bags.length >= MAX_BAGS) return state
  return { ...state, bags: [...state.bags, { id, label: clean, photographedAt: null }] }
}

export const markBagPhotographed = (state: JourneyState, id: string, at: number | null): JourneyState => ({ ...state, bags: state.bags.map((b) => (b.id === id ? { ...b, photographedAt: at } : b)) })
export const removeBag = (state: JourneyState, id: string): JourneyState => ({ ...state, bags: state.bags.filter((b) => b.id !== id) })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export function normalizePlan(raw: unknown): JourneyPlan {
  if (!isObj(raw)) return EMPTY_JOURNEY
  const d = EMPTY_JOURNEY
  return {
    mode: isTripMode(raw.mode) ? raw.mode : d.mode,
    flightNumber: typeof raw.flightNumber === 'string' ? normalizeFlight(raw.flightNumber).slice(0, 6) : '',
    landing: isTime(raw.landing) ? raw.landing : d.landing,
    carryOnOnly: raw.carryOnOnly === true,
    roadMinutes: typeof raw.roadMinutes === 'number' && raw.roadMinutes >= 10 && raw.roadMinutes <= 900 ? Math.round(raw.roadMinutes) : d.roadMinutes,
    hotelNight: raw.hotelNight === true,
    windowStart: isTime(raw.windowStart) ? raw.windowStart : null,
  }
}

export function normalizeJourney(raw: unknown): JourneyState {
  if (!isObj(raw)) return EMPTY_JOURNEY_STATE
  const pick = <T extends string>(v: unknown, all: readonly T[]): T[] => (Array.isArray(v) ? all.filter((a) => v.includes(a)) : [])
  return {
    plan: normalizePlan(raw.plan),
    carryOn: pick(raw.carryOn, CARRY_ON_ITEMS),
    checked: pick(raw.checked, CHECKED_BAGS),
    bags: (Array.isArray(raw.bags) ? raw.bags : []).flatMap((b): BagEntry[] =>
      isObj(b) && typeof b.id === 'string' && typeof b.label === 'string' && b.label.trim() ? [{ id: b.id, label: b.label.slice(0, MAX_BAG_LABEL), photographedAt: typeof b.photographedAt === 'number' ? b.photographedAt : null }] : []).slice(0, MAX_BAGS),
  }
}
