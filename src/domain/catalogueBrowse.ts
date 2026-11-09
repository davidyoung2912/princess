import { addDays } from './timezones'
import { SAILINGS, isSeaDay, portById, sailingNights, type ItineraryDay } from './sailings'
import { formatDayMonth } from './cruise'
import { PORT_COORDS } from './ports'
import { catalogueSailings, cruiseOf, patternById, shipOf, type SailingEntry, type ShipSummary } from './shipCatalogue'

/**
 * Browsing the catalogue (phase X0e, `docs/catalogue-plan.md` section 7): filter, sort and group sailings, the ports and sea days of a sailing, "add the next
 * leg" badges, side-by-side comparison of sailings and ships, and the "find my cruise" match on region and month. Pure TypeScript over the served catalogue
 * (`shipCatalogue.ts`), so it is tested in node. Nothing here is authored: when the catalogue has not arrived yet the older sailings table stands in.
 */

/** A catalogue sailing with its return date and month worked out. */
export interface BrowseSailing extends SailingEntry {
  /** The morning the ship is back, "YYYY-MM-DD". */
  returnDate: string
  /** The month of departure, "YYYY-MM". */
  month: string
}

const decorate = (e: SailingEntry): BrowseSailing => ({ ...e, returnDate: addDays(e.departure, e.nights), month: e.departure.slice(0, 7) })

/** Every sailing to browse, by departure date. Before the catalogue arrives, the older single-route sailings. */
export function browseSailings(): BrowseSailing[] {
  const served = catalogueSailings()
  const list = served.length > 0
    ? served.map(decorate)
    : SAILINGS.map((s) => decorate({
        id: s.id, ship: shipOf(s.id).id, departure: s.departure, nights: sailingNights(s), title: cruiseOf(s.id).name, region: 'caribbean',
        legs: [], holiday: !!s.holiday, bookingOpen: true, dataStatus: 'served',
      }))
  return list.sort((a, b) => a.departure.localeCompare(b.departure) || a.nights - b.nights || a.id.localeCompare(b.id))
}

/** One sailing to browse, by id. */
export const browseSailingById = (id: unknown): BrowseSailing | undefined => browseSailings().find((s) => s.id === id)

