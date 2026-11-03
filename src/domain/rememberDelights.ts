import { isCallPort, type CallPort, type Pin } from './portDelights'
import { itinerary, PORTS, type Sailing } from './sailings'
import type { DiaryEntry, Favourite } from './seaDelights'

/**
 * Small delights, phase DL9 (docs/small-delights.md): memory and return. A postcard to a future self, where I have sailed, favourites ranked from the
 * guest's own notes, lifetime nights in plain words and ports I want next. All of it is the guest's own, kept on this device and in the memory document (the record of cruises comes from the trip history on the server).
 * Nothing here books, holds or sells anything.
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// ---------------------------------------------------------------- D8-1: postcard to a future self

export const POSTCARD_MAX = 400
export const POSTCARDS_MAX = 5
/** A postcard arrives when the next trip is this many days away or closer. */
export const POSTCARD_DAYS = 60
export interface Postcard { id: string; text: string; /** When it was written, ms. */ at: number; /** The sailing it was written on; it never arrives on the same one. */ sailingId: string; read: boolean }

export function addPostcard(list: readonly Postcard[], p: Postcard): Postcard[] {
  const text = p.text.replace(/[ \t]+/g, ' ').trim().slice(0, POSTCARD_MAX)
  if (!text || list.length >= POSTCARDS_MAX || list.some((x) => x.id === p.id)) return [...list]
  return [...list, { id: clean(p.id, 40), text, at: p.at, sailingId: clean(p.sailingId, 40), read: false }]
}

/** The unread postcards to show now: written on an earlier trip, and the current trip is between today and `POSTCARD_DAYS` away. */
export function postcardsDue(list: readonly Postcard[], currentSailingId: string, daysToDeparture: number): Postcard[] {
  if (daysToDeparture < 0 || daysToDeparture > POSTCARD_DAYS) return []
  return list.filter((p) => !p.read && p.sailingId !== currentSailingId)
}
export const markPostcardRead = (list: readonly Postcard[], id: string): Postcard[] => list.map((p) => (p.id === id ? { ...p, read: true } : p))
export const removePostcard = (list: readonly Postcard[], id: string): Postcard[] => list.filter((p) => p.id !== id)

// ---------------------------------------------------------------- D8-2: where I have sailed

/** A port of call and where it is, in degrees. The server says; the app draws. */
export interface PortPlace { code: string; name: string; lat: number; lon: number }
/** A cruise on the guest's record. It comes from the trip history the server keeps, so every device and every past cruise is in it. */
export interface SailedTrip { id: string; departure: string; nights: number; ports: PortPlace[] }

const validPlace = (p: unknown): p is PortPlace => {
  const o = rec(p)
  return typeof o.code === 'string' && typeof o.name === 'string' && typeof o.lat === 'number' && typeof o.lon === 'number' && Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180
}

/** The trips that were sailed: cancelled ones are left out, and so is anything with no usable port. Oldest first. */
export function sailedTrips(trips: readonly { id: string; departure: string; nights: number; cancelled: boolean; ports?: readonly unknown[] }[]): SailedTrip[] {
  return trips
    .filter((t) => !t.cancelled)
    .map((t) => ({ id: t.id, departure: t.departure, nights: t.nights, ports: arr(t.ports).filter(validPlace) }))
    .sort((a, b) => a.departure.localeCompare(b.departure))
}

export interface SailedSummary { trips: number; nights: number; ports: { place: PortPlace; visits: number }[] }
export function sailedSummary(trips: readonly SailedTrip[]): SailedSummary {
  const seen = new Map<string, { place: PortPlace; visits: number }>()
  for (const t of trips) for (const p of new Map(t.ports.map((x) => [x.code, x])).values()) {
    const e = seen.get(p.code)
    if (e) e.visits += 1
    else seen.set(p.code, { place: p, visits: 1 })
  }
  return { trips: trips.length, nights: trips.reduce((n, t) => n + t.nights, 0), ports: [...seen.values()].sort((a, b) => b.visits - a.visits || a.place.name.localeCompare(b.place.name)) }
}

export interface MapPin { code: string; name: string; x: number; y: number; visits: number }
export interface MapView { /** SVG viewBox over the 360 by 180 world (x = longitude + 180, y = 90 - latitude). */ viewBox: string; /** Width of the view in degrees; sizes the pins and labels. */ span: number; pins: MapPin[] }
export const MAP_MIN_SPAN = 24

