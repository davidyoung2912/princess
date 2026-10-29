import type { Cents } from './pricing'
import { GRATUITY_PER_NIGHT, GRATUITY_PER_NIGHT_SUITE } from './pricing'
import type { Entitlements } from './entitlements'
import { itinerary, shipZoneOnDate, type Sailing } from './sailings'
import { zonedToEpoch } from './timezones'

/** The onboard account, or folio (ACC-01): itemised charges, credits, what a package covered, tips, with a running total. Amounts are authored concept values. */
export type FolioCategory = 'dining' | 'drinks' | 'internet' | 'spa' | 'shops' | 'photos' | 'laundry' | 'gratuities' | 'tips' | 'credit'

export const FOLIO_CATEGORIES: readonly FolioCategory[] = ['dining', 'drinks', 'internet', 'spa', 'shops', 'photos', 'laundry', 'gratuities', 'tips', 'credit']

export type CoveredBy = 'package' | 'fare' | 'credit'

export interface FolioLine {
  id: string
  day: number
  at: number
  category: FolioCategory
  description: string
  /** Who it is for: a person's id. */
  guest: string
  /** Charged to the account; negative is a credit. Zero when something else paid. */
  cents: Cents
  /** What it would have cost, when something else paid for it. */
  value?: Cents
  coveredBy?: CoveredBy
}

export interface FolioGuest {
  id: string
  firstName: string
  age: number
  entitlements: Entitlements
  suite: boolean
}

export interface DiningCharge { id: string; day: number; time: string; venue: string; guests: readonly string[]; charge: Cents; covered: readonly string[] }

export interface FolioInput {
  sailing: Sailing
  /** The last day of the cruise to list, 1 to 8. Days that have not started have no charges. */
  throughDay: number
  guests: readonly FolioGuest[]
  dining: readonly DiningCharge[]
  /** Whether the booking earns a welcome credit (Ruby and above). */
  welcomeCredit: boolean
}

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** `adult` items are for 21 and over (alcohol, spa); children under 18 are never charged at all. */
interface Item { category: FolioCategory; description: string; cents: Cents; adult: boolean }

const ITEMS: readonly Item[] = [
  { category: 'drinks', description: 'Cocktail, Bellini’s Cocktail Bar', cents: 1400, adult: true },
  { category: 'drinks', description: 'Glass of wine, Crooners', cents: 1200, adult: true },
  { category: 'drinks', description: 'Specialty coffee, Coffee Currents', cents: 600, adult: false },
  { category: 'drinks', description: 'Premium cocktail, Wheelhouse Bar', cents: 1900, adult: true },
  { category: 'drinks', description: 'Pint, O’Malley’s Irish Pub', cents: 850, adult: true },
  { category: 'internet', description: 'Wi-Fi, one device, one day', cents: 1999, adult: false },
  { category: 'spa', description: 'Massage, Lotus Spa', cents: 15900, adult: true },
  { category: 'shops', description: 'Sunscreen, Shops of Princess', cents: 1899, adult: false },
  { category: 'shops', description: 'Souvenir tee, Shops of Princess', cents: 3200, adult: false },
  { category: 'photos', description: 'Portrait print, ship photographers', cents: 2495, adult: false },
  { category: 'laundry', description: 'Self-service laundry, wash and dry', cents: 800, adult: false },
]

/** The bar service charge added to a bar charge. */
export const BAR_SERVICE_RATE = 0.18

/** A package covers a drink up to its cap (dollars) and the first Wi-Fi device; beyond the cap the guest pays the difference. */
function cover(g: FolioGuest, item: Item, used: { wifi: boolean }): { cents: Cents; value?: Cents; coveredBy?: CoveredBy } {
  const e = g.entitlements
  if (item.category === 'drinks' && e.drinkCapUsd > 0) {
    const cap = e.drinkCapUsd * 100
    return item.cents <= cap ? { cents: 0, value: item.cents, coveredBy: 'package' } : { cents: item.cents - cap, value: item.cents, coveredBy: 'package' }
  }
  if (item.category === 'internet' && e.wifiDevices > 0 && !used.wifi) {
    used.wifi = true
    return { cents: 0, value: item.cents, coveredBy: 'package' }
  }
  return { cents: item.cents }
}

