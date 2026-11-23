import { deviceStore } from '../data/deviceStorage'

/**
 * What a player last chose in a game (opponent, board size, side) and how they have done against each opponent. Per device, never sent anywhere; a blocked or unreadable store just means
 * the defaults and an empty record.
 */
const PREFS = 'princess.gamePrefs'
const RECORDS = 'princess.gameRecords'

export type Outcome = 'win' | 'loss' | 'draw'
export interface Record { w: number; l: number; d: number; /** The best (lowest) score of the game's own measure, such as moves. */ best?: number }

function load(key: string): Record_<unknown> {
  try {
    const data: unknown = JSON.parse(deviceStore()?.getItem(key) ?? '{}')
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record_<unknown>) : {}
  } catch { return {} }
}
type Record_<T> = { [k: string]: T }
const save = (key: string, value: unknown) => { try { deviceStore()?.setItem(key, JSON.stringify(value)) } catch { /* full or blocked: carry on without saving */ } }

/** The saved choice, if it is one of `allowed`. */
export function readPref<T extends string>(game: string, name: string, allowed: readonly T[], fallback: T): T {
  const v = load(PREFS)[`${game}.${name}`]
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}
export function writePref(game: string, name: string, value: string): void {
  const all = load(PREFS)
  all[`${game}.${name}`] = value
  save(PREFS, all)
}

const clean = (v: unknown): Record => {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<Record>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)
  return { w: n(r.w), l: n(r.l), d: n(r.d), ...(typeof r.best === 'number' && r.best > 0 ? { best: r.best } : {}) }
}
export const readRecord = (game: string, key: string): Record => clean(load(RECORDS)[`${game}.${key}`])

/** Adds one finished game to the record for `key` (an opponent, or a size) and returns the new record. `score` is a measure where lower is better, such as moves. */
export function addResult(game: string, key: string, outcome: Outcome, score?: number): Record {
  const all = load(RECORDS)
  const r = clean(all[`${game}.${key}`])
  if (outcome === 'win') r.w++
  else if (outcome === 'loss') r.l++
  else r.d++
  if (outcome === 'win' && score !== undefined && score > 0 && (r.best === undefined || score < r.best)) r.best = score
  all[`${game}.${key}`] = r
  save(RECORDS, all)
  return r
}

/** After three wins and no losses at the lowest opponent, suggest the next one. */
export const readyForNext = (r: Record): boolean => r.w >= 3 && r.l === 0
