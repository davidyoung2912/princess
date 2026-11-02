import { APP_PREFIX } from '../data/lifecycle'
import { DEFAULT_PREFS, isPace, normalizeWatches, type Watch, type WeekPrefs } from '../domain/autopilot'
import { EMPTY_CALM, normalizeCalm, type CalmState } from '../domain/calm'
import { INTERESTS, type Interest } from '../domain/excursions'
import { EVENT_INTERESTS, type EventInterest } from '../domain/program'
import { isHhmm, type Change, type Edit, type PlanEntry } from '../domain/planChange'

/** Everything Phase H5 keeps on this device for one person: plan changes and their log, slot watches, week preferences, and the inclusion settings. */
export interface PilotState { changes: Change[]; watches: Watch[]; prefs: WeekPrefs; gentle: boolean; calm: CalmState }
export const EMPTY_PILOT: PilotState = { changes: [], watches: [], prefs: DEFAULT_PREFS, gentle: false, calm: EMPTY_CALM }

const KINDS = ['tour', 'event', 'dinner', 'added']
const STATUSES = ['proposed', 'accepted', 'declined', 'undone']

const entryOf = (raw: unknown): PlanEntry | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.title !== 'string' || !isHhmm(o.start) || typeof o.minutes !== 'number' || !(o.minutes > 0) || !KINDS.includes(o.kind as string)) return null
  return { id: o.id, title: o.title.slice(0, 120), start: o.start, minutes: Math.min(1440, o.minutes), kind: o.kind as PlanEntry['kind'], placeId: typeof o.placeId === 'string' ? o.placeId : undefined, outdoor: o.outdoor === true, path: typeof o.path === 'string' && o.path.startsWith('/') ? o.path : '/plan' }
}

const editOf = (raw: unknown): Edit | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.op === 'drop' && typeof o.id === 'string') return { op: 'drop', id: o.id }
  if (o.op === 'move' && typeof o.id === 'string' && isHhmm(o.to)) return { op: 'move', id: o.id, to: o.to }
  if (o.op === 'add') { const e = entryOf(o.entry); return e ? { op: 'add', entry: e } : null }
  return null
}

export function normalizeChanges(raw: unknown): Change[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r): Change[] => {
    if (!r || typeof r !== 'object') return []
    const o = r as Record<string, unknown>
    if (typeof o.id !== 'string' || !Number.isInteger(o.day) || (o.day as number) < 1 || (o.day as number) > 8 || typeof o.title !== 'string' || !STATUSES.includes(o.status as string) || (o.source !== 'autopilot' && o.source !== 'assistant')) return []
    if (typeof o.proposedAt !== 'number' || typeof o.undoUntil !== 'number' || !Array.isArray(o.edits)) return []
    const edits = o.edits.map(editOf)
    if (edits.some((e) => e === null)) return []
    return [{
      id: o.id, day: o.day as number, source: o.source, cause: typeof o.cause === 'string' ? o.cause.slice(0, 160) : '', title: o.title.slice(0, 160), why: typeof o.why === 'string' ? o.why.slice(0, 400) : '',
      edits: edits as Edit[], warning: typeof o.warning === 'string' ? o.warning.slice(0, 300) : undefined, status: o.status as Change['status'], proposedAt: o.proposedAt,
      decidedAt: typeof o.decidedAt === 'number' ? o.decidedAt : undefined, undoUntil: o.undoUntil,
    }]
  })
}

export function normalizePrefs(raw: unknown): WeekPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const list = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? v.filter((x): x is T => allowed.includes(x as T)) : [])
  return {
    pace: isPace(o.pace) ? o.pace : DEFAULT_PREFS.pace,
    mobility: o.mobility === 'easy' || o.mobility === 'wheelchair' ? o.mobility : 'any',
    withKids: o.withKids === true,
    tours: list<Interest>(o.tours, INTERESTS),
    events: list<EventInterest>(o.events, EVENT_INTERESTS),
    maxTour: typeof o.maxTour === 'number' && o.maxTour > 0 ? o.maxTour : null,
    noEarly: o.noEarly === true,
  }
}

export const normalizePilot = (raw: unknown): PilotState => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PILOT
  const r = raw as Record<string, unknown>
  return { changes: normalizeChanges(r.changes), watches: normalizeWatches(r.watches), prefs: normalizePrefs(r.prefs), gentle: r.gentle === true, calm: normalizeCalm(r.calm) }
}

export const pilotKeyFor = (personaId: string | null): string => `${APP_PREFIX}pilot:${personaId ?? ''}`

export function loadPilot(personaId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): PilotState {
  try {
    const text = storage?.getItem(pilotKeyFor(personaId))
    return text ? normalizePilot(JSON.parse(text)) : EMPTY_PILOT
  } catch {
    return EMPTY_PILOT
  }
}

export function savePilot(personaId: string | null, state: PilotState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(pilotKeyFor(personaId), JSON.stringify(state))
    return !!storage
  } catch {
    return false
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const cache = new Map<string, PilotState>()
const listeners = new Set<() => void>()

export function getPilot(personaId: string | null): PilotState {
  const key = pilotKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadPilot(personaId); cache.set(key, s) }
  return s
}

export function subscribePilot(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updatePilot(personaId: string | null, change: (s: PilotState) => PilotState): void {
  const next = change(getPilot(personaId))
  cache.set(pilotKeyFor(personaId), next)
  savePilot(personaId, next)
  listeners.forEach((l) => l())
}
