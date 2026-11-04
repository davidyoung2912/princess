import { type ElevatorBank, type MusterStation, type Place, type PlaceKind, type Section } from './deck'
import { replaceShip, type CategoryId, type ShipContent, type ShipFacts, type StateroomCategory } from './ship'
import { notifyCatalogue } from './catalogueServed'
import { keepPlan } from './aboardPlans'

/**
 * The ship reference from the server (multi-device plan 3, Phase 3 step 2): ship facts, stateroom categories, the deck plan, elevator banks and
 * muster stations. The authored values in `ship.ts` and `deck.ts` show until it arrives; the last answer is kept on the device as a cache.
 */
export interface ServedShip extends ShipContent {
  version: string
  places: Place[]
  elevators: ElevatorBank[]
  muster: MusterStation[]
}

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 600): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, min = 0, max = 10_000_000): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const SECTIONS: readonly string[] = ['forward', 'midship', 'aft']
const KINDS: readonly string[] = ['dining', 'bar', 'show', 'family', 'wellness', 'pool', 'shop', 'service', 'medical']
const LETTERS: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F']
const CATEGORY_IDS: readonly string[] = ['interior', 'oceanview', 'balcony', 'miniSuite', 'sanctuaryMiniSuite', 'signatureSuite']

function facts(r: unknown): ShipFacts | null {
  if (!rec(r)) return null
  if (!str(r.id, 40) || !str(r.name, 80) || !str(r.className, 60) || !str(r.length, 30) || !str(r.intro)) return null
  for (const k of ['entered', 'tonnage', 'guests', 'crew', 'staterooms', 'accessibleStaterooms', 'connectingStaterooms', 'decks', 'sanctuaryStaterooms'] as const) if (!num(r[k])) return null
  return r as unknown as ShipFacts
}

function category(r: unknown): StateroomCategory | null {
  if (!rec(r) || !str(r.id, 30) || !CATEGORY_IDS.includes(r.id) || !str(r.name, 80) || !str(r.code, 8) || !str(r.size, 80) || !str(r.view, 80) || !str(r.summary) || !num(r.ratio, 0.1, 100)) return null
  const c: StateroomCategory = { id: r.id as CategoryId, name: r.name, code: r.code, size: r.size, view: r.view, summary: r.summary, ratio: r.ratio }
  if (r.suite === true) c.suite = true
  return c
}

export function place(r: unknown): Place | null {
  if (!rec(r) || !str(r.id, 40) || !str(r.name, 120) || !num(r.deck, 1, 30) || !str(r.section, 10) || !SECTIONS.includes(r.section) || !str(r.kind, 20) || !KINDS.includes(r.kind) || typeof r.stepFree !== 'boolean') return null
  if (r.note !== undefined && r.note !== null && !str(r.note)) return null
  const p: Place = { id: r.id, name: r.name, deck: r.deck, section: r.section as Section, kind: r.kind as PlaceKind, stepFree: r.stepFree }
  if (typeof r.note === 'string') p.note = r.note
  return p
}

export function bank(r: unknown): ElevatorBank | null {
  if (!rec(r) || !str(r.bank, 1) || !LETTERS.includes(r.bank) || !str(r.section, 10) || !SECTIONS.includes(r.section) || (r.side !== 'port' && r.side !== 'starboard')) return null
  return { bank: r.bank as ElevatorBank['bank'], section: r.section as Section, side: r.side }
}

export function station(r: unknown): MusterStation | null {
  if (!rec(r) || !str(r.letter, 1) || !LETTERS.includes(r.letter) || !str(r.name, 120) || !str(r.placeId, 40) || !num(r.deck, 1, 30)) return null
  return { letter: r.letter as MusterStation['letter'], name: r.name, placeId: r.placeId, deck: r.deck }
}

export const list = <T,>(v: unknown, f: (x: unknown) => T | null): T[] | null => {
  if (!Array.isArray(v)) return null
  const out = v.map(f)
  return out.some((x) => x === null) ? null : (out as T[])
}

/** Reads the server's answer, all or nothing: any malformed entry, a place id used twice, a muster station at an unknown place, or a missing section gives null. */
export function normalizeShip(raw: unknown): ServedShip | null {
  if (!rec(raw) || !str(raw.version, 80)) return null
  const ship = facts(raw.ship)
  const highlights = list(raw.highlights, (x) => (rec(x) && str(x.title, 120) && str(x.body) ? { title: x.title, body: x.body } : null))
  const categories = list(raw.categories, category)
  const accessibility = list(raw.accessibility, (x) => (str(x) ? x : null))
  const otherShips = list(raw.otherShips, (x) => (rec(x) && str(x.name, 80) && str(x.note) && num(x.guests) && num(x.entered) ? { name: x.name, note: x.note, guests: x.guests, entered: x.entered } : null))
  const places = list(raw.places, place)
  const elevators = list(raw.elevators, bank)
  const muster = list(raw.muster, station)
  if (!ship || !highlights || !categories || !accessibility || !otherShips || !places || !elevators || !muster) return null
  if (categories.length === 0 || places.length === 0 || elevators.length === 0 || muster.length === 0) return null
  if (new Set(categories.map((c) => c.id)).size !== categories.length || new Set(places.map((p) => p.id)).size !== places.length) return null
  if (new Set(muster.map((m) => m.letter)).size !== muster.length) return null
  const ids = new Set(places.map((p) => p.id))
  if (!muster.every((m) => ids.has(m.placeId))) return null
  return { version: raw.version, ship, highlights, categories, accessibility, otherShips, places, elevators, muster }
}

/** Puts the served ship reference in use and tells the screens. */
export function applyShip(s: ServedShip): void {
  replaceShip(s)
  // This is the aboard-depth Sun Princess's plan; it is the one in use unless another ship's plan was switched in (`aboardPlans.ts`).
  keepPlan({ version: s.version, shipId: s.ship.id, accessibility: s.accessibility, places: s.places, elevators: s.elevators, muster: s.muster })
  notifyCatalogue()
}
