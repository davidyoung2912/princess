import { cabinsFor, type Cabin } from './cabins'
import { computeEntitlements } from './entitlements'
import { bookingQuote, FARES, type FareId } from './fares'
import { formatMoney } from './pricing'
import { categoryById, type CategoryId } from './ship'
import type { Sailing } from './sailings'
import { itinerary } from './sailings'

/**
 * The cabin chooser (S1-02 to S1-05, S1-07, S1-08). A score is 1 to 5 (5 is best) and always comes with the reasons, so nothing is hidden for the sake of a sale.
 * The deck plan is an authored sample (see `cabins.ts`); the ship's heading is a simulation (`source: 'sim'`).
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

const clamp = (n: number): number => Math.max(1, Math.min(5, n))

const sleepReasons = (c: Cabin): { score: number; why: string[] } => {
  const why: string[] = []
  let s = 5
  if (c.position === 'forward' && c.deck <= 9) { s -= 1; why.push('The bow thrusters are close by. They run when the ship docks, often early in the morning.') }
  if (c.position === 'aft' && c.deck <= 10) { s -= 1; why.push('The engine and propellers are near, so you may feel a low hum or vibration.') }
  if (c.deck >= 16 && c.position === 'midship') { s -= 1; why.push('The Dome is close by, and its late-night dance party can carry.') }
  if (c.position === 'midship' && c.deck <= 11) { s -= 1; why.push('A galley and laundry sit nearby, with early-morning deliveries.') }
  if (why.length === 0) why.push('Nothing noisy above, below or beside this one in our sample plan.')
  return { score: clamp(s), why }
}

const motionReasons = (c: Cabin): { score: number; why: string[] } => {
  const why: string[] = []
  let s = 5
  if (c.position === 'forward') { s -= 2; why.push('The front of the ship pitches the most in a swell.') }
  else if (c.position === 'aft') { s -= 1; why.push('The back of the ship moves a little more than the middle.') }
  if (c.deck >= 15) { s -= 2; why.push('High decks sway more, which can bother anyone prone to seasickness.') }
  else if (c.deck >= 12) { s -= 1; why.push('A middle-height deck moves a bit more than a low one.') }
  if (why.length === 0) why.push('Midship on a lower deck, the steadiest part of the ship.')
  return { score: clamp(s), why }
}

const noiseReasons = (c: Cabin): { score: number; why: string[] } => {
  const why: string[] = []
  let s = 5
  if (c.position === 'midship') { s -= 1; why.push('Near the elevators, so people walk past all day.') }
  if (c.deck >= 14) { s -= 2; why.push('Close to the pool decks, with music and chairs moving in the daytime.') }
  if (c.accessible) why.push('An accessible cabin, so a wider door and a hallway built for wheelchairs. Neighbours may need help at any hour.')
  if (why.length === 0) why.push('Away from the lifts, stairs and pool decks.')
  return { score: clamp(s), why }
}

/** The sailing heading used for the sun (simulated). Degrees clockwise from north; berthed ships point the way the berth lies. */
export const HEADINGS: Record<number, { heading: number; note: string }> = {
  1: { heading: 135, note: 'Leaving Fort Lauderdale toward the south-east, then turning south.' },
  2: { heading: 215, note: 'Steaming south-west toward Cozumel.' },
  3: { heading: 350, note: 'Berthed in Cozumel, bow pointing north.' },
  4: { heading: 90, note: 'At anchor off Belize City; the ship swings with the wind, so this is a guess.' },
  5: { heading: 300, note: 'Berthed in Roatán, bow pointing north-west.' },
  6: { heading: 40, note: 'Steaming north-east toward Florida.' },
  7: { heading: 20, note: 'Steaming north toward Florida.' },
  8: { heading: 180, note: 'Berthed in Fort Lauderdale.' },
}

/** The sun's compass direction in March at this latitude (simulated): east in the morning, south at noon, west in the afternoon. */
const SUN_AZIMUTH = { morning: 100, afternoon: 260 } as const

const angleBetween = (a: number, b: number): number => {
  const d = Math.abs(((a - b) % 360 + 360) % 360)
  return d > 180 ? 360 - d : d
}

