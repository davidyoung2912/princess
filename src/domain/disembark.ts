import { GRATUITY_PER_NIGHT, GRATUITY_PER_NIGHT_SUITE, type Cents } from './pricing'
import { itinerary, shipZoneOnDate, type Sailing } from './sailings'
import { zonedToEpoch } from './timezones'

/**
 * Disembarkation (DEB-01 to DEB-07): how to get off, luggage tags, customs, onward travel, the final night and the
 * final bill. Times, groups and amounts are authored concept values (verify before real use).
 */
const MIN = 60_000
const PORT_ZONE = 'America/New_York'

export type WalkOffId = 'tagged' | 'selfAssist' | 'earlyWalkOff'
export const WALKOFF_IDS: readonly WalkOffId[] = ['tagged', 'selfAssist', 'earlyWalkOff']

export type TagColor = 'gold' | 'blue' | 'green' | 'orange' | 'red' | 'purple'
export interface TagGroup { color: TagColor; number: number; /** Local time on the last morning, "HH:MM". */ time: string }

/** Luggage-tag groups in the order they are called. Gold is for priority guests; the rest are shared out by a steady pick. */
export const TAG_GROUPS: readonly TagGroup[] = [
  { color: 'gold', number: 1, time: '07:00' },
  { color: 'blue', number: 2, time: '07:30' },
  { color: 'green', number: 3, time: '08:00' },
  { color: 'orange', number: 4, time: '08:30' },
  { color: 'red', number: 5, time: '09:00' },
  { color: 'purple', number: 6, time: '09:30' },
]

/** Carrying your own bags: from this time, and from the earliest time for an early walk-off. */
export const SELF_ASSIST_FROM = '07:30'
export const EARLY_FROM = '06:30'
/** Walking from the gangway through customs and out to the curb. */
export const CLEARANCE_MINUTES = 45
/** Most bags one guest can carry off themselves. */
export const MAX_CARRY_BAGS = 2
export const MAX_BAGS = 6

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** The tag group for a booking: Gold 1 for priority disembarkation, otherwise a steady pick from the others. */
export function groupFor(booking: string, priority: boolean): TagGroup {
  return priority ? TAG_GROUPS[0] : TAG_GROUPS[1 + (hash(booking) % (TAG_GROUPS.length - 1))]
}

export interface DisembarkTimes {
  /** The ship ties up. */
  arrivalAt: number
  /** Last time to choose how to get off, and to put tagged bags outside the stateroom. */
  bagsOutAt: number
  /** Last time to change the daily gratuity. */
  tipBy: number
  /** Staterooms must be empty. */
  vacateAt: number
  /** The last morning, "YYYY-MM-DD". */
  date: string
}

export function disembarkTimes(s: Sailing): DisembarkTimes {
  const days = itinerary(s)
  const last = days[days.length - 1]
  const eve = days[days.length - 2]
  const evening = (time: string) => zonedToEpoch(eve.date, time, shipZoneOnDate(s, eve.date))
  return {
    arrivalAt: zonedToEpoch(last.date, last.arrive ?? '06:00', PORT_ZONE),
    bagsOutAt: evening('22:00'),
    tipBy: evening('20:00'),
    vacateAt: zonedToEpoch(last.date, '08:30', PORT_ZONE),
    date: last.date,
  }
}

const onLastMorning = (s: Sailing, time: string): number => zonedToEpoch(itinerary(s)[7].date, time, PORT_ZONE)

/** When a guest can leave the ship with a choice. Tagged guests go when their group is called. */
export function offAt(s: Sailing, option: WalkOffId, group: TagGroup): number {
  return onLastMorning(s, option === 'tagged' ? group.time : option === 'selfAssist' ? SELF_ASSIST_FROM : EARLY_FROM)
}

export interface ChoiceInput { option: WalkOffId; bags: Record<string, number>; guests: readonly string[] }

/** What is wrong with a choice, as a short code the screen explains, or null. */
export function choiceProblem(c: ChoiceInput): string | null {
  if (!WALKOFF_IDS.includes(c.option)) return 'badOption'
  let total = 0
  for (const id of c.guests) {
    const n = c.bags[id]
    if (!Number.isInteger(n) || n < 0 || n > MAX_BAGS) return 'badBags'
    if (c.option !== 'tagged' && n > MAX_CARRY_BAGS) return 'tooManyToCarry'
    total += n
  }
  if (Object.keys(c.bags).some((id) => !c.guests.includes(id))) return 'badBags'
  if (c.option === 'tagged' && total === 0) return 'noBags'
  return null
}

/** The label printed on a luggage tag. */
export const tagLabel = (g: TagGroup, printed: string, cabin: string): string => `${g.color.toUpperCase()} ${g.number} · ${printed} · ${cabin}`

