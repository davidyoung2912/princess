import { FARES, FARE_IDS, type Fare } from './fares'
import { replacePricing } from './pricing'
import { notifyCatalogue } from './catalogueServed'

/**
 * The fare tables from the server (`GET /reference/pricing`): the interior fare by sailing, next season's departures, taxes and fees, the nightly
 * gratuities and the fares. The client estimates over them (the rules stay here); real quotes are still worked out by the server. No authored copy
 * is kept: the app waits for the table, and the last answer is kept on the device as a cache.
 */
export interface ServedPricing {
  version: string
  interior: Record<string, number>
  nextSeason: { id: string; departure: string; fare: number }[]
  taxesAndFees: number
  gratuityPerNight: number
  gratuityPerNightSuite: number
  fares: Fare[]
}

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const cents = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000_000
const ID = /^[a-z0-9-]{1,40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads the server's answer, all or nothing. */
export function normalizePricing(raw: unknown): ServedPricing | null {
  if (!rec(raw) || !str(raw.version, 80) || !rec(raw.interior) || !Array.isArray(raw.nextSeason) || !Array.isArray(raw.fares)) return null
  if (!cents(raw.taxesAndFees) || !cents(raw.gratuityPerNight) || !cents(raw.gratuityPerNightSuite)) return null
  const interior: Record<string, number> = {}
  for (const [id, fare] of Object.entries(raw.interior)) {
    if (!ID.test(id) || !cents(fare) || fare === 0) return null
    interior[id] = fare
  }
  if (Object.keys(interior).length === 0) return null
  const nextSeason: ServedPricing['nextSeason'] = []
  for (const n of raw.nextSeason) {
    if (!rec(n) || !str(n.id, 40) || !ID.test(n.id) || !str(n.departure, 10) || !DATE.test(n.departure) || !cents(n.fare) || n.fare === 0 || n.id in interior) return null
    nextSeason.push({ id: n.id, departure: n.departure, fare: n.fare })
  }
  const fares: Fare[] = []
  for (const f of raw.fares) {
    if (!rec(f) || !(FARE_IDS as readonly unknown[]).includes(f.id) || !str(f.name, 80) || !cents(f.perNight) || !str(f.tagline, 300)) return null
    fares.push({ id: f.id as Fare['id'], name: f.name, perNight: f.perNight, tagline: f.tagline })
  }
  if (fares.length !== FARE_IDS.length || new Set(fares.map((f) => f.id)).size !== fares.length) return null
  return { version: raw.version, interior, nextSeason, taxesAndFees: raw.taxesAndFees, gratuityPerNight: raw.gratuityPerNight, gratuityPerNightSuite: raw.gratuityPerNightSuite, fares }
}

/** Puts the served tables in use and tells the screens. */
export function applyPricing(p: ServedPricing): void {
  replacePricing({ interior: p.interior, nextSeason: p.nextSeason, taxesAndFees: p.taxesAndFees, gratuityPerNight: p.gratuityPerNight, gratuityPerNightSuite: p.gratuityPerNightSuite })
  for (const f of p.fares) Object.assign(FARES[f.id], f)
  notifyCatalogue()
}
