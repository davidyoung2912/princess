import { isCallPort, type CallPort, type Pin } from './portDelights'
import { itinerary, sailingNights, type Sailing } from './sailings'
import type { DiaryEntry, Favourite } from './seaDelights'

/**
 * Small delights, phase DL9 (docs/small-delights.md): memory and return. A postcard to a future self, where I have sailed, favourites ranked from the
 * guest's own notes, lifetime nights in plain words and ports I want next. All of it is the guest's own, kept on this device and in the memory document.
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

export interface Voyage { sailingId: string; departure: string; nights: number; ports: CallPort[] }

export function voyageOf(s: Sailing): Voyage {
  const ports = [...new Set(itinerary(s).flatMap((d) => (isCallPort(d.port) ? [d.port] : [])))]
  return { sailingId: s.id, departure: s.departure, nights: sailingNights(s), ports }
}

/** Whether the ship has finished the sailing by `today` (a ship date), so the trip is ready to keep in the record. */
export const voyageDone = (s: Sailing, today: string): boolean => {
  const days = itinerary(s)
  return today >= days[days.length - 1].date
}

export function keepVoyage(list: readonly Voyage[], v: Voyage): Voyage[] {
  return v.sailingId && !list.some((x) => x.sailingId === v.sailingId) ? [...list, v].sort((a, b) => a.departure.localeCompare(b.departure)) : [...list]
}
export const VOYAGES_MAX = 60

export interface SailedSummary { trips: number; nights: number; ports: { port: CallPort; visits: number }[] }
export function sailedSummary(voyages: readonly Voyage[]): SailedSummary {
  const counts = new Map<CallPort, number>()
  for (const v of voyages) for (const p of v.ports) counts.set(p, (counts.get(p) ?? 0) + 1)
  return {
    trips: voyages.length,
    nights: voyages.reduce((n, v) => n + v.nights, 0),
    ports: [...counts].map(([port, visits]) => ({ port, visits })).sort((a, b) => b.visits - a.visits || a.port.localeCompare(b.port)),
  }
}

/** Where each port sits on a 100 by 60 sketch of the western Caribbean (authored, approximate). */
export const MAP_SPOTS: Record<CallPort | 'fll', { x: number; y: number }> = {
  fll: { x: 80, y: 6 },
  cozumel: { x: 31, y: 33 },
  belize: { x: 10, y: 47 },
  roatan: { x: 34, y: 53 },
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

export interface Lifetime { days: number; ports: number }
/** Lifetime cruise days from the loyalty record and the different ports from the guest's own record (this trip included once it is kept). */
export const lifetime = (loyaltyDays: number, voyages: readonly Voyage[]): Lifetime => ({ days: Math.max(0, Math.round(loyaltyDays)), ports: sailedSummary(voyages).ports.length })

// ---------------------------------------------------------------- D8-7: ports I want next

export const WANTS_MAX = 8
export const WANT_LEN = 40
export function addWant(list: readonly string[], text: string): string[] {
  const w = clean(text, WANT_LEN)
  if (!w || list.length >= WANTS_MAX || list.some((x) => x.toLowerCase() === w.toLowerCase())) return [...list]
  return [...list, w]
}
export const removeWant = (list: readonly string[], text: string): string[] => list.filter((x) => x !== text)

// ---------------------------------------------------------------- state

export interface RememberState { postcards: Postcard[]; voyages: Voyage[]; wants: string[] }
export const EMPTY_REMEMBER: RememberState = { postcards: [], voyages: [], wants: [] }

export function normalizeRemember(raw: unknown): RememberState {
  const r = rec(raw)
  const postcards = arr(r.postcards).reduce<Postcard[]>((acc, x) => {
    const o = rec(x)
    if (typeof o.id !== 'string' || typeof o.text !== 'string') return acc
    const next = addPostcard(acc, { id: o.id, text: o.text, at: num(o.at), sailingId: typeof o.sailingId === 'string' ? o.sailingId : '', read: false })
    return next.map((p) => (p.id === o.id && o.read === true ? { ...p, read: true } : p))
  }, [])
  const voyages = arr(r.voyages).reduce<Voyage[]>((acc, x) => {
    const o = rec(x)
    if (typeof o.sailingId !== 'string' || typeof o.departure !== 'string' || acc.length >= VOYAGES_MAX) return acc
    const ports = [...new Set(arr(o.ports).filter(isCallPort))]
    return keepVoyage(acc, { sailingId: o.sailingId.slice(0, 40), departure: o.departure.slice(0, 10), nights: Math.max(0, Math.min(60, Math.round(num(o.nights)))), ports })
  }, [])
  const wants = arr(r.wants).reduce<string[]>((acc, x) => (typeof x === 'string' ? addWant(acc, x) : acc), [])
  return { postcards, voyages, wants }
}
