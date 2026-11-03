import { routeForPath } from './nav'
import type { JourneyStage } from './hubs'
import { accessAt } from './stageNav'
import { screenForPath, type ScreenDef } from './screens'

/** The last screens a guest visited, newest first, kept on the server (`recent`) so any device can pick up from them (docs/returning-home-plan.md). */
export interface RecentItem { path: string; at: number }
export interface RecentState { items: RecentItem[] }

export const EMPTY_RECENT: RecentState = { items: [] }
export const MAX_RECENT = 3
export const MAX_RECENT_PATH = 200

/** Screens that are never worth returning to: Home itself, search and settings. (Sign-in is not a named screen.) */
const LEFT_OUT: readonly string[] = ['/', '/ship/search', '/me/settings']

/** An app address and nothing else: one leading slash, no `//`, no `:` before the query, no backslash or control characters. Mirrors the server's check. */
export function isSafePath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_RECENT_PATH) return false
  if (path[0] !== '/' || path.includes('//') || path.includes('\\')) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  const q = path.indexOf('?')
  return !(q < 0 ? path : path.slice(0, q)).includes(':')
}

/** Reads a stored or server document safely: bad rows are dropped, duplicates keep the newest, newest first, at most three. */
export function normalizeRecent(raw: unknown): RecentState {
  const rows = raw && typeof raw === 'object' ? (raw as { items?: unknown }).items : null
  if (!Array.isArray(rows)) return EMPTY_RECENT
  const items: RecentItem[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const { path, at } = r as { path?: unknown; at?: unknown }
    if (isSafePath(path) && typeof at === 'number' && Number.isFinite(at)) items.push({ path, at })
  }
  return { items: top(items) }
}

function top(items: RecentItem[]): RecentItem[] {
  const seen = new Set<string>()
  return [...items].sort((a, b) => b.at - a.at).filter((i) => !seen.has(i.path) && !!seen.add(i.path)).slice(0, MAX_RECENT)
}

/** The path of a visited address that counts (a named screen other than Home, search and settings), query dropped, or null. */
export function recentPathFor(address: string): string | null {
  const pathname = address.split(/[?#]/)[0]
  if (LEFT_OUT.includes(pathname)) return null
  const route = routeForPath(pathname)
  if (!route || route.public || !screenForPath(route.path)) return null
  return isSafePath(pathname) ? pathname : null
}

/** Adds a visit: it moves to the front (once), the list stays at three. Unchanged when the address does not count or is already first. */
export function withVisit(state: RecentState, address: string, now: number): RecentState {
  const path = recentPathFor(address)
  if (!path || state.items[0]?.path === path) return state
  return { items: top([{ path, at: now }, ...state.items.filter((i) => i.path !== path)]) }
}

/** Both devices visited screens: keep the newest three of either. */
export function mergeRecent(remote: unknown, local: unknown): RecentState {
  return { items: top([...normalizeRecent(remote).items, ...normalizeRecent(local).items]) }
}

export interface RecentRow { path: string; at: number; screen: ScreenDef }

/** The rows Home shows: those that still resolve to a screen the guest's stage uses. */
export function visibleRecent(state: RecentState, stage: JourneyStage): RecentRow[] {
  const rows: RecentRow[] = []
  for (const { path, at } of state.items) {
    const route = routeForPath(path)
    const screen = route ? screenForPath(route.path) : undefined
    if (route && screen && accessAt(route.path, path, stage) === 'show') rows.push({ path, at, screen })
  }
  return rows
}

export type RelativeTime = { kind: 'now' } | { kind: 'today' } | { kind: 'yesterday' } | { kind: 'days'; n: number } | { kind: 'older' }

/** How long ago, in calendar days of the given clock (the caller passes the server's now). Words come from the locale files in R3. */
export function relativeTime(at: number, now: number): RelativeTime {
  if (now - at < 60_000) return { kind: 'now' }
  const day = (ms: number) => { const d = new Date(ms); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) }
  const n = day(now) - day(at)
  if (n <= 0) return { kind: 'today' }
  if (n === 1) return { kind: 'yesterday' }
  return n <= 30 ? { kind: 'days', n } : { kind: 'older' }
}
