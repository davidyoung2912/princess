import { CATALOGUE_PORTS, hasSailingDays, portById, sailingById, setSailingDays, type ItineraryDay, type Port, type Sailing } from './sailings'
import { notifyCatalogue } from './catalogueServed'

/**
 * The served catalogue of ships, regions, ports, itinerary patterns and sailings (phase X0, `docs/catalogue-plan.md` sections 6 and 7), and the days of any one
 * sailing, loaded when a screen asks for them. Everything here is read from the server (`/reference/catalogue/*`, the `entries` of `/reference/sailings`
 * and `/reference/sailings/{id}/itinerary`); nothing is authored in the app. `shipOf` and `cruiseOf` answer for any sailing id, and answer with an
 * empty summary until the catalogue has arrived. Pure apart from the swaps and the change notice.
 */
export type ShipDepth = 'browse' | 'aboard'
export type DataStatus = 'served' | 'sample' | 'verified'

export interface CatalogueHighlight { title: string; body: string }

export interface ShipSummary {
  id: string
  name: string
  className: string
  depth: ShipDepth
  decks: number
  tonnage: number
  guests: number
  crew?: number
  staterooms?: number
  entered?: number
  lengthFt?: number
  intro: string
  highlights: readonly CatalogueHighlight[]
}

export interface Region { id: string; name: string }

export interface SailingLeg { leg: number; pattern: string; startDay: number }

/** One sailing of the catalogue (any ship, any length). `fromCents` is the cheapest fare per person before taxes, when the sailing has fares. */
export interface SailingEntry {
  id: string
  ship: string
  departure: string
  nights: number
  title: string
  region?: string
  startPort?: string
  endPort?: string
  legs: readonly SailingLeg[]
  holiday: boolean
  bookingOpen: boolean
  dataStatus: DataStatus
  fromCents?: number
}

export interface PatternDay { day: number; port: string; arrive?: string; allAboard?: string; depart?: string }

export interface ItineraryPattern { id: string; name: string; region: string; nights: number; startPort: string; endPort: string; description: string; days: readonly PatternDay[] }

/** What a screen shows about a cruise: the name, length, where it starts and a line about it. */
export interface CruiseSummary { id: string; name: string; nights: number; homePort: string; intro: string; region?: string; bestTime?: string }

type Rec = Record<string, unknown>
const rec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 600): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, min = 0, max = 10_000_000): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const hhmm = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const isoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const opt = (v: unknown): boolean => v === null || v === undefined

/** A served list: `{ version, items }`. All or nothing: any malformed item, or a repeated id, gives null. */
function served<T extends { id: string }>(raw: unknown, item: (r: unknown) => T | null): { version: string; items: T[] } | null {
  if (!rec(raw) || !str(raw.version, 80) || !Array.isArray(raw.items) || raw.items.length > 5000) return null
  const items = raw.items.map(item)
  if (items.some((x) => x === null)) return null
  const list = items as T[]
  if (new Set(list.map((x) => x.id)).size !== list.length) return null
  return { version: raw.version, items: list }
}

export interface Served<T> { version: string; items: T[] }

function ship(r: unknown): ShipSummary | null {
  if (!rec(r) || !str(r.id, 40) || !str(r.name, 80) || !str(r.class, 60) || !str(r.intro, 1200)) return null
  if (r.depth !== 'browse' && r.depth !== 'aboard') return null
  if (!num(r.decks, 1, 40) || !num(r.tonnage, 1) || !num(r.capacity, 1)) return null
  for (const k of ['lengthFt', 'crew', 'staterooms', 'entered'] as const) if (!opt(r[k]) && !num(r[k])) return null
  const profile = rec(r.profile) ? r.profile : {}
  const highlights = Array.isArray(profile.highlights) ? profile.highlights.filter((h): h is Rec => rec(h) && str(h.title, 120) && str(h.body, 600)).map((h) => ({ title: h.title as string, body: h.body as string })) : []
  const out: ShipSummary = { id: r.id, name: r.name, className: r.class, depth: r.depth, decks: r.decks, tonnage: r.tonnage, guests: r.capacity, intro: r.intro, highlights }
  if (typeof r.lengthFt === 'number') out.lengthFt = r.lengthFt
  if (typeof r.crew === 'number') out.crew = r.crew
  if (typeof r.staterooms === 'number') out.staterooms = r.staterooms
  if (typeof r.entered === 'number') out.entered = r.entered
  return out
}

export const normalizeShips = (raw: unknown): Served<ShipSummary> | null => served(raw, ship)

export const normalizeRegions = (raw: unknown): Served<Region> | null => served(raw, (r) => (rec(r) && str(r.id, 40) && str(r.name, 80) ? { id: r.id, name: r.name } : null))