export type SunPart = 'morning' | 'afternoon'
/** Which side of the ship gets the sun at that part of a day. */
export function sunSide(heading: number, part: SunPart): 'port' | 'starboard' | 'neither' {
  const az = SUN_AZIMUTH[part]
  const port = angleBetween((heading + 270) % 360, az)
  const starboard = angleBetween((heading + 90) % 360, az)
  const best = Math.min(port, starboard)
  if (best > 60) return 'neither'
  return port <= starboard ? 'port' : 'starboard'
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

export function sunSummary(sailing: Sailing, side: Cabin['side']): SunSummary {
  let mornings = 0
  let afternoons = 0
  let portAfternoons = 0
  for (const d of itinerary(sailing)) {
    const h = HEADINGS[d.day].heading
    if (sunSide(h, 'morning') === side) mornings++
    if (sunSide(h, 'afternoon') === side) {
      afternoons++
      if (d.port !== 'sea' && d.port !== 'fll') portAfternoons++
    }
  }
  const label: SunSummary['label'] = mornings >= 3 && afternoons >= 3 ? 'both' : mornings >= 3 ? 'morning' : afternoons >= 3 ? 'afternoon' : 'shaded'
  const text = {
    both: 'Sun on this side in the morning and the afternoon on most days. Bring a hat.',
    morning: 'Morning sun on most days, shaded in the afternoon. Good for coffee outside, cooler for a nap.',
    afternoon: 'Shaded in the morning, sun in the afternoon on most days. Warmer in the cabin when you come back from a port.',
    shaded: 'Little direct sun on this side on most days. Cooler, and kinder to a screen.',
  }[label]
  return { mornings, afternoons, portAfternoons, label, text }
}

export function scoreCabin(sailing: Sailing, category: CategoryId, cabin: Cabin): CabinScore {
  const sleep = sleepReasons(cabin)
  const motion = motionReasons(cabin)
  const noise = noiseReasons(cabin)
  const hasOutside = category !== 'interior' && !!categoryById(category)
  const warnings: string[] = []
  if (cabin.obstructed) warnings.push('The view is partly blocked by lifeboats.')
  if (!cabin.available) warnings.push('This cabin is already taken on this sailing.')
  if (cabin.accessible) warnings.push('Reserved for guests who need an accessible cabin; ask before booking it.')
  return {
    cabin, category, sleep: sleep.score, motion: motion.score, noise: noise.score,
    reasons: { sleep: sleep.why, motion: motion.why, noise: noise.why },
    sun: hasOutside ? sunSummary(sailing, cabin.side) : null,
    warnings,
  }
}

export interface CabinFilter { quiet: boolean; calmSea: boolean; accessible: boolean; clearView: boolean; availableOnly: boolean }
export const NO_FILTER: CabinFilter = { quiet: false, calmSea: false, accessible: false, clearView: false, availableOnly: true }

/** Cabins for a room type with their scores. The quiet filter needs good sleep and low noise; the calm-sea filter needs a motion score of 4 or more. */
export function chooseCabins(sailing: Sailing, category: CategoryId, filter: CabinFilter = NO_FILTER): CabinScore[] {
  return cabinsFor(sailing.id, category)
    .map((c) => scoreCabin(sailing, category, c))
    .filter((s) => (!filter.availableOnly || s.cabin.available) && (!filter.quiet || (s.sleep >= 4 && s.noise >= 4)) && (!filter.calmSea || s.motion >= 4) && (!filter.accessible || s.cabin.accessible) && (!filter.clearView || !s.cabin.obstructed))
    .sort((a, b) => b.sleep + b.motion + b.noise - (a.sleep + a.motion + a.noise) || a.cabin.number.localeCompare(b.cabin.number))
}

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
  cabin: Cabin | null
}

export interface CompareRow { key: string; values: string[] }

export const MAX_COMPARE = 3

/** Side-by-side rows for two or three choices. Price is the all-in total for the party, with gratuities and taxes already in it. */
export function compareMatrix(sailing: Sailing, guests: number, cols: readonly CompareColumn[]): CompareRow[] {
  const picks = cols.slice(0, MAX_COMPARE)
  const q = picks.map((c) => bookingQuote(sailing.id, c.category, guests, c.fare))
  const scores = picks.map((c) => (c.cabin ? scoreCabin(sailing, c.category, c.cabin) : null))
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