// ---- Customs and immigration (DEB-04) ----

export interface CustomsDeclaration { food: boolean; cash: boolean; goodsUsd: number; note: string }

/** Duty-free goods each person may bring in, and the cash amount above which a report is needed. */
export const ALLOWANCE_USD = 800
export const CASH_LIMIT_USD = 10_000
export const GOODS_MAX = 100_000
export const CUSTOMS_NOTE_MAX = 200

export const blankCustoms = (): CustomsDeclaration => ({ food: false, cash: false, goodsUsd: 0, note: '' })

export function customsProblem(d: CustomsDeclaration): string | null {
  if (typeof d.food !== 'boolean' || typeof d.cash !== 'boolean') return 'badAnswer'
  if (!Number.isInteger(d.goodsUsd) || d.goodsUsd < 0 || d.goodsUsd > GOODS_MAX) return 'badGoods'
  if (typeof d.note !== 'string' || d.note.length > CUSTOMS_NOTE_MAX) return 'badNote'
  return null
}

export type DeclareItem = 'food' | 'cash' | 'goods'

/** What must be declared to the officer, and how far the goods are over the family's allowance. */
export function customsSummary(d: CustomsDeclaration, people: number): { declare: DeclareItem[]; overUsd: number; allowanceUsd: number } {
  const allowanceUsd = ALLOWANCE_USD * people
  const overUsd = Math.max(0, d.goodsUsd - allowanceUsd)
  const declare: DeclareItem[] = []
  if (d.food) declare.push('food')
  if (d.cash) declare.push('cash')
  if (overUsd > 0) declare.push('goods')
  return { declare, overUsd, allowanceUsd }
}

export const CUSTOMS_CARRY: readonly string[] = ['passport', 'pass', 'declaration', 'residency']
export const CUSTOMS_DECLARE: readonly string[] = ['food', 'plants', 'cash', 'goods', 'alcohol']

// ---- Onward travel (DEB-05) ----

export type OnwardMode = 'airportTransfer' | 'rideshare' | 'hotelShuttle' | 'parking'

export interface OnwardModeDef { id: OnwardMode; /** From the curb to the destination. */ minutes: number; /** A guide cost per person, or per car for ride-share; 0 is free or paid separately. */ cents: Cents; perCar: boolean }

export const ONWARD_MODES: readonly OnwardModeDef[] = [
  { id: 'airportTransfer', minutes: 25, cents: 2600, perCar: false },
  { id: 'rideshare', minutes: 15, cents: 3000, perCar: true },
  { id: 'hotelShuttle', minutes: 30, cents: 0, perCar: false },
  { id: 'parking', minutes: 10, cents: 0, perCar: false },
]

export const onwardMode = (id: unknown): OnwardModeDef | undefined => ONWARD_MODES.find((m) => m.id === id)

export interface OnwardPlan { mode: OnwardMode; /** Flight time on the last day, "HH:MM", or empty for no flight. */ flightAt: string; flight: string; note: string }

export const ONWARD_NOTE_MAX = 200
/** Be at the airport this long before a flight. */
export const AIRPORT_MINUTES = 180
export const TIGHT_MINUTES = 45

export function onwardProblem(p: OnwardPlan): string | null {
  if (!onwardMode(p.mode)) return 'badMode'
  if (typeof p.flightAt !== 'string' || (p.flightAt !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.flightAt))) return 'badFlightTime'
  if (typeof p.flight !== 'string' || p.flight.length > 8 || !/^[A-Za-z0-9 ]*$/.test(p.flight)) return 'badFlight'
  if (typeof p.note !== 'string' || p.note.length > ONWARD_NOTE_MAX) return 'badNote'
  return null
}

export type OnwardStatus = 'ok' | 'tight' | 'tooEarly' | 'noFlight'

export interface OnwardCheck { status: OnwardStatus; /** When the guest must be on their way to the airport. */ leaveBy: number | null; /** Minutes to spare after leaving the ship at the chosen time (negative: not enough). */ spare: number | null; /** The earliest flight that works, "HH:MM". */ earliestFlight: string }

