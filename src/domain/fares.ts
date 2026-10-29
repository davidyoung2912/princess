import { computeEntitlements } from './entitlements'
import { NIGHTS, quote, type Cents, type Quote } from './pricing'
import { categoryById, type CategoryId } from './ship'
import { DEFAULT_FINAL_PAYMENT_DAYS, DEPOSIT_SHARE } from './trip'
import { addDays } from './timezones'

/** What a fare includes (BOK-04). Prices are authored concept values; what each includes comes from the entitlement engine, so the two cannot disagree. */
export type FareId = 'standard' | 'plus' | 'premier'
export const FARE_IDS: readonly FareId[] = ['standard', 'plus', 'premier']

export interface Fare {
  id: FareId
  name: string
  /** Added to the fare for each guest for each night. */
  perNight: Cents
  tagline: string
}

export const FARES: Record<FareId, Fare> = {
  standard: { id: 'standard', name: 'Standard', perNight: 0, tagline: 'Just the cruise. Add drinks, Wi-Fi and dining later.' },
  plus: { id: 'plus', name: 'Princess Plus', perNight: 6000, tagline: 'Drinks, Wi-Fi, two specialty dinners and gratuities.' },
  premier: { id: 'premier', name: 'Princess Premier', perNight: 9000, tagline: 'More of everything, with an excursion credit.' },
}

export const isFareId = (v: unknown): v is FareId => FARE_IDS.includes(v as FareId)

/** The Sanctuary Mini-Suite and Signature Suite include the Premier package in their fare. */
const PREMIER_INCLUDED: readonly CategoryId[] = ['sanctuaryMiniSuite', 'signatureSuite']

export const fareIncluded = (category: CategoryId): FareId | null => (PREMIER_INCLUDED.includes(category) ? 'premier' : null)

/** The fares a room type can be booked with. */
export const fareOptions = (category: CategoryId): readonly FareId[] => (fareIncluded(category) ? ['premier'] : FARE_IDS)

/** Plain-language list of what a fare includes. */
export function fareIncludes(id: FareId): string[] {
  const e = computeEntitlements({ tier: 'none', package: id === 'standard' ? 'none' : id, sanctuary: false })
  if (id === 'standard') return ['Your stateroom, main dining rooms, buffet and room service', 'Shows, activities and kids’ clubs', 'Gratuities, taxes and fees are added to the price']
  const list = [
    `Drinks up to $${e.drinkCapUsd} each`,
    `Wi-Fi for ${e.wifiDevices} ${e.wifiDevices === 1 ? 'device' : 'devices'} per guest`,
    `${e.specialtyMeals} specialty ${e.specialtyMeals === 1 ? 'dinner' : 'dinners'} per guest`,
    'Gratuities included',
  ]
  if (e.excursionCreditUsd > 0) list.push(`$${e.excursionCreditUsd} shore excursion credit per guest`)
  return list
}

/** Rooms hold at most four guests, a Signature Suite three. */
export const capacityOf = (category: CategoryId): number => (category === 'signatureSuite' ? 3 : 4)

export interface BookingQuote extends Quote {
  fare: FareId
}

/** The all-in price with a fare: the Discover estimate, with the package added and the gratuities line replaced when the package covers them. Null for anything not bookable. */
export function bookingQuote(sailingId: string, category: CategoryId, guests: number, fare: FareId): BookingQuote | null {
  const base = quote(sailingId, category, guests)
  if (!base || guests > capacityOf(category) || !fareOptions(category).includes(fare)) return null
  if (fare === 'standard') return { ...base, fare }
  const included = fareIncluded(category) !== null
  const lines = base.lines.filter((l) => l.key !== 'gratuities')
  lines.push({ key: 'package', guests, cents: included ? 0 : FARES[fare].perNight * NIGHTS * guests })
  const total = lines.reduce((sum, l) => sum + l.cents, 0)
  return { ...base, fare, lines, total, perPerson: Math.round(total / guests), gratuities: 0 }
}

export interface Promotion {
  id: 'earlyCredit'
  /** Onboard credit, which arrives on the onboard account and is not taken off the price. */
  creditCents: Cents
}

export const EARLY_CREDIT_DAYS = 120

export function promotionsFor(category: CategoryId, daysToDeparture: number): Promotion[] {
  if (daysToDeparture < EARLY_CREDIT_DAYS) return []
  return [{ id: 'earlyCredit', creditCents: categoryById(category)?.suite ? 30_000 : 15_000 }]
}

/** How long a quoted price is held while someone finishes booking. */
export const PRICE_LOCK_HOURS = 24

/** A sailing can be booked until the day before it leaves. */
export const bookable = (daysToDeparture: number): boolean => daysToDeparture >= 1

export type PayOption = 'deposit' | 'full'

export interface PayPlan {
  options: PayOption[]
  total: Cents
  deposit: Cents
  /** "YYYY-MM-DD". */
  finalDue: string
}

/** Deposit or pay in full, until the final payment date; inside it, the whole fare is due at booking. */
export function payPlan(total: Cents, departure: string, daysToDeparture: number, finalDays: number = DEFAULT_FINAL_PAYMENT_DAYS): PayPlan {
  const deposit = Math.min(total, Math.round((total * DEPOSIT_SHARE) / 100) * 100)
  return { options: daysToDeparture > finalDays ? ['deposit', 'full'] : ['full'], total, deposit, finalDue: addDays(departure, -finalDays) }
}

export const dueNow = (plan: PayPlan, option: PayOption): Cents => (option === 'full' ? plan.total : plan.deposit)

/** How each part of a payment is made. A device wallet needs no card on file. */
export type PaymentPart = { method: 'card'; cardId: string; cents: Cents } | { method: 'wallet'; cents: Cents }

export type PartsProblem = 'empty' | 'tooMany' | 'amount' | 'sum' | 'duplicate'
export const MAX_PARTS = 2

/** Whether the parts of a payment make up exactly what is due: one or two methods, each a positive whole-dollar-or-cent amount, no card twice. */
export function checkParts(parts: readonly PaymentPart[], due: Cents): PartsProblem | null {
  if (parts.length === 0) return 'empty'
  if (parts.length > MAX_PARTS) return 'tooMany'
  if (parts.some((p) => !Number.isInteger(p.cents) || p.cents <= 0)) return 'amount'
  const keys = parts.map((p) => (p.method === 'card' ? p.cardId : 'wallet'))
  if (new Set(keys).size !== keys.length) return 'duplicate'
  return parts.reduce((sum, p) => sum + p.cents, 0) === due ? null : 'sum'
}

/** The card the demo person already has on file, which banks trust. */
export const DEFAULT_CARD_ID = 'card-default'
/** Strong customer authentication (3-D Secure): asked for a new card, or for any card payment of $3,000 or more. */
export const SCA_LIMIT: Cents = 300_000
export const SCA_DEMO_CODE = '123456'
/** A card ending in these digits is declined by the pretend bank. */
export const DECLINED_LAST4 = '0002'

export const scaRequired = (part: PaymentPart): boolean => part.method === 'card' && (part.cardId !== DEFAULT_CARD_ID || part.cents >= SCA_LIMIT)

/** Whether a device offers the Payment Request API, which Apple Pay and Google Pay use. */
export const walletSupported = (win: { PaymentRequest?: unknown } | undefined): boolean => !!win && typeof win.PaymentRequest === 'function'