function cataloguePort(r: unknown): Port | null {
  if (!rec(r) || !str(r.id, 40) || !str(r.name, 120) || !str(r.zone, 60) || typeof r.tender !== 'boolean') return null
  if (!opt(r.lat) && !num(r.lat, -90, 90)) return null
  if (!opt(r.lon) && !num(r.lon, -180, 180)) return null
  const p: Port = { id: r.id, name: r.name, zone: r.zone, tender: r.tender }
  if (str(r.country, 80)) p.country = r.country
  if (str(r.countryCode, 2)) p.countryCode = r.countryCode
  if (str(r.region, 40)) p.region = r.region
  if (typeof r.lat === 'number' && typeof r.lon === 'number') { p.lat = r.lat; p.lon = r.lon }
  if (str(r.currency, 8)) p.currency = r.currency
  if (Array.isArray(r.languages)) p.languages = r.languages.filter((l): l is string => str(l, 12))
  if (r.tier === 'A' || r.tier === 'B' || r.tier === 'C') p.tier = r.tier
  if (str(r.artId, 60)) p.artId = r.artId
  return p
}

export const normalizeCataloguePorts = (raw: unknown): Served<Port> | null => served(raw, cataloguePort)

function patternDay(r: unknown): PatternDay | null {
  if (!rec(r) || !num(r.day, 1, 60) || !Number.isInteger(r.day) || !str(r.port, 40)) return null
  const d: PatternDay = { day: r.day, port: r.port }
  for (const k of ['arrive', 'allAboard', 'depart'] as const) {
    if (opt(r[k])) continue
    if (!hhmm(r[k])) return null
    d[k] = r[k] as string
  }
  return d
}

function pattern(r: unknown): ItineraryPattern | null {
  if (!rec(r) || !str(r.id, 60) || !str(r.name, 120) || !str(r.region, 40) || !num(r.nights, 1, 60) || !str(r.startPort, 40) || !str(r.endPort, 40)) return null
  if (typeof r.description !== 'string' || !Array.isArray(r.days)) return null
  const days = r.days.map(patternDay)
  if (days.some((d) => d === null)) return null
  const ds = days as PatternDay[]
  if (ds.length !== r.nights + 1 || ds.some((d, i) => d.day !== i + 1)) return null
  return { id: r.id, name: r.name, region: r.region, nights: r.nights, startPort: r.startPort, endPort: r.endPort, description: r.description, days: ds }
}

export const normalizePatterns = (raw: unknown): Served<ItineraryPattern> | null => served(raw, pattern)

function entry(r: unknown): SailingEntry | null {
  if (!rec(r) || !str(r.id, 40) || !str(r.ship, 40) || !isoDate(r.departure) || !num(r.nights, 1, 60) || !Number.isInteger(r.nights) || !str(r.title, 160)) return null
  if (r.dataStatus !== 'served' && r.dataStatus !== 'sample' && r.dataStatus !== 'verified') return null
  if (typeof r.holiday !== 'boolean' || typeof r.bookingOpen !== 'boolean' || !Array.isArray(r.legs)) return null
  const legs: SailingLeg[] = []
  for (const l of r.legs) {
    if (!rec(l) || !num(l.leg, 1, 20) || !str(l.pattern, 60) || !num(l.startDay, 1, 60)) return null
    legs.push({ leg: l.leg, pattern: l.pattern, startDay: l.startDay })
  }
  const e: SailingEntry = { id: r.id, ship: r.ship, departure: r.departure, nights: r.nights, title: r.title, legs, holiday: r.holiday, bookingOpen: r.bookingOpen, dataStatus: r.dataStatus }
  if (str(r.region, 40)) e.region = r.region
  if (str(r.startPort, 40)) e.startPort = r.startPort
  if (str(r.endPort, 40)) e.endPort = r.endPort
  if (typeof r.fromCents === 'number' && num(r.fromCents)) e.fromCents = r.fromCents
  return e
}

/** The `entries` of the sailings answer. An entry that is not the expected shape is dropped; no list at all gives an empty one. */
export function normalizeEntries(raw: unknown): SailingEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SailingEntry[] = []
  for (const r of raw) {
    const e = entry(r)
    if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e) }
  }
  return out
}

/**
 * The days of one sailing, `GET /reference/sailings/{id}/itinerary`. All or nothing: the days must be numbered from 1 in order, each with a date and a port,
 * and the answer must be for the sailing asked about.
 */
export function normalizeItinerary(raw: unknown, sailingId: string): { version: string; ship: string; days: ItineraryDay[] } | null {
  if (!rec(raw) || !str(raw.version, 80) || raw.sailing !== sailingId || !str(raw.ship, 40) || !Array.isArray(raw.days) || raw.days.length < 2 || raw.days.length > 60) return null
  const days: ItineraryDay[] = []
  for (const r of raw.days) {
    if (!rec(r) || !num(r.day, 1, 60) || !Number.isInteger(r.day) || !isoDate(r.date) || !str(r.port, 40)) return null
    const d: ItineraryDay = { day: r.day, date: r.date, port: r.port }
    for (const k of ['arrive', 'allAboard', 'depart'] as const) {
      if (opt(r[k])) continue
      if (!hhmm(r[k])) return null
      d[k] = r[k] as string
    }
    if (!opt(r.shipZone)) { if (!str(r.shipZone, 60)) return null; d.zone = r.shipZone }
    days.push(d)
  }
  if (days.some((d, i) => d.day !== i + 1)) return null
  return { version: raw.version, ship: raw.ship, days }
}

