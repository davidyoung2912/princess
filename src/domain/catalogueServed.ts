import { ACTIVITIES, INTERESTS, replaceExcursions, type ExcursionItem, type ExcursionPort } from './excursions'
import { replaceVenueTerms, type VenueTerms } from './dining'

/**
 * The catalogue from the server (multi-device plan 2, Phase 4): the server is the source of truth, the authored copies in `excursions.ts` and
 * `dining.ts` are what a screen shows before its answer comes, without a server, and when it cannot be read. Pure apart from the swap and the
 * change notice, which lets screens that list the catalogue draw again (`useCatalogue`).
 */
export interface ServedCatalogue { excursions: ExcursionItem[]; venues: VenueTerms[] }

const PORTS: readonly string[] = ['cozumel', 'belize', 'roatan']
const KINDS: readonly string[] = ['main', 'specialty', 'casual']
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 600): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

function excursion(raw: unknown): ExcursionItem | null {
  if (!rec(raw)) return null
  const r = raw
  if (!str(r.id, 40) || !str(r.port, 20) || !PORTS.includes(r.port) || !str(r.name, 120) || !str(r.summary) || !num(r.hours, 0.25, 24) || !num(r.price, 0, 10_000_000)) return null
  if (!(ACTIVITIES as readonly unknown[]).includes(r.activity) || typeof r.wheelchair !== 'boolean' || typeof r.family !== 'boolean') return null
  if (!Array.isArray(r.interests) || !r.interests.every((i) => (INTERESTS as readonly unknown[]).includes(i))) return null
  if (!num(r.rating, 0, 5) || !num(r.reviews, 0, 1_000_000) || !str(r.meeting, 200) || typeof r.start !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start) || !num(r.capacity, 1, 10_000)) return null
  return { id: r.id, port: r.port as ExcursionPort, name: r.name, summary: r.summary, hours: r.hours, price: r.price, activity: r.activity as ExcursionItem['activity'], wheelchair: r.wheelchair, family: r.family, interests: r.interests as ExcursionItem['interests'], rating: r.rating, reviews: r.reviews, meeting: r.meeting, start: r.start, capacity: r.capacity }
}

function venue(raw: unknown): VenueTerms | null {
  if (!rec(raw)) return null
  const r = raw
  if (!str(r.id, 40) || !str(r.name, 120) || !str(r.kind, 20) || !KINDS.includes(r.kind) || !num(r.cover, 0, 1_000_000) || typeof r.walkIn !== 'boolean') return null
  return { id: r.id, name: r.name, kind: r.kind as VenueTerms['kind'], cover: r.cover, walkIn: r.walkIn }
}

/** Reads the server's answer; an entry that is not the expected shape is dropped, and an answer with no usable excursions gives null (the authored copy stays). */
export function normalizeCatalogue(raw: unknown): ServedCatalogue | null {
  if (!rec(raw) || !Array.isArray(raw.excursions) || !Array.isArray(raw.venues)) return null
  const excursions = raw.excursions.map(excursion).filter((x): x is ExcursionItem => x !== null)
  const venues = raw.venues.map(venue).filter((x): x is VenueTerms => x !== null)
  return excursions.length === 0 ? null : { excursions, venues }
}

let version = 0
const listeners = new Set<() => void>()
export const catalogueVersion = (): number => version
export const subscribeCatalogue = (f: () => void): (() => void) => { listeners.add(f); return () => { listeners.delete(f) } }

/** Puts the server's catalogue in use (or the authored one back, with `null`) and tells the screens. */
export function applyCatalogue(c: ServedCatalogue | null): void {
  replaceExcursions(c?.excursions ?? null)
  replaceVenueTerms(c?.venues ?? null)
  version++
  for (const f of [...listeners]) f()
}