/** Every charge to the account up to the chosen day, in time order. The same booking and sailing always give the same list. */
export function buildFolio(input: FolioInput): FolioLine[] {
  const days = itinerary(input.sailing)
  const lines: FolioLine[] = []
  const last = Math.min(input.throughDay, days.length - 1)
  const at = (day: number, hour: number, minute = 0) => {
    const date = days[day - 1].date
    return zonedToEpoch(date, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, shipZoneOnDate(input.sailing, date))
  }
  const dinnerAt = (day: number, time: string) => zonedToEpoch(days[day - 1].date, time, shipZoneOnDate(input.sailing, days[day - 1].date))
  const used = new Map<string, { wifi: boolean }>()

  if (input.welcomeCredit && last >= 1) lines.push({ id: 'credit-welcome', day: 1, at: at(1, 16), category: 'credit', description: 'Welcome gift: onboard credit', guest: input.guests[0].id, cents: -5000 })

  for (let day = 1; day <= last; day++) {
    for (const g of input.guests) {
      const state = used.get(g.id) ?? { wifi: false }
      used.set(g.id, state)
      const rate = g.suite ? GRATUITY_PER_NIGHT_SUITE : GRATUITY_PER_NIGHT
      if (day <= 7) {
        lines.push(
          g.entitlements.gratuitiesIncluded
            ? { id: `tip-${g.id}-${day}`, day, at: at(day, 6), category: 'gratuities', description: 'Daily gratuity', guest: g.id, cents: 0, value: rate, coveredBy: 'package' }
            : { id: `tip-${g.id}-${day}`, day, at: at(day, 6), category: 'gratuities', description: 'Daily gratuity', guest: g.id, cents: rate },
        )
      }
      if (day === 1 || day >= 8) continue
      const picks = hash(`${input.sailing.id}|${g.id}|${day}`)
      const count = g.age < 18 ? 0 : picks % 4 === 0 ? 0 : 1 + (picks % 2)
      for (let n = 0; n < count; n++) {
        const item = ITEMS[(picks >>> (3 * n + 2)) % ITEMS.length]
        if (g.age < 18 || (item.adult && g.age < 21)) continue
        if (item.category === 'spa' && day % 2 === 1) continue
        const c = cover(g, item, state)
        const hour = 11 + ((picks >>> (n + 5)) % 10)
        const base: FolioLine = { id: `x-${g.id}-${day}-${n}`, day, at: at(day, hour, (picks % 4) * 15), category: item.category, description: item.description, guest: g.id, ...c }
        lines.push(base)
        if (item.category === 'drinks' && c.cents > 0) {
          lines.push({ id: `${base.id}-svc`, day, at: base.at + 1, category: 'tips', description: `Bar service charge (${Math.round(BAR_SERVICE_RATE * 100)}%)`, guest: g.id, cents: Math.round(c.cents * BAR_SERVICE_RATE) })
        }
      }
    }
  }

  for (const t of input.dining) {
    if (t.day > last || t.charge <= 0) continue
    const paying = t.guests.filter((x) => !t.covered.includes(x))
    const each = paying.length > 0 ? Math.round(t.charge / paying.length) : 0
    paying.forEach((guest, i) => lines.push({ id: `${t.id}-${guest}`, day: t.day, at: dinnerAt(t.day, t.time) + i, category: 'dining', description: `Cover charge, ${t.venue}`, guest, cents: each }))
    for (const guest of t.covered) lines.push({ id: `${t.id}-${guest}-cov`, day: t.day, at: dinnerAt(t.day, t.time), category: 'dining', description: `Specialty dinner, ${t.venue}`, guest, cents: 0, value: 0, coveredBy: 'package' })
  }
  // Sorted by time, then by id so two lines in the same minute keep a stable order.
  return lines.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

export interface FolioFilter { category: FolioCategory | null; guest: string | null; query: string; coveredOnly: boolean }

export const NO_FOLIO_FILTER: FolioFilter = { category: null, guest: null, query: '', coveredOnly: false }

export function filterFolio(lines: readonly FolioLine[], f: FolioFilter): FolioLine[] {
  const q = f.query.trim().toLowerCase()
  return lines.filter((l) => (!f.category || l.category === f.category) && (!f.guest || l.guest === f.guest) && (!f.coveredOnly || !!l.coveredBy) && (!q || l.description.toLowerCase().includes(q)))
}

export interface FolioTotals { charges: Cents; credits: Cents; covered: Cents; balance: Cents }

/** What was charged, what was credited, what packages paid for, and what is owed. `balance` is charges less credits. */
export function folioTotals(lines: readonly FolioLine[]): FolioTotals {
  const charges = lines.filter((l) => l.cents > 0).reduce((n, l) => n + l.cents, 0)
  const credits = -lines.filter((l) => l.cents < 0).reduce((n, l) => n + l.cents, 0)
  const covered = lines.filter((l) => l.coveredBy).reduce((n, l) => n + ((l.value ?? 0) - l.cents), 0)
  return { charges, credits, covered, balance: charges - credits }
}

/** The running balance after each line, in the order given. */
export function runningTotals(lines: readonly FolioLine[]): Cents[] {
  let sum = 0
  return lines.map((l) => (sum += l.cents))
}