// ---- the store -------------------------------------------------------------

let SHIPS: readonly ShipSummary[] = []
let REGIONS: readonly Region[] = []
let PATTERNS: readonly ItineraryPattern[] = []
let ENTRIES: readonly SailingEntry[] = []

export function setSailingEntries(entries: readonly SailingEntry[]): void { ENTRIES = entries }
export function applyShips(s: Served<ShipSummary>): void { SHIPS = s.items; notifyCatalogue() }
export function applyRegions(s: Served<Region>): void { REGIONS = s.items; notifyCatalogue() }
export function applyPatterns(s: Served<ItineraryPattern>): void { PATTERNS = s.items; notifyCatalogue() }
/** Replaces the port table in place, so earlier imports of `CATALOGUE_PORTS` see the change. */
export function applyCataloguePorts(s: Served<Port>): void {
  for (const id of Object.keys(CATALOGUE_PORTS)) delete CATALOGUE_PORTS[id]
  for (const p of s.items) CATALOGUE_PORTS[p.id] = p
  notifyCatalogue()
}

export const catalogueShips = (): readonly ShipSummary[] => SHIPS
export const catalogueRegions = (): readonly Region[] => REGIONS
export const cataloguePatterns = (): readonly ItineraryPattern[] => PATTERNS
export const catalogueSailings = (): readonly SailingEntry[] => ENTRIES

export const regionById = (id: string | undefined): Region | undefined => REGIONS.find((r) => r.id === id)
export const patternById = (id: string): ItineraryPattern | undefined => PATTERNS.find((p) => p.id === id)
export const sailingEntryOf = (sailingId: string): SailingEntry | undefined => ENTRIES.find((e) => e.id === sailingId)

/** Every sailing of the catalogue that has fares, of any ship, soonest first: what the cost, cabin and decide screens let a guest pick from. */
export const pricedSailings = (): readonly SailingEntry[] => [...ENTRIES].filter((e) => e.fromCents !== undefined).sort((a, b) => a.departure.localeCompare(b.departure) || a.id.localeCompare(b.id))

/** A sailing by id for the screens that only need its id and departure: the older table first, then the catalogue. */
export const sailingFor = (sailingId: string): Sailing | undefined => {
  const own = sailingById(sailingId)
  if (own) return own
  const e = sailingEntryOf(sailingId)
  return e ? { id: e.id, departure: e.departure, ...(e.holiday ? { holiday: true } : {}) } : undefined
}

/** What a screen gets before the catalogue has arrived: no facts, so nothing is invented. */
const NO_SHIP: ShipSummary = { id: '', name: '', className: '', depth: 'browse', decks: 0, tonnage: 0, guests: 0, intro: '', highlights: [] }

export const shipById = (id: string): ShipSummary | undefined => SHIPS.find((s) => s.id === id)

/** The ship a sailing runs on. A sailing the catalogue does not know (or a catalogue not yet loaded) gets an empty summary. */
export function shipOf(sailingId: string): ShipSummary {
  const entry = sailingEntryOf(sailingId)
  return (entry && shipById(entry.ship)) || NO_SHIP
}

/** What a screen shows about a sailing's cruise: built from its entry and the patterns of its legs. */
export function cruiseOf(sailingId: string): CruiseSummary {
  const entry = sailingEntryOf(sailingId)
  if (!entry) return { id: sailingId, name: '', nights: 0, homePort: '', intro: '' }
  const patterns = entry.legs.map((l) => patternById(l.pattern)).filter((p): p is ItineraryPattern => !!p)
  const start = entry.startPort ? portById(entry.startPort)?.name : undefined
  const intro = patterns.length > 0 ? patterns.map((p) => p.description).filter(Boolean).join(' ') : ''
  return { id: entry.id, name: entry.title, nights: entry.nights, homePort: start ?? entry.startPort ?? '', intro, ...(entry.region ? { region: entry.region } : {}) }
}

// ---- one sailing's days, on demand ----------------------------------------

type Loader = (sailingId: string) => Promise<unknown>
let loader: Loader | null = null
const inFlight = new Map<string, Promise<boolean>>()

/** What fetches a sailing's itinerary (the runtime sets it); without one nothing is loaded. */
export function setItineraryLoader(next: Loader | null): void { loader = next }

/** Loads one sailing's days (once; a second ask shares the first) and puts them in use. True when the sailing's days are in use afterwards. */
export function loadItinerary(sailingId: string): Promise<boolean> {
  if (hasSailingDays(sailingId)) return Promise.resolve(true)
  const running = inFlight.get(sailingId)
  if (running) return running
  if (!loader) return Promise.resolve(false)
  const p = loader(sailingId)
    .then((raw) => {
      const got = normalizeItinerary(raw, sailingId)
      if (!got || !setSailingDays(sailingId, got.days)) return false
      notifyCatalogue()
      return true
    })
    .catch(() => false)
    .finally(() => { inFlight.delete(sailingId) })
  inFlight.set(sailingId, p)
  return p
}
