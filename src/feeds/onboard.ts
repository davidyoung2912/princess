import { FOUND, loungerOthers, LOUNGERS, seenToday, SPECIES, type FoundItem, type LoungerOther } from '../domain/aboardMore'
import { simulatedOpening, type Watch } from '../domain/autopilot'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const LOUNGER_STATES = ['free', 'held', 'overdue'] as const
const PLACES = ['guest-services', 'eatery', 'lido-pool'] as const

/** Reads the server's loungers: one row for each of the eight, in order, each free, held (with minutes) or left too long. */
export function normalizeLoungers(raw: unknown): LoungerOther[] | null {
  const rows = isRecord(raw) ? raw.loungers : null
  if (!Array.isArray(rows) || rows.length !== LOUNGERS) return null
  const out: LoungerOther[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!isRecord(r) || r.id !== i + 1 || !oneOf(r.state, LOUNGER_STATES)) return null
    if (r.state === 'held') {
      if (!isInt(r.returnsIn, 1, 45)) return null
      out.push({ id: i + 1, state: 'held', returnsIn: r.returnsIn })
    } else {
      if (r.returnsIn !== null && r.returnsIn !== undefined) return null
      out.push({ id: i + 1, state: r.state, returnsIn: null })
    }
  }
  return out
}

/** The other loungers at a whole minute. */
export const loungerFeed = createFeed<[minute: number], LoungerOther[]>((m) => String(m), (m) => loungerOthers(m * 60_000), normalizeLoungers)

/** Reads the lost-property list: a few items, each with an id, a name, match words and where it is held. */
export function normalizeFound(raw: unknown): FoundItem[] | null {
  const items = isRecord(raw) ? raw.items : null
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return null
  const out: FoundItem[] = []
  for (const i of items) {
    if (!isRecord(i) || typeof i.id !== 'string' || typeof i.what !== 'string' || i.what.length === 0 || i.what.length > 80 || !oneOf(i.at, PLACES)) return null
    if (!Array.isArray(i.keywords) || i.keywords.length === 0 || i.keywords.length > 12 || !i.keywords.every((k) => typeof k === 'string' && k.length > 0 && k.length < 24)) return null
    out.push({ id: i.id, what: i.what, keywords: i.keywords as string[], at: i.at })
  }
  return out
}

/** What the lost-property desk has handed in. */
export const foundFeed = createFeed<[], FoundItem[]>(() => 'all', () => [...FOUND], normalizeFound)

/** Reads the kinds of wildlife the ship is said to have seen on a day: one or two known kinds. */
export function normalizeSightings(raw: unknown): string[] | null {
  const list = isRecord(raw) ? raw.species : null
  if (!Array.isArray(list) || list.length < 1 || list.length > SPECIES.length || !list.every((s) => oneOf(s, SPECIES)) || new Set(list).size !== list.length) return null
  return list as string[]
}

export const sightingsFeed = createFeed<[day: number], string[]>((d) => String(d), (d) => seenToday(d), normalizeSightings)

/** When a place opens for a slot watch (or never, before the slot). */
export interface Opening { opensAt: number | null }
export function normalizeOpening(raw: unknown): Opening | null {
  if (!isRecord(raw)) return null
  if (raw.opensAt === null) return { opensAt: null }
  return typeof raw.opensAt === 'number' && Number.isFinite(raw.opensAt) && raw.opensAt > 0 ? { opensAt: raw.opensAt } : null
}

type WatchTimes = Pick<Watch, 'id' | 'createdAt' | 'slotAt'>
export const openingFeed = createFeed<[id: string, createdAt: number, slotAt: number], Opening>(
  (id, c, s) => `${id}|${c}|${s}`,
  (id, c, s) => ({ opensAt: simulatedOpening({ id, createdAt: c, slotAt: s }) }),
  normalizeOpening,
)

/** The opening for each watch, looked up from the feed. */
export const openingArgs = (w: WatchTimes): [string, number, number] => [w.id, w.createdAt, w.slotAt]
