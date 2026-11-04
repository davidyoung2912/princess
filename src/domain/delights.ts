import { offsetMinutes } from './timezones'

/**
 * Small delights, phase DL1 (docs/small-delights.md): pure helpers with no storage and no server. Wording lives in `en.ts`; the functions here
 * return facts and keys so they can be tested in a node environment. Port tipping norms are authored concept samples: check before real use.
 */

// ---------------------------------------------------------------- D2-1, D2-2: names as printed, and gentle name checks

const clean = (s: string): string => s.trim().replace(/\s+/g, ' ')

/** The name as it is usually printed on a travel document and ticket: LAST/FIRST in capitals. Empty when both parts are empty. */
export function ticketName(first: string, last: string): string {
  const f = clean(first).toUpperCase()
  const l = clean(last).toUpperCase()
  if (!f && !l) return ''
  return l && f ? `${l}/${f}` : l || f
}

export type NameWarning = 'bothInOne' | 'title' | 'digits' | 'quotes' | 'initial' | 'maybeSwapped'

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'sir', 'lady', 'prof'])
/** A short list of very common given names, used only to suggest that two fields may be the wrong way round. */
const COMMON_GIVEN = new Set(
  'james john robert michael william david richard thomas mary patricia jennifer linda elizabeth susan sarah karen nancy daniel paul mark george anna maria emma peter'.split(' '),
)