const hhmm = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Whether a flight can be made from when the guest leaves the ship: off the ship, through customs, the ride, then three hours before the flight. */
export function onwardCheck(s: Sailing, plan: OnwardPlan, offFrom: number): OnwardCheck {
  const mode = onwardMode(plan.mode)!
  const ready = offFrom + (CLEARANCE_MINUTES + mode.minutes) * MIN
  const base = onLastMorning(s, '00:00')
  const earliestMin = Math.ceil((ready - base) / MIN / 15) * 15 + AIRPORT_MINUTES
  const earliestFlight = earliestMin >= 24 * 60 ? '23:59' : hhmm(earliestMin)
  if (!plan.flightAt) return { status: 'noFlight', leaveBy: null, spare: null, earliestFlight }
  const [h, m] = plan.flightAt.split(':').map(Number)
  const flightAt = base + (h * 60 + m) * MIN
  const spare = Math.round((flightAt - AIRPORT_MINUTES * MIN - ready) / MIN)
  const leaveBy = flightAt - (AIRPORT_MINUTES + mode.minutes) * MIN
  return { status: spare < 0 ? 'tooEarly' : spare < TIGHT_MINUTES ? 'tight' : 'ok', leaveBy, spare, earliestFlight }
}

// ---- The final night (DEB-07) ----

export type NightAuto = 'option' | 'customs' | 'tags'

export interface NightItem {
  id: string
  /** 7 for the last evening, 8 for the last morning. */
  day: 7 | 8
  time: string
  auto: NightAuto | null
  to: string | null
  /** Only for guests whose bags go out with tags. */
  taggedOnly?: boolean
}

export const NIGHT_ITEMS: readonly NightItem[] = [
  { id: 'bill', day: 7, time: '20:00', auto: null, to: '/me/bill/final' },
  { id: 'choose', day: 7, time: '22:00', auto: 'option', to: '/home/disembark' },
  { id: 'customs', day: 7, time: '22:00', auto: 'customs', to: '/home/disembark/customs' },
  { id: 'tags', day: 7, time: '22:00', auto: 'tags', to: '/home/disembark', taggedOnly: true },
  { id: 'bagsOut', day: 7, time: '22:00', auto: null, to: null, taggedOnly: true },
  { id: 'carryOn', day: 7, time: '22:00', auto: null, to: null },
  { id: 'valuables', day: 7, time: '22:00', auto: null, to: null },
  { id: 'charge', day: 7, time: '22:00', auto: null, to: null },
  { id: 'documents', day: 8, time: '06:00', auto: null, to: null },
]

export const isNightItem = (id: unknown): id is string => NIGHT_ITEMS.some((i) => i.id === id)

export type NightState = 'done' | 'overdue' | 'dueSoon' | 'upcoming'
export const DUE_SOON_MINUTES = 120

export interface NightEntry extends NightItem { dueAt: number; state: NightState; automatic: boolean }

export interface NightInput { sailing: Sailing; now: number; option: WalkOffId | null; customsDone: boolean; tagsOn: boolean; ticked: readonly string[] }

export function nightEntries(i: NightInput): NightEntry[] {
  const days = itinerary(i.sailing)
  return NIGHT_ITEMS.filter((item) => !item.taggedOnly || i.option === null || i.option === 'tagged').map((item) => {
    const date = days[item.day - 1].date
    const dueAt = zonedToEpoch(date, item.time, item.day === 8 ? PORT_ZONE : shipZoneOnDate(i.sailing, date))
    const automatic = item.auto === 'option' ? i.option !== null : item.auto === 'customs' ? i.customsDone : item.auto === 'tags' ? i.tagsOn : false
    const done = automatic || i.ticked.includes(item.id)
    const state: NightState = done ? 'done' : i.now > dueAt ? 'overdue' : dueAt - i.now <= DUE_SOON_MINUTES * MIN ? 'dueSoon' : 'upcoming'
    return { ...item, dueAt, state, automatic }
  })
}

/** The first thing still to do, soonest first. */
export const nextNightItem = (entries: readonly NightEntry[]): NightEntry | null => entries.filter((e) => e.state !== 'done').sort((a, b) => a.dueAt - b.dueAt)[0] ?? null

// ---- The final bill (DEB-03) ----

/** Shares of the daily gratuity a guest can keep. */
export const TIP_KEEP: readonly number[] = [100, 75, 50, 0]

export interface GratuityGuest { suite: boolean; included: boolean }

/** What the daily gratuity comes to for a booking, for the seven nights; nothing for a guest whose package includes it. */
export const gratuityCharged = (guests: readonly GratuityGuest[], nights = 7): Cents =>
  guests.reduce((n, g) => n + (g.included ? 0 : (g.suite ? GRATUITY_PER_NIGHT_SUITE : GRATUITY_PER_NIGHT) * nights), 0)

/** The credit for keeping only part of the gratuity. */
export const tipCredit = (charged: Cents, keepPercent: number): Cents => Math.round((charged * (100 - keepPercent)) / 100)

export const RECEIPT_IDS = ['folio', 'gratuities', 'fare'] as const
export type ReceiptId = (typeof RECEIPT_IDS)[number]
