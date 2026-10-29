import { CATEGORIES, categoryById, type CategoryId } from './ship'
import { SAILINGS, sailingById } from './sailings'

/** Money is whole cents. */
export type Cents = number

/** Interior fare per person for two sharing, by sailing. The lowest is the advertised "from" price (ship profile §11.1). */
const INTERIOR_FARE: Record<string, Cents> = {
  'sun-2026-11-08': 153_900,
  'sun-2026-11-22': 157_900,
  'sun-2026-12-06': 155_900,
  'sun-2026-12-27': 239_900,
  'sun-2027-01-17': 174_900,
  'sun-2027-02-07': 199_900,
  'sun-2027-02-28': 214_900,
  'sun-2027-03-21': 189_900,
}

export const NIGHTS = 7
/** Government taxes, port charges and fees per person (illustrative). */
export const TAXES_AND_FEES: Cents = 23_600
/** Discretionary onboard gratuity per person per night, by room type. */
export const GRATUITY_PER_NIGHT: Cents = 1650
export const GRATUITY_PER_NIGHT_SUITE: Cents = 1850
/** The third and fourth guest in a stateroom pay this share of the fare. */
export const EXTRA_GUEST_SHARE = 0.75
/** One guest alone pays this multiple of the per-person fare. */
export const SOLO_MULTIPLE = 2

export const MAX_GUESTS = 4

export type LineKey = 'fare' | 'extraFare' | 'soloSupplement' | 'taxes' | 'gratuities'

export interface QuoteLine {
  key: LineKey
  /** The number of guests the line covers. */
  guests: number
  /** Amount for the whole line. */
  cents: Cents
}

export interface Quote {
  sailingId: string
  category: CategoryId
  guests: number
  lines: QuoteLine[]
  total: Cents
  perPerson: Cents
  /** Part of the total paid on board, as gratuities (still shown in the total so nothing is hidden). */
  gratuities: Cents
}

const round = (n: number): Cents => Math.round(n / 100) * 100

export const fareFor = (sailingId: string, category: CategoryId): Cents | null => {
  const base = INTERIOR_FARE[sailingId]
  const cat = categoryById(category)
  return base === undefined || !cat ? null : round(base * cat.ratio)
}

/** An all-in estimate for a sailing, room type and party size, or null for an unknown sailing, room type or party size. Every charge is a line, so no total hides anything. */
export function quote(sailingId: string, category: CategoryId, guests: number): Quote | null {
  const fare = fareFor(sailingId, category)
  const cat = categoryById(category)
  if (fare === null || !cat || !Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) return null
  const lines: QuoteLine[] = []
  const paying = Math.min(guests, 2)
  if (guests === 1) {
    lines.push({ key: 'fare', guests: 1, cents: fare })
    lines.push({ key: 'soloSupplement', guests: 1, cents: fare * (SOLO_MULTIPLE - 1) })
  } else {
    lines.push({ key: 'fare', guests: paying, cents: fare * paying })
    if (guests > 2) lines.push({ key: 'extraFare', guests: guests - 2, cents: Math.round(fare * EXTRA_GUEST_SHARE) * (guests - 2) })
  }
  const gratuities = (cat.suite ? GRATUITY_PER_NIGHT_SUITE : GRATUITY_PER_NIGHT) * NIGHTS * guests
  lines.push({ key: 'taxes', guests, cents: TAXES_AND_FEES * guests })
  lines.push({ key: 'gratuities', guests, cents: gratuities })
  const total = lines.reduce((sum, l) => sum + l.cents, 0)
  return { sailingId, category, guests, lines, total, perPerson: Math.round(total / guests), gratuities }
}

export interface FromPrice {
  fare: Cents
  taxes: Cents
  gratuities: Cents
  /** Fare, taxes and fees, and gratuities for one guest of two. */
  allIn: Cents
}

/** The lowest fare for a sailing, with what is added on top, for a one-person-of-two "from" price. */
export function fromPrice(sailingId: string): FromPrice | null {
  const q = quote(sailingId, 'interior', 2)
  const fare = fareFor(sailingId, 'interior')
  if (!q || fare === null) return null
  return { fare, taxes: TAXES_AND_FEES, gratuities: GRATUITY_PER_NIGHT * NIGHTS, allIn: q.perPerson }
}

/** The lowest "from" fare over every sailing. */
export function lowestFromPrice(): FromPrice {
  return SAILINGS.map((s) => fromPrice(s.id)!).reduce((a, b) => (b.fare < a.fare ? b : a))
}

export const hasPrice = (sailingId: string): boolean => !!sailingById(sailingId) && INTERIOR_FARE[sailingId] !== undefined

export const ALL_CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id)

/** "$1,539" for whole dollars, "$115.50" otherwise. */
export function formatMoney(cents: Cents): string {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100)
}