/** "Mar 21 to Mar 28, 2027". */
export function rangeOf(s: Pick<BrowseSailing, 'departure' | 'returnDate'>): string {
  const end = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${s.returnDate}T12:00:00Z`))
  return `${formatDayMonth(s.departure)} to ${end}`
}

// ---- length ------------------------------------------------------------------

export type NightsBand = 'short' | 'week' | 'long' | 'grand'
export const NIGHTS_BANDS: readonly NightsBand[] = ['short', 'week', 'long', 'grand']

/** Up to 6 nights is short, 7 to 9 a week, 10 to 14 long, 15 or more a grand voyage. */
export function nightsBand(nights: number): NightsBand {
  return nights <= 6 ? 'short' : nights <= 9 ? 'week' : nights <= 14 ? 'long' : 'grand'
}

// ---- ports and sea days ------------------------------------------------------

const isPlace = (id: string): boolean => !isSeaDay(id)

/** The ports a sailing calls at, once each, in order, with the start and end ports first and last. Read from the patterns of its legs, or from the loaded days. */
export function portsOf(e: SailingEntry, days?: readonly Pick<ItineraryDay, 'port'>[]): string[] {
  const ids: string[] = []
  const add = (id: string | undefined) => { if (id && isPlace(id) && !ids.includes(id)) ids.push(id) }
  if (days && days.length > 0) days.forEach((d) => add(d.port))
  else {
    add(e.startPort)
    for (const l of e.legs) patternById(l.pattern)?.days.forEach((d) => add(d.port))
    add(e.endPort)
  }
  return ids
}

/** Days at sea, from the patterns of the legs. A joined pair of legs shares its turnaround day, so that day is counted once. */
export function seaDaysOf(e: SailingEntry, days?: readonly Pick<ItineraryDay, 'port'>[]): number | null {
  if (days && days.length > 0) return days.filter((d) => isSeaDay(d.port)).length
  const patterns = e.legs.map((l) => patternById(l.pattern))
  if (patterns.length === 0 || patterns.some((p) => !p)) return null
  return patterns.reduce((n, p) => n + p!.days.filter((d) => isSeaDay(d.port)).length, 0)
}

export const portName = (id: string): string => portById(id)?.name.split(',')[0] ?? id

// ---- filter, sort, group -----------------------------------------------------

export interface BrowseFilter {
  ship?: string
  region?: string
  /** "YYYY-MM". */
  month?: string
  nights?: NightsBand
  port?: string
  /** An occasion the guest is looking for (DRM-07), matched on date and length only. */
  occasion?: OccasionId
  /** Only sailings that can be booked now. */
  bookable?: boolean
}

/**
 * Occasion-led discovery (DRM-07). The catalogue holds no occasion tags, so an occasion is matched only from facts it does have: the departure date and the
 * length. 'holiday' is the served holiday flag or a departure from 20 Dec to 3 Jan; 'summer' is a departure from 15 Jun to 31 Aug (school break in much of the
 * northern hemisphere); 'milestone' is a voyage of 14 nights or more, long enough for a big trip. No tag is shared, saved or sent: the choice lives in the
 * address of the page only. Optional services are not matched.
 */
export type OccasionId = 'holiday' | 'summer' | 'milestone'
export const OCCASIONS: readonly OccasionId[] = ['holiday', 'summer', 'milestone']

export function occasionsOf(s: Pick<SailingEntry, 'departure' | 'nights' | 'holiday'>): OccasionId[] {
  const md = s.departure.slice(5)
  const out: OccasionId[] = []
  if (s.holiday || md >= '12-20' || md <= '01-03') out.push('holiday')
  if (md >= '06-15' && md <= '08-31') out.push('summer')
  if (s.nights >= 14) out.push('milestone')
  return out
}

export const NO_FILTER: BrowseFilter = {}

export function filterSailings(list: readonly BrowseSailing[], f: BrowseFilter): BrowseSailing[] {
  return list.filter((s) => {
    if (f.ship && s.ship !== f.ship) return false
    if (f.region && s.region !== f.region) return false
    if (f.month && s.month !== f.month) return false
    if (f.nights && nightsBand(s.nights) !== f.nights) return false
    if (f.bookable && !s.bookingOpen) return false
    if (f.occasion && !occasionsOf(s).includes(f.occasion)) return false
    if (f.port && !portsOf(s).includes(f.port)) return false
    return true
  })
}

export type BrowseSort = 'soonest' | 'cheapest' | 'shortest'
export const BROWSE_SORTS: readonly BrowseSort[] = ['soonest', 'cheapest', 'shortest']

/** Cheapest means the lowest price a night, so a 21-night voyage is judged fairly against a week. A sailing with no price goes last. */
export const pricePerNight = (s: Pick<SailingEntry, 'fromCents' | 'nights'>): number | null => (s.fromCents === undefined ? null : Math.round(s.fromCents / s.nights))

export function sortSailings(list: readonly BrowseSailing[], by: BrowseSort): BrowseSailing[] {
  const soonest = (a: BrowseSailing, b: BrowseSailing) => a.departure.localeCompare(b.departure) || a.id.localeCompare(b.id)
  const out = [...list]
  if (by === 'soonest') return out.sort(soonest)
  if (by === 'shortest') return out.sort((a, b) => a.nights - b.nights || soonest(a, b))
  return out.sort((a, b) => {
    const pa = pricePerNight(a)
    const pb = pricePerNight(b)
    if (pa === null || pb === null) return pa === pb ? soonest(a, b) : pa === null ? 1 : -1
    return pa - pb || soonest(a, b)
  })
}

export interface MonthGroup { month: string; sailings: BrowseSailing[] }

/** Sailings grouped by month of departure, keeping the order given (the groups appear in the order their first sailing does). */
export function groupByMonth(list: readonly BrowseSailing[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const s of list) {
    const g = groups.find((x) => x.month === s.month)
    if (g) g.sailings.push(s)
    else groups.push({ month: s.month, sailings: [s] })
  }
  return groups
}

/** The months that have a sailing, in order. */
export const monthsOf = (list: readonly BrowseSailing[]): string[] => [...new Set(list.map((s) => s.month))].sort()

/** "March 2027" for "2027-03". */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00Z`))
}

/** The ports a guest can filter by: only ports some sailing in the list calls at, by name. */
export function portOptions(list: readonly BrowseSailing[]): { id: string; name: string }[] {
  const ids = new Set(list.flatMap((s) => portsOf(s)))
  return [...ids].map((id) => ({ id, name: portName(id) })).sort((a, b) => a.name.localeCompare(b.name))
}

// ---- legs --------------------------------------------------------------------

/**
 * The sailing that starts the day this one ends, on the same ship: the "add the next leg" offer. Only a one-leg sailing offers it, and only when the next sailing's
 * own start port is this one's end port. Joined sailings (more than one leg) are already the joined version.
 */
