import { JOURNEY_STAGES, type JourneyStage } from './hubs'
import { MAX_WELCOME_SAILING_ID, welcomeContent, welcomeKey } from './stageWelcome'

/**
 * Which steps of a stage's welcome page a guest has opened. Some steps are done by the data (paid, documents in order, checked in); the rest are done by going
 * to the screen they point at, which is what this remembers. It is one small document on the server (`stageProgress`), so it follows the guest across devices.
 * Framework-free so it is tested in node.
 */
export interface StageProgressState { visited: Record<string, number> }

export const EMPTY_PROGRESS: StageProgressState = { visited: {} }

/** Mirrors the server's limits (StateRules.StageProgressMaxEntries and StageProgressMaxStep). */
export const MAX_PROGRESS_ENTRIES = 300
export const MAX_PROGRESS_STEP = 9

const SAILING_ID = /^[A-Za-z0-9._-]+$/
const isStage = (s: string): boolean => (JOURNEY_STAGES as readonly string[]).includes(s)

/** What a visit is remembered under: the stage (and sailing, from Manage on) as for the welcome, then `#` and the step number from 1. */
export const progressKey = (stage: JourneyStage, sailingId: string | null | undefined, step: number): string => `${welcomeKey(stage, sailingId)}#${step}`

function validKey(key: string): boolean {
  const hash = key.lastIndexOf('#')
  if (hash < 0) return false
  const step = Number(key.slice(hash + 1))
  if (!Number.isInteger(step) || step < 1 || step > MAX_PROGRESS_STEP || key.slice(hash + 1).length !== 1) return false
  const base = key.slice(0, hash)
  const colon = base.indexOf(':')
  if (colon < 0) return isStage(base)
  const sailing = base.slice(colon + 1)
  return isStage(base.slice(0, colon)) && sailing.length > 0 && sailing.length <= MAX_WELCOME_SAILING_ID && SAILING_ID.test(sailing)
}

/** The newest entries, at most the server's limit. */
function newest(visited: Record<string, number>): Record<string, number> {
  const entries = Object.entries(visited)
  if (entries.length <= MAX_PROGRESS_ENTRIES) return visited
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_PROGRESS_ENTRIES))
}

/** Reads a stored or server document safely: odd keys and non-numbers are dropped. */
export function normalizeProgress(raw: unknown): StageProgressState {
  const rows = raw && typeof raw === 'object' ? (raw as { visited?: unknown }).visited : null
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return EMPTY_PROGRESS
  const visited: Record<string, number> = {}
  for (const [key, at] of Object.entries(rows)) if (validKey(key) && typeof at === 'number' && Number.isFinite(at)) visited[key] = at
  return Object.keys(visited).length === 0 ? EMPTY_PROGRESS : { visited: newest(visited) }
}

/** Both devices recorded visits: keep every one, the earliest time for a step both saw. */
export function mergeProgress(remote: unknown, local: unknown): StageProgressState {
  const visited: Record<string, number> = { ...normalizeProgress(remote).visited }
  for (const [key, at] of Object.entries(normalizeProgress(local).visited)) visited[key] = key in visited ? Math.min(visited[key], at) : at
  return Object.keys(visited).length === 0 ? EMPTY_PROGRESS : { visited: newest(visited) }
}

/** Records a visit. The same state comes back when it was recorded already (so nothing is saved twice). */
export function markVisited(state: StageProgressState, key: string, now: number): StageProgressState {
  if (key in state.visited || !validKey(key)) return state
  return { visited: newest({ ...state.visited, [key]: now }) }
}

/**
 * Addresses that count as visiting a step, where its link alone is not enough: a step whose link depends on the guest's data (resume the draft, pay this trip), or that
 * can be reached two ways. A pattern matches itself and any screen under it; one ending in `$` matches only itself. A step not listed here counts for its own link.
 */
const STEP_ADDRESSES: Partial<Record<JourneyStage, readonly (readonly string[])[]>> = {
  book: [['/book$', '/book/resume'], ['/book/pay'], ['/plan/party']],
  manage: [['/book/pay', '/me/payments'], ['/me/documents'], ['/plan/readiness']],
  getToShip: [['/home/check-in', '/home/boarding-pass'], ['/plan/getting-there'], ['/me/documents']],
}

const matches = (path: string, pattern: string): boolean => pattern.endsWith('$') ? path === pattern.slice(0, -1) : path === pattern || path.startsWith(`${pattern}/`)

/** The steps (from 1) of a stage that the screen at this address is the way to. A step's screen counts for its own address and anything under it. */
export function stepsAt(stage: JourneyStage, pathname: string): number[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const listed = STEP_ADDRESSES[stage]
  const out: number[] = []
  welcomeContent(stage).steps.forEach((s, i) => { if ((listed?.[i] ?? [s.to]).some((p) => matches(path, p))) out.push(i + 1) })
  return out.filter((n) => n <= MAX_PROGRESS_STEP)
}

/** Whether a step has been visited. */
export const wasVisited = (state: StageProgressState, stage: JourneyStage, sailingId: string | null | undefined, step: number): boolean => progressKey(stage, sailingId, step) in state.visited