/** Reasons the typed names may not match a passport. Always a hint, never a block: real names can be unusual. */
export function nameWarnings(first: string, last: string): NameWarning[] {
  const f = clean(first)
  const l = clean(last)
  const out: NameWarning[] = []
  if (f && !l && f.includes(' ')) out.push('bothInOne')
  const lead = f.split(' ')[0]?.replace(/\.$/, '').toLowerCase()
  if (lead && TITLES.has(lead) && f.includes(' ')) out.push('title')
  if (/\d/.test(f + l)) out.push('digits')
  if (/["“”()]/.test(f + l)) out.push('quotes')
  if ((f.length === 1 || l.length === 1) && f && l) out.push('initial')
  if (f && l && COMMON_GIVEN.has(l.toLowerCase()) && !COMMON_GIVEN.has(f.toLowerCase())) out.push('maybeSwapped')
  return out
}

// ---------------------------------------------------------------- D2-3: a booking number that is easy to read aloud

/** The booking number in groups of four for reading and the same characters spaced for a screen reader. */
export function groupBookingNumber(n: string): { display: string; spoken: string; raw: string } {
  const raw = n.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const groups = raw.match(/.{1,4}/g) ?? []
  return { display: groups.join(' '), spoken: raw.split('').join(' '), raw }
}

// ---------------------------------------------------------------- D1-1: the ship in familiar terms

const PITCH_FEET = 360

/** Parses "1,133 ft" (or a number) into feet; 0 when unreadable. */
export const feetOf = (length: string | number): number => (typeof length === 'number' ? length : Number(length.replace(/[^0-9.]/g, '')) || 0)

/** Football pitches (goal line to goal line) and a town of everyone aboard, rounded so the figure reads as approximate. */
export function shipInFamiliarTerms(length: string | number, guests: number, crew: number): { pitches: number; town: number } {
  const feet = feetOf(length)
  return {
    pitches: feet > 0 ? Math.max(1, Math.round(feet / PITCH_FEET)) : 0,
    town: Math.max(0, Math.round((guests + crew) / 100) * 100),
  }
}

// ---------------------------------------------------------------- D1-3: per person per night

export type PriceUnit = 'total' | 'person' | 'personNight'
export const PRICE_UNITS: readonly PriceUnit[] = ['total', 'person', 'personNight']

/** A trip total expressed per party, per person or per person per night; the total itself when the party or nights are not known. */
export function pricePer(total: number, guests: number, nights: number, unit: PriceUnit): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  const g = Math.max(1, Math.floor(guests))
  const n = Math.max(1, Math.floor(nights))
  if (unit === 'total') return total
  if (unit === 'person') return Math.round(total / g)
  return Math.round(total / (g * n))
}

// ---------------------------------------------------------------- D6A-5: tipping norms by country

export interface TippingNorm {
  country: string
  /** Is a service charge usually already on the bill? */
  serviceIncluded: 'usually' | 'sometimes' | 'rarely'
  /** Typical restaurant tip, in percent of the bill, when none is included. */
  restaurantPercent: number
  /** Dollars to round a taxi up to, as a plain habit. */
  taxi: 'roundUp' | 'tenPercent' | 'notExpected'
  /** Dollars are widely taken. */
  dollarsAccepted: boolean
}

export const TIPPING_NORMS: Record<string, TippingNorm> = {
  cozumel: { country: 'Mexico', serviceIncluded: 'rarely', restaurantPercent: 15, taxi: 'roundUp', dollarsAccepted: true },
  belize: { country: 'Belize', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: true },
  roatan: { country: 'Honduras', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: true },
  'celebration-key': { country: 'Bahamas', serviceIncluded: 'sometimes', restaurantPercent: 15, taxi: 'tenPercent', dollarsAccepted: true },
  'grand-turk': { country: 'Turks and Caicos', serviceIncluded: 'rarely', restaurantPercent: 15, taxi: 'tenPercent', dollarsAccepted: true },
  'san-juan': { country: 'Puerto Rico', serviceIncluded: 'rarely', restaurantPercent: 18, taxi: 'tenPercent', dollarsAccepted: true },
  'amber-cove': { country: 'Dominican Republic', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: true },
  'southampton': { country: 'the United Kingdom', serviceIncluded: 'usually', restaurantPercent: 12.5, taxi: 'notExpected', dollarsAccepted: false },
  'barcelona': { country: 'Spain', serviceIncluded: 'sometimes', restaurantPercent: 7, taxi: 'roundUp', dollarsAccepted: false },
  'palma': { country: 'Spain', serviceIncluded: 'sometimes', restaurantPercent: 7, taxi: 'roundUp', dollarsAccepted: false },
  'marseille': { country: 'France', serviceIncluded: 'usually', restaurantPercent: 5, taxi: 'notExpected', dollarsAccepted: false },
  'genoa': { country: 'Italy', serviceIncluded: 'usually', restaurantPercent: 5, taxi: 'roundUp', dollarsAccepted: false },
  'la-spezia': { country: 'Italy', serviceIncluded: 'usually', restaurantPercent: 5, taxi: 'roundUp', dollarsAccepted: false },
  'civitavecchia': { country: 'Italy', serviceIncluded: 'usually', restaurantPercent: 5, taxi: 'roundUp', dollarsAccepted: false },
  'naples': { country: 'Italy', serviceIncluded: 'usually', restaurantPercent: 5, taxi: 'roundUp', dollarsAccepted: false },
  'athens': { country: 'Greece', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: false },
  'santorini': { country: 'Greece', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: false },
  'mykonos': { country: 'Greece', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: false },
  'kusadasi': { country: 'Turkey', serviceIncluded: 'sometimes', restaurantPercent: 10, taxi: 'roundUp', dollarsAccepted: true },
  'copenhagen': { country: 'Denmark', serviceIncluded: 'usually', restaurantPercent: 0, taxi: 'notExpected', dollarsAccepted: false },
  'tokyo': { country: 'Japan', serviceIncluded: 'usually', restaurantPercent: 0, taxi: 'notExpected', dollarsAccepted: false },
  'hakodate': { country: 'Japan', serviceIncluded: 'usually', restaurantPercent: 0, taxi: 'notExpected', dollarsAccepted: false },
  'singapore': { country: 'Singapore', serviceIncluded: 'usually', restaurantPercent: 0, taxi: 'notExpected', dollarsAccepted: false },
  'sydney': { country: 'Australia', serviceIncluded: 'sometimes', restaurantPercent: 0, taxi: 'notExpected', dollarsAccepted: false },
}

export const tippingNorm = (port: string): TippingNorm | undefined => (Object.prototype.hasOwnProperty.call(TIPPING_NORMS, port) ? TIPPING_NORMS[port] : undefined)

// ---------------------------------------------------------------- D3-7: an out-of-office message

export type OooTone = 'friendly' | 'formal' | 'brief'
export const OOO_TONES: readonly OooTone[] = ['friendly', 'formal', 'brief']

/** The out-of-office text: `templates` supplies the wording for each tone (from `en.ts`), with {name} and {date} filled in. A missing date drops the sentence that needs it. */
export function outOfOffice(templates: Record<OooTone, string>, tone: OooTone, name: string, backOn: string): string {
  const n = clean(name)
  return templates[tone].replace(/\{name\}/g, n).replace(/\{date\}/g, backOn).replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------- D4A-3: the last look at the door

export const LAST_LOOK_ITEMS = ['passport', 'boardingPass', 'medication', 'charger', 'keys', 'tags'] as const
export type LastLookItem = (typeof LAST_LOOK_ITEMS)[number]

/** How many items are left to check, and whether the guest is ready to go. */
export function lastLookLeft(ticked: readonly string[]): { left: number; ready: boolean } {
  const done = LAST_LOOK_ITEMS.filter((i) => ticked.includes(i)).length
  return { left: LAST_LOOK_ITEMS.length - done, ready: done === LAST_LOOK_ITEMS.length }
}

// ---------------------------------------------------------------- D4A-7: set your watch

/** The gap between the device's clock zone and the ship's, in minutes (positive when the ship is ahead), at a moment. */
export function watchGap(at: number, deviceZone: string, shipZone: string): { minutes: number; same: boolean } {
  const minutes = offsetMinutes(at, shipZone) - offsetMinutes(at, deviceZone)
  return { minutes, same: minutes === 0 }
}

// ---------------------------------------------------------------- D7-3: charge up tonight

/** When to remind the guest to charge a phone and power bank: the usual evening hour, or two hours before the first bag deadline if that is earlier ("HH:MM"). */
export function chargeReminderTime(bagDeadline?: string): string {
  const usual = '21:00'
  if (!bagDeadline || !/^\d{1,2}:\d{2}$/.test(bagDeadline)) return usual
  const [h, m] = bagDeadline.split(':').map(Number)
  const earlier = h * 60 + m - 120
  if (earlier < 0 || earlier >= 21 * 60) return usual
  const hh = String(Math.floor(earlier / 60)).padStart(2, '0')
  const mm = String(earlier % 60).padStart(2, '0')
  return `${hh}:${mm}`
}
