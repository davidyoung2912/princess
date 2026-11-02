import { AVG_COVER, AVG_DRINK, SERVICE_CHARGE } from './packages'
import { formatMoney, type Cents } from './money'
import type { Recap } from './recap'
import { itinerary, PORTS, type Sailing } from './sailings'
import { formatDate } from './cruise'

/**
 * The memory loop, part one (S8-01, S8-04, S8-07, S8-08): "wrapped" cards, what a package was really worth, "this day last year", and an expense export.
 * Pure. Nothing here posts anywhere; a card is text the guest chooses to share.
 */
export interface WrappedCard { id: string; title: string; big: string; line: string }

export interface WrappedOptions {
  /** Drinks totals are opt-in and off by default: a count the guest typed in, or null to leave them out. */
  drinks: number | null
}

export const DEFAULT_WRAPPED: WrappedOptions = { drinks: null }

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A few quiet cards from the recap. A card with nothing to say is left out rather than shown as zero. */
export function buildWrapped(r: Recap, opt: WrappedOptions = DEFAULT_WRAPPED): WrappedCard[] {
  const cards: WrappedCard[] = [
    { id: 'miles', title: 'Distance', big: r.nauticalMiles.toLocaleString('en-US'), line: `nautical miles, ${plural(r.nights, 'night', 'nights')} from ${r.dates}.` },
    { id: 'ports', title: 'Ports', big: String(Math.max(0, r.ports.length - 1)), line: `new ports: ${r.ports.slice(1, -1).join(', ') || 'none'}, and ${plural(r.seaDays, 'day', 'days')} at sea.` },
  ]
  if (r.tourNames.length) cards.push({ id: 'tours', title: 'Ashore', big: String(r.tourNames.length), line: r.tourNames.join(', ') })
  if (r.favouriteMeal) cards.push({ id: 'meal', title: 'Favourite table', big: r.favouriteMeal.name, line: r.favouriteMeal.times > 1 ? `${r.favouriteMeal.times} dinners there.` : 'One dinner, and it stuck.' })
  if (r.photos) cards.push({ id: 'photos', title: 'Photos', big: String(r.photos), line: 'to remember it by.' })
  if (opt.drinks !== null && opt.drinks > 0) cards.push({ id: 'drinks', title: 'Drinks', big: String(opt.drinks), line: 'in total. You chose to show this card.' })
  return cards
}

/** Text for one card that is safe to share: no names, no cabin, no booking number. */
export const cardText = (c: WrappedCard): string => `${c.title}: ${c.big}. ${c.line}`

// ---- Package hindsight (S8-04) ----

export interface HindsightInput {
  /** What the package cost for the party. */
  paid: Cents
  /** What the guest remembers using. */
  drinks: number
  specialtyDinners: number
  wifiNights: number
  /** A night of Wi-Fi bought one night at a time. */
  wifiNight: Cents
  /** What a different fare would have cost for the party, or null when not offered. */
  otherFarePaid: Cents | null
}

export interface Hindsight {
  paid: Cents
  /** What the same use would have cost paying one at a time. */
  payAsYouGo: Cents
  used: Cents
  verdict: 'worth' | 'close' | 'notWorth'
  /** Saved (positive) or overpaid (negative). */
  difference: Cents
  line: string
}

export function packageHindsight(i: HindsightInput): Hindsight {
  const clamp = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0)
  const drinks = Math.round(clamp(i.drinks) * AVG_DRINK * (1 + SERVICE_CHARGE))
  const food = clamp(i.specialtyDinners) * AVG_COVER
  const wifi = clamp(i.wifiNights) * Math.max(0, i.wifiNight)
  const payAsYouGo = drinks + food + wifi
  const difference = payAsYouGo - i.paid
  const verdict: Hindsight['verdict'] = Math.abs(difference) <= i.paid * 0.1 ? 'close' : difference > 0 ? 'worth' : 'notWorth'
  const line = {
    worth: `You used ${formatMoney(payAsYouGo)} of value for ${formatMoney(i.paid)}. It paid for itself with ${formatMoney(difference)} to spare.`,
    close: `You used ${formatMoney(payAsYouGo)} of value for ${formatMoney(i.paid)}. About even, so the choice was fine either way.`,
    notWorth: `You used ${formatMoney(payAsYouGo)} of value for ${formatMoney(i.paid)}. Paying as you go would have saved ${formatMoney(-difference)}.`,
  }[verdict]
  return { paid: i.paid, payAsYouGo, used: payAsYouGo, verdict, difference, line }
}

// ---- This day last year (S8-07) ----

export interface Anniversary { date: string; day: number; place: string; text: string }

const placeName = (port: string): string => (port === 'sea' ? 'at sea' : port === 'fll' ? 'in Fort Lauderdale' : `in ${PORTS[port as keyof typeof PORTS]?.name.split(',')[0] ?? port}`)

/** A memory when today is one year after a day of the cruise. Never fires if the guest switched it off. */
export function anniversaryOn(sailing: Sailing, today: string, enabled: boolean): Anniversary | null {
  if (!enabled) return null
  const year = Number(today.slice(0, 4))
  if (!Number.isInteger(year)) return null
  const lastYear = `${year - 1}${today.slice(4)}`
  const d = itinerary(sailing).find((x) => x.date === lastYear)
  if (!d) return null
  return { date: lastYear, day: d.day, place: placeName(d.port), text: `A year ago today, ${formatDate(lastYear)}, you were ${placeName(d.port)} on day ${d.day}.` }
}

// ---- Expense export (S8-08) ----

export interface ExpenseRow { date: string; description: string; category: string; cents: Cents }

/** A cell that a spreadsheet would run as a formula is made plain text first. */
export const csvCell = (v: string | number): string => {
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function expenseCsv(rows: readonly ExpenseRow[]): string {
  const head = 'Date,Description,Category,Amount (USD)'
  // Amounts are numbers made here, so a credit's minus sign is kept; only text from elsewhere is guarded.
  const lines = rows.map((r) => [csvCell(r.date), csvCell(r.description), csvCell(r.category), (r.cents / 100).toFixed(2)].join(','))
  const total = rows.reduce((a, r) => a + r.cents, 0)
  return [head, ...lines, ['', 'Total', '', (total / 100).toFixed(2)].join(',')].join('\r\n') + '\r\n'
}
