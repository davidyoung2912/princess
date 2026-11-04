import { CATEGORIES, categoryById, type CategoryId } from './ship'
import { SAILINGS, sailingById } from './sailings'
import { limit } from './limits'
import { sailingRooms, type Room } from './shipRooms'
import { sailingEntryOf } from './shipCatalogue'

import { formatMoney, parseMoney, type Cents } from './money'
import { MAX_GUESTS, type FromPrice, type LineKey, type Quote, type QuoteLine } from './priceShapes'
export { formatMoney, parseMoney, MAX_GUESTS, type Cents, type FromPrice, type LineKey, type Quote, type QuoteLine }

/** Interior fare per person for two sharing, by sailing (the open ones and the next season's). Filled from `GET /reference/pricing`; empty until then. */
export const INTERIOR_FARE: Record<string, Cents> = {}

/** Next-season departures that can be held but not yet booked (POS-06). Filled from the server. */
export const FUTURE_DEPARTURES: { id: string; departure: string }[] = []

export const NIGHTS = 7

/** Nights on a sailing: its catalogue length, or a week for a sailing the catalogue does not list. */
export const nightsOf = (sailingId: string): number => sailingEntryOf(sailingId)?.nights ?? NIGHTS

/** The room type as the server served it for this sailing (any ship), once the screen has loaded the sailing's rooms. */
const roomOf = (sailingId: string, category: CategoryId): Room | undefined => sailingRooms(sailingId)?.find((r) => r.id === category)

/** Whether a room type is a suite (pays the higher gratuity), by the served room when there is one. */
const suiteIn = (sailingId: string, category: CategoryId): boolean | undefined => {
  const room = roomOf(sailingId, category)
  if (room) return room.suite
  const cat = categoryById(category)
  return cat ? !!cat.suite : undefined
}

/** How many guests a room type sleeps on this sailing: the served room's count, or null when the room is not known here. */
export const roomCapacity = (sailingId: string, category: CategoryId): number | null => roomOf(sailingId, category)?.capacity ?? null
/** Government taxes, port charges and fees per person. Served; zero until the table arrives. */
export let TAXES_AND_FEES: Cents = 0
/** Discretionary onboard gratuity per person per night, by room type. Served. */
export let GRATUITY_PER_NIGHT: Cents = 0
export let GRATUITY_PER_NIGHT_SUITE: Cents = 0

/** Puts the served fare tables in use, in place so every importer sees them. */
export function replacePricing(p: { interior: Record<string, Cents>; nextSeason: { id: string; departure: string; fare: Cents }[]; taxesAndFees: Cents; gratuityPerNight: Cents; gratuityPerNightSuite: Cents }): void {
  for (const k of Object.keys(INTERIOR_FARE)) delete INTERIOR_FARE[k]
  Object.assign(INTERIOR_FARE, p.interior)
  FUTURE_DEPARTURES.length = 0
  for (const n of p.nextSeason) { INTERIOR_FARE[n.id] = n.fare; FUTURE_DEPARTURES.push({ id: n.id, departure: n.departure }) }
  TAXES_AND_FEES = p.taxesAndFees
  GRATUITY_PER_NIGHT = p.gratuityPerNight
  GRATUITY_PER_NIGHT_SUITE = p.gratuityPerNightSuite
}
/** The third and fourth guest in a stateroom pay this share of the fare. */
export let EXTRA_GUEST_SHARE = 0.75
/** One guest alone pays this multiple of the per-person fare. */
export let SOLO_MULTIPLE = 2





const round = (n: number): Cents => Math.round(n / 100) * 100

export const fareFor = (sailingId: string, category: CategoryId): Cents | null => {
  const served = roomOf(sailingId, category)?.fare
  if (served !== undefined) return served
  const base = INTERIOR_FARE[sailingId]
  const cat = categoryById(category)
  return base === undefined || !cat ? null : round(base * cat.ratio)
}

/** An all-in estimate for a sailing, room type and party size, or null for an unknown sailing, room type or party size. Every charge is a line, so no total hides anything. */
export function quote(sailingId: string, category: CategoryId, guests: number): Quote | null {
  const fare = fareFor(sailingId, category)
  const suite = suiteIn(sailingId, category)
  const nights = nightsOf(sailingId)
  if (fare === null || suite === undefined || !Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) return null
  const lines: QuoteLine[] = []
  const paying = Math.min(guests, 2)
  if (guests === 1) {
    lines.push({ key: 'fare', guests: 1, cents: fare })
    lines.push({ key: 'soloSupplement', guests: 1, cents: fare * (SOLO_MULTIPLE - 1) })
  } else {
    lines.push({ key: 'fare', guests: paying, cents: fare * paying })
    if (guests > 2) lines.push({ key: 'extraFare', guests: guests - 2, cents: Math.round(fare * EXTRA_GUEST_SHARE) * (guests - 2) })
  }
  const gratuities = (suite ? GRATUITY_PER_NIGHT_SUITE : GRATUITY_PER_NIGHT) * nights * guests
  lines.push({ key: 'taxes', guests, cents: TAXES_AND_FEES * guests })
  lines.push({ key: 'gratuities', guests, cents: gratuities })
  const total = lines.reduce((sum, l) => sum + l.cents, 0)
  return { sailingId, category, guests, lines, total, perPerson: Math.round(total / guests), gratuities }
}


/** The lowest fare for a sailing, with what is added on top, for a one-person-of-two "from" price. */
export function fromPrice(sailingId: string): FromPrice | null {
  const q = quote(sailingId, 'interior', 2)
  const fare = fareFor(sailingId, 'interior')
  if (!q || fare === null) return null
  return { fare, taxes: TAXES_AND_FEES, gratuities: GRATUITY_PER_NIGHT * nightsOf(sailingId), allIn: q.perPerson }
}

/** The lowest "from" fare over every sailing. */
export function lowestFromPrice(): FromPrice | null {
  const all = SAILINGS.map((s) => fromPrice(s.id)).filter((f): f is FromPrice => f !== null)
  return all.length === 0 ? null : all.reduce((a, b) => (b.fare < a.fare ? b : a))
}

export const hasPrice = (sailingId: string): boolean => !!sailingById(sailingId) && INTERIOR_FARE[sailingId] !== undefined

export const ALL_CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id)



// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('EXTRA_GUEST_SHARE', (v) => { EXTRA_GUEST_SHARE = v }, EXTRA_GUEST_SHARE)
limit('SOLO_MULTIPLE', (v) => { SOLO_MULTIPLE = v }, SOLO_MULTIPLE)