export function nextLegOf(s: BrowseSailing, all: readonly BrowseSailing[]): BrowseSailing | undefined {
  if (s.legs.length > 1) return undefined
  return all.find((x) => x.id !== s.id && x.ship === s.ship && x.departure === s.returnDate && x.legs.length <= 1 && (!s.endPort || !x.startPort || x.startPort === s.endPort))
}

export type LegBadge = { kind: 'joined'; legs: number } | { kind: 'addNext'; nights: number; nextId: string } | null

export function legBadge(s: BrowseSailing, all: readonly BrowseSailing[]): LegBadge {
  if (s.legs.length > 1) return { kind: 'joined', legs: s.legs.length }
  const next = nextLegOf(s, all)
  return next ? { kind: 'addNext', nights: next.nights, nextId: next.id } : null
}

// ---- compare sailings --------------------------------------------------------

export interface SailingFacts {
  id: string
  title: string
  ship: string
  region?: string
  departure: string
  returnDate: string
  nights: number
  fromCents?: number
  perNightCents: number | null
  ports: string[]
  seaDays: number | null
  holiday: boolean
  bookingOpen: boolean
  dataStatus: SailingEntry['dataStatus']
}

export function sailingFacts(s: BrowseSailing): SailingFacts {
  return {
    id: s.id, title: s.title, ship: s.ship, region: s.region, departure: s.departure, returnDate: s.returnDate, nights: s.nights, fromCents: s.fromCents,
    perNightCents: pricePerNight(s), ports: portsOf(s), seaDays: seaDaysOf(s), holiday: s.holiday, bookingOpen: s.bookingOpen, dataStatus: s.dataStatus,
  }
}

/** The ids of the cheapest per night and the shortest, among the sailings compared, for a plain "lowest" tag. Ties all get it. */
export function compareHighlights(facts: readonly SailingFacts[]): { cheapest: string[]; fewestNights: string[]; mostPorts: string[] } {
  const priced = facts.filter((f) => f.perNightCents !== null)
  const low = priced.length > 0 ? Math.min(...priced.map((f) => f.perNightCents!)) : null
  const fewest = facts.length > 0 ? Math.min(...facts.map((f) => f.nights)) : 0
  const most = facts.length > 0 ? Math.max(...facts.map((f) => f.ports.length)) : 0
  return {
    cheapest: facts.length > 1 && low !== null ? priced.filter((f) => f.perNightCents === low).map((f) => f.id) : [],
    fewestNights: facts.length > 1 && new Set(facts.map((f) => f.nights)).size > 1 ? facts.filter((f) => f.nights === fewest).map((f) => f.id) : [],
    mostPorts: facts.length > 1 && new Set(facts.map((f) => f.ports.length)).size > 1 ? facts.filter((f) => f.ports.length === most).map((f) => f.id) : [],
  }
}

/** The sailings a guest has saved, in the order saved, from `sailing:<id>` keys. Capped at three for a side-by-side view. */
export function savedSailingsToCompare(keys: readonly string[], max = 3): BrowseSailing[] {
  const out: BrowseSailing[] = []
  for (const key of keys) {
    if (!key.startsWith('sailing:')) continue
    const s = browseSailingById(key.slice('sailing:'.length))
    if (s && !out.some((x) => x.id === s.id)) out.push(s)
    if (out.length === max) break
  }
  return out
}

// ---- compare ships -----------------------------------------------------------

export type ShipFactKey = 'className' | 'entered' | 'guests' | 'crew' | 'staterooms' | 'decks' | 'tonnage' | 'lengthFt' | 'depth'
export const SHIP_FACT_KEYS: readonly ShipFactKey[] = ['className', 'entered', 'guests', 'crew', 'staterooms', 'decks', 'tonnage', 'lengthFt', 'depth']

export const shipFact = (ship: ShipSummary, key: ShipFactKey): string | number | undefined => ship[key]

/** The rows of a compare table: for each fact, the value for each ship (undefined when the server has none), and whether the ships differ. */
export function shipCompareRows(ships: readonly ShipSummary[]): { key: ShipFactKey; values: (string | number | undefined)[]; differs: boolean }[] {
  return SHIP_FACT_KEYS.map((key) => {
    const values = ships.map((s) => shipFact(s, key))
    return { key, values, differs: new Set(values.map((v) => String(v))).size > 1 }
  })
}

/** How many sailings a ship has in the catalogue, and the first departure. */
export function shipSailingSummary(shipId: string, list: readonly BrowseSailing[]): { count: number; first?: string; regions: string[] } {
  const mine = list.filter((s) => s.ship === shipId)
  return { count: mine.length, first: mine[0]?.departure, regions: [...new Set(mine.flatMap((s) => (s.region ? [s.region] : [])))] }
}

