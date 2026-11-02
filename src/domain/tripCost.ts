import { computeEntitlements } from './entitlements'
import { excursionById } from './excursions'
import { bookingQuote, fareOptions, FARES, type FareId } from './fares'
import { addOnPrice } from './packages'
import { MAX_GUESTS, NIGHTS } from './pricing'
import { type Cents } from './money'
import type { CategoryId } from './ship'

/** The whole-trip cost calculator (DIS-12): the cruise, what the guest means to add, and what they spend getting there, for each fare. */
export const MAX_DINNERS = 6
export const MAX_OUTSIDE: Cents = 5_000_000
/** The specialty dining pass is three dinners. */
const PASS_DINNERS = 3

export interface TripCostInput {
  sailingId: string
  category: CategoryId
  guests: number
  /** Guests old enough for the drinks package. */
  adults: number
  daysToDeparture: number
  drinks: boolean
  wifi: boolean
  /** Specialty dinners wanted for each guest. */
  dinners: number
  excursionIds: readonly string[]
  /** What the guest spends outside the cruise, for the whole party. */
  flights: Cents
  hotel: Cents
  other: Cents
}

export type CostKey = 'cruise' | 'gratuities' | 'package' | 'drinks' | 'wifi' | 'dining' | 'excursions' | 'excursionCredit' | 'flights' | 'hotel' | 'other'

export interface CostLine { key: CostKey; cents: Cents }

export interface CostOption {
  fare: FareId
  lines: CostLine[]
  total: Cents
  perPerson: Cents
}

export interface TripCost {
  options: CostOption[]
  /** The fare with the lowest total (the first, if they tie). */
  cheapest: FareId
  /** What the cheapest option saves against paying for everything on top of the Standard fare; 0 when Standard is the cheapest or is not offered. */
  savingVsStandard: Cents
}

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, Number.isFinite(n) ? Math.trunc(n) : low))
const money = (c: Cents): Cents => clamp(c, 0, MAX_OUTSIDE)

/** The cost of the trip for each fare the room type offers, or null for an unknown sailing, room type or party size. */
export function tripCost(input: TripCostInput): TripCost | null {
  const guests = clamp(input.guests, 1, MAX_GUESTS)
  const adults = clamp(input.adults, 0, guests)
  const dinners = clamp(input.dinners, 0, MAX_DINNERS)
  const days = input.daysToDeparture
  const excursions = input.excursionIds.map((id) => excursionById(id)).filter((x) => !!x)
  const excursionTotal = excursions.reduce((sum, x) => sum + x.price, 0) * guests
  const dinnerPrice = Math.round(addOnPrice('specialtyPass', days) / PASS_DINNERS)

  const options: CostOption[] = []
  for (const fare of fareOptions(input.category)) {
    const quote = bookingQuote(input.sailingId, input.category, guests, fare)
    if (!quote) return null
    const e = computeEntitlements({ tier: 'none', package: fare === 'standard' ? 'none' : fare, sanctuary: false })
    const lines: CostLine[] = []
    const add = (key: CostKey, cents: Cents) => { if (cents !== 0) lines.push({ key, cents }) }
    add('cruise', quote.lines.filter((l) => l.key !== 'gratuities' && l.key !== 'package').reduce((sum, l) => sum + l.cents, 0))
    add('gratuities', quote.lines.filter((l) => l.key === 'gratuities').reduce((sum, l) => sum + l.cents, 0))
    add('package', quote.lines.filter((l) => l.key === 'package').reduce((sum, l) => sum + l.cents, 0))
    if (input.drinks && e.drinkCapUsd === 0) add('drinks', addOnPrice('drinks', days) * adults * NIGHTS)
    if (input.wifi && e.wifiDevices === 0) add('wifi', addOnPrice('wifi', days) * guests * NIGHTS)
    add('dining', Math.max(0, dinners - e.specialtyMeals) * guests * dinnerPrice)
    add('excursions', excursionTotal)
    add('excursionCredit', -Math.min(excursionTotal, e.excursionCreditUsd * 100 * guests))
    add('flights', money(input.flights))
    add('hotel', money(input.hotel))
    add('other', money(input.other))
    const total = lines.reduce((sum, l) => sum + l.cents, 0)
    options.push({ fare, lines, total, perPerson: Math.round(total / guests) })
  }
  if (options.length === 0) return null
  const best = options.reduce((a, b) => (b.total < a.total ? b : a))
  const standard = options.find((o) => o.fare === 'standard')
  return { options, cheapest: best.fare, savingVsStandard: standard ? standard.total - best.total : 0 }
}

/** The name of a fare for the comparison table. */
export const fareName = (fare: FareId): string => FARES[fare].name
