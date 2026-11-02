import type { Cabin } from './cabins'
import { computeEntitlements } from './entitlements'
import { bookingQuote, FARES, type FareId } from './fares'
import { formatMoney } from './pricing'
import { categoryById, type CategoryId } from './ship'

/**
 * The cabin chooser (S1-02 to S1-05, S1-07, S1-08). A score is 1 to 5 (5 is best) and always comes with the reasons, so nothing is hidden for the sake of a sale.
 * The scores, the reasons and the sun side are worked out by the server (`GET /sailings/{id}/cabin-guide`); this module holds their shapes, the
 * "not included" list and the side-by-side comparison of choices the guest has picked.
 */
export type ScoreKey = 'sleep' | 'motion' | 'noise'

export interface CabinScore {
  cabin: Cabin
  category: CategoryId
  sleep: number
  motion: number
  noise: number
  /** Plain reasons for each score, worst first. */
  reasons: Record<ScoreKey, string[]>
  sun: SunSummary | null
  /** Short cautions to read before choosing. */
  warnings: string[]
}

export interface SunSummary {
  /** Number of days (of 8) this cabin's side has the morning sun and the afternoon sun. */
  mornings: number
  afternoons: number
  /** Port days (Cozumel, Belize City, Roatán) when the balcony is in sun in the afternoon, when most guests are back. */
  portAfternoons: number
  label: 'morning' | 'afternoon' | 'both' | 'shaded'
  text: string
}

export interface CabinFilter { quiet: boolean; calmSea: boolean; accessible: boolean; clearView: boolean; availableOnly: boolean }
export const NO_FILTER: CabinFilter = { quiet: false, calmSea: false, accessible: false, clearView: false, availableOnly: true }

// ---- Comparison and "what is not included" (S1-07, S1-08) ----

/** The things a fare does not cover, in plain words, so the first total is the real total. Numbers come from the entitlement engine. */
export function notIncluded(fare: FareId): string[] {
  const e = computeEntitlements({ tier: 'none', package: fare === 'standard' ? 'none' : fare, sanctuary: false })
  const list: string[] = []
  list.push(e.drinkCapUsd > 0 ? `Drinks that cost more than $${e.drinkCapUsd} each, and anything not on the package list` : 'All drinks except water, tea and basic coffee')
  list.push(e.wifiDevices > 0 ? `Wi-Fi on more than ${e.wifiDevices} ${e.wifiDevices === 1 ? 'device' : 'devices'} each` : 'Wi-Fi')
  list.push(e.specialtyMeals > 0 ? `Specialty dinners beyond ${e.specialtyMeals} each` : 'Specialty restaurants (a cover charge applies)')
  list.push(e.excursionCreditUsd > 0 ? `Shore excursions beyond the $${e.excursionCreditUsd} credit` : 'Shore excursions')
  list.push('Spa, photos, laundry, casino and shop purchases')
  list.push('Flights, hotels, transfers, travel insurance and parking')
  return list
}

export interface CompareColumn {
  id: string
  label: string
  category: CategoryId
  fare: FareId
  /** The served score of the picked cabin. */
  score: CabinScore | null
}

export interface CompareRow { key: string; values: string[] }

export const MAX_COMPARE = 3

/** Side-by-side rows for two or three choices. Price is the all-in total for the party, with gratuities and taxes already in it. */
export function compareMatrix(sailingId: string, guests: number, cols: readonly CompareColumn[]): CompareRow[] {
  const picks = cols.slice(0, MAX_COMPARE)
  const q = picks.map((c) => bookingQuote(sailingId, c.category, guests, c.fare))
  const scores = picks.map((c) => c.score)
  const cat = picks.map((c) => categoryById(c.category))
  const dash = '—'
  return [
    { key: 'total', values: q.map((x) => (x ? formatMoney(x.total) : dash)) },
    { key: 'perPerson', values: q.map((x) => (x ? formatMoney(x.perPerson) : dash)) },
    { key: 'size', values: cat.map((c) => c?.size ?? dash) },
    { key: 'view', values: picks.map((_, i) => (scores[i]?.cabin.obstructed ? `${cat[i]?.view ?? dash}, partly blocked` : (cat[i]?.view ?? dash))) },
    { key: 'sleep', values: scores.map((s) => (s ? `${s.sleep} of 5` : dash)) },
    { key: 'motion', values: scores.map((s) => (s ? `${s.motion} of 5` : dash)) },
    { key: 'noise', values: scores.map((s) => (s ? `${s.noise} of 5` : dash)) },
    { key: 'sun', values: scores.map((s) => (s?.sun ? s.sun.label : dash)) },
    { key: 'access', values: scores.map((s) => (s ? (s.cabin.accessible ? 'Accessible' : 'Not an accessible cabin') : dash)) },
    { key: 'fare', values: picks.map((c) => FARES[c.fare].name) },
    { key: 'included', values: picks.map((c) => { const e = computeEntitlements({ tier: 'none', package: c.fare === 'standard' ? 'none' : c.fare, sanctuary: false }); return c.fare === 'standard' ? 'Cabin, main dining, shows' : `Drinks to $${e.drinkCapUsd}, Wi-Fi, ${e.specialtyMeals} specialty dinners` }) },
  ]
}