// ---- explore by region and month ---------------------------------------------

/** For each region, how many sailings leave in each month: the grid of the Explore page. Regions with no sailing are left out. */
export function regionMonthGrid(list: readonly BrowseSailing[], regionIds: readonly string[]): { region: string; total: number; months: Record<string, number> }[] {
  const ids = [...new Set([...regionIds, ...list.flatMap((s) => (s.region ? [s.region] : []))])]
  return ids
    .map((region) => {
      const months: Record<string, number> = {}
      for (const s of list) if (s.region === region) months[s.month] = (months[s.month] ?? 0) + 1
      return { region, total: Object.values(months).reduce((a, b) => a + b, 0), months }
    })
    .filter((r) => r.total > 0)
}

// ---- find my cruise: pick a sailing --------------------------------------------

export interface SailingWish {
  region?: string
  month?: string
  nights?: NightsBand
}

export type SailingReason = 'region' | 'month' | 'nights' | 'bookable' | 'cheap'
export interface SailingMatch { sailing: BrowseSailing; reasons: SailingReason[]; score: number }

/**
 * Sailings ranked for a wish. A region the guest named must match (anything else is not the trip they asked for); a month or a length they named scores when it
 * matches, and a sailing that can be booked now scores a little more. With no wish at all, nothing is ranked. At most `limit` come back; ties keep date order.
 */
export function matchSailings(list: readonly BrowseSailing[], wish: SailingWish, limit = 3): SailingMatch[] {
  if (!wish.region && !wish.month && !wish.nights) return []
  const pool = wish.region ? list.filter((s) => s.region === wish.region) : [...list]
  const priced = pool.map(pricePerNight).filter((p): p is number => p !== null)
  const median = priced.length > 0 ? [...priced].sort((a, b) => a - b)[Math.floor(priced.length / 2)] : null
  const matches = pool.map((sailing): SailingMatch => {
    const reasons: SailingReason[] = []
    let score = 0
    if (wish.region) { reasons.push('region'); score += 4 }
    if (wish.month && sailing.month === wish.month) { reasons.push('month'); score += 3 }
    if (wish.nights && nightsBand(sailing.nights) === wish.nights) { reasons.push('nights'); score += 3 }
    if (sailing.bookingOpen) { reasons.push('bookable'); score += 1 }
    const p = pricePerNight(sailing)
    if (p !== null && median !== null && p < median) { reasons.push('cheap'); score += 1 }
    return { sailing, reasons, score }
  })
  const asked = (wish.month ? 1 : 0) + (wish.nights ? 1 : 0)
  return matches
    .filter((m) => m.reasons.filter((r) => r === 'month' || r === 'nights').length > 0 || asked === 0)
    .sort((a, b) => b.score - a.score || a.sailing.departure.localeCompare(b.sailing.departure))
    .slice(0, limit)
}

// ---- route sketch ------------------------------------------------------------

/** The ports of a route in sailing order, once each (a return to a port already visited is not drawn twice), from loaded days. */
export function routeOf(days: readonly Pick<ItineraryDay, 'port'>[]): string[] {
  const out: string[] = []
  for (const d of days) if (isPlace(d.port) && !out.includes(d.port)) out.push(d.port)
  return out
}

/**
 * Positions for a route sketch on a width x height canvas, from the ports' real coordinates with a margin. A port with no coordinates is left out. A route
 * with no spread in one direction is centred in it, so a near-straight route does not divide by zero.
 */
export function routeSketch(ids: readonly string[], width: number, height: number, margin = 24): { id: string; x: number; y: number }[] {
  const known = ids.flatMap((id) => {
    const p = portById(id)
    const old = (PORT_COORDS as Record<string, [number, number] | undefined>)[id]
    if (p && p.lat !== undefined && p.lon !== undefined) return [{ id, lon: p.lon, lat: p.lat }]
    return old ? [{ id, lon: old[0], lat: old[1] }] : []
  })
  if (known.length === 0) return []
  const lons = known.map((k) => k.lon)
  const lats = known.map((k) => k.lat)
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const spread = (v: number, lo: number, hi: number, size: number, flip: boolean) => {
    if (hi - lo < 1e-6) return size / 2
    const f = (v - lo) / (hi - lo)
    return margin + (flip ? 1 - f : f) * (size - 2 * margin)
  }
  return known.map((k) => ({ id: k.id, x: spread(k.lon, minLon, maxLon, width, false), y: spread(k.lat, minLat, maxLat, height, true) }))
}