/** Frames the world around the ports with some room, never tighter than `MAP_MIN_SPAN` degrees across and never beyond the world. */
export function mapView(ports: readonly { place: PortPlace; visits: number }[]): MapView {
  const pins = ports.map(({ place, visits }) => ({ code: place.code, name: place.name, x: place.lon + 180, y: 90 - place.lat, visits }))
  if (pins.length === 0) return { viewBox: '0 0 360 180', span: 360, pins }
  const xs = pins.map((p) => p.x)
  const ys = pins.map((p) => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  // Room for the labels: widen by half again, and keep the 2 to 1 shape of the world.
  const span = Math.min(360, Math.max(MAP_MIN_SPAN, (Math.max(...xs) - Math.min(...xs)) * 1.5, (Math.max(...ys) - Math.min(...ys)) * 3))
  const h = span / 2
  const x = Math.max(0, Math.min(360 - span, cx - span / 2))
  const y = Math.max(0, Math.min(180 - h, cy - h / 2))
  const r = (n: number) => Math.round(n * 100) / 100
  return { viewBox: `${r(x)} ${r(y)} ${r(span)} ${r(h)}`, span: r(span), pins }
}

// ---------------------------------------------------------------- D8-3: favourites ranked

export type RankKind = 'venue' | 'drink' | 'port'
export interface Ranked { kind: RankKind; id: string; label: string; score: number }

/** The guest's own picks, best first: places with the most hearted dishes, drinks marked as liked, and ports with the most pinned spots. Ties keep the first one added. */
export function rankedFavourites(i: { favourites: readonly Favourite[]; diary: readonly DiaryEntry[]; pins: readonly Pin[]; venueName: (id: string) => string; portName: (p: CallPort) => string }): Ranked[] {
  const venues = new Map<string, number>()
  for (const f of i.favourites) venues.set(f.venueId, (venues.get(f.venueId) ?? 0) + 1)
  const ports = new Map<CallPort, number>()
  for (const p of i.pins) ports.set(p.port, (ports.get(p.port) ?? 0) + 1)
  const drinks = new Map<string, number>()
  for (const d of i.diary) if (d.verdict === 'liked') drinks.set(d.name, (drinks.get(d.name) ?? 0) + 1)
  const byScore = (a: Ranked, b: Ranked) => b.score - a.score
  return [
    ...[...venues].map(([id, score]): Ranked => ({ kind: 'venue', id, label: i.venueName(id), score })).sort(byScore),
    ...[...drinks].map(([id, score]): Ranked => ({ kind: 'drink', id, label: id, score })).sort(byScore),
    ...[...ports].map(([id, score]): Ranked => ({ kind: 'port', id, label: i.portName(id), score })).sort(byScore),
  ]
}

// ---------------------------------------------------------------- D8-5: nights at sea

export interface Lifetime { nights: number; ports: number }
/** Lifetime nights and different ports across the cruises on the guest's record. */
export const lifetime = (trips: readonly SailedTrip[]): Lifetime => { const s = sailedSummary(trips); return { nights: s.nights, ports: s.ports.length } }

// ---------------------------------------------------------------- D8-7: ports I want next

export const WANTS_MAX = 8
export const WANT_LEN = 40
export function addWant(list: readonly string[], text: string): string[] {
  const w = clean(text, WANT_LEN)
  if (!w || list.length >= WANTS_MAX || list.some((x) => x.toLowerCase() === w.toLowerCase())) return [...list]
  return [...list, w]
}
export const removeWant = (list: readonly string[], text: string): string[] => list.filter((x) => x !== text)

const fold = (v: string): string => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const SKIP_WORDS = new Set(['city', 'port', 'fort', 'the', 'and', 'island', 'bay', 'san', 'santa', 'new'])

/** The places a sailing calls at: each port of call once, in the order of the cruise, as the guest reads them ("Cozumel, Mexico"). */
export function callPlaces(s: Sailing): string[] {
  return [...new Set(itinerary(s).flatMap((d) => (isCallPort(d.port) ? [PORTS[d.port].name] : [])))]
}

/** Which of the places a guest wants are on a route: a want matches when it is inside a place name ("cozumel") or when it names a word of one ("a week in Mexico"). Accents and case do not matter. */
export function wantMatches(wants: readonly string[], places: readonly string[]): { want: string; place: string }[] {
  const out: { want: string; place: string }[] = []
  for (const want of wants) {
    const w = fold(want).trim()
    if (w.length < 3) continue
    const words = w.split(/[^a-z0-9]+/).filter((x) => x.length >= 4 && !SKIP_WORDS.has(x))
    const place = places.find((p) => {
      const f = fold(p)
      const tokens = f.split(/[^a-z0-9]+/).filter((x) => x.length >= 4 && !SKIP_WORDS.has(x))
      return f.includes(w) || tokens.some((tk) => words.includes(tk))
    })
    if (place) out.push({ want, place })
  }
  return out
}

// ---------------------------------------------------------------- state

export interface RememberState { postcards: Postcard[]; wants: string[] }
export const EMPTY_REMEMBER: RememberState = { postcards: [], wants: [] }

export function normalizeRemember(raw: unknown): RememberState {
  const r = rec(raw)
  const postcards = arr(r.postcards).reduce<Postcard[]>((acc, x) => {
    const o = rec(x)
    if (typeof o.id !== 'string' || typeof o.text !== 'string') return acc
    const next = addPostcard(acc, { id: o.id, text: o.text, at: num(o.at), sailingId: typeof o.sailingId === 'string' ? o.sailingId : '', read: false })
    return next.map((p) => (p.id === o.id && o.read === true ? { ...p, read: true } : p))
  }, [])
  const wants = arr(r.wants).reduce<string[]>((acc, x) => (typeof x === 'string' ? addWant(acc, x) : acc), [])
  return { postcards, wants }
}
