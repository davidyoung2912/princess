import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import { normalizeCallback, normalizeDebriefs, type CallbackRequest, type Debrief } from '../domain/disruptionHub'
import { EMPTY_DELAY, normalizeDelay, type DelayState } from '../domain/delay'
import { EMPTY_HOME, normalizeHome, type HomeState } from '../domain/homeLink'

/** Everything Phase H2 keeps on this device for one person: the family-at-home page, a delay, a callback request and disruption follow-ups. */
export interface HubState { home: HomeState; delay: DelayState; callback: CallbackRequest | null; debriefs: Debrief[] }
export const EMPTY_HUB: HubState = { home: EMPTY_HOME, delay: EMPTY_DELAY, callback: null, debriefs: [] }

export const normalizeHub = (raw: unknown): HubState => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_HUB
  const r = raw as Record<string, unknown>
  return { home: normalizeHome(r.home), delay: normalizeDelay(r.delay), callback: normalizeCallback(r.callback), debriefs: normalizeDebriefs(r.debriefs) }
}

export const hubKeyFor = (personaId: string | null): string => `${APP_PREFIX}hub:${personaId ?? ''}`

export function loadHub(personaId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): HubState {
  try {
    const text = storage?.getItem(hubKeyFor(personaId))
    return text ? normalizeHub(JSON.parse(text)) : EMPTY_HUB
  } catch {
    return EMPTY_HUB
  }
}

export function saveHub(personaId: string | null, state: HubState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(hubKeyFor(personaId), JSON.stringify(state))
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

const cache = new Map<string, HubState>()
const listeners = new Set<() => void>()

export function getHub(personaId: string | null): HubState {
  const key = hubKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadHub(personaId); cache.set(key, s) }
  return s
}

export function subscribeHub(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateHub(personaId: string | null, change: (s: HubState) => HubState): void {
  const next = change(getHub(personaId))
  cache.set(hubKeyFor(personaId), next)
  saveHub(personaId, next)
  listeners.forEach((l) => l())
  sync.changed('hub', personaId)
}

/** Takes the server's copy without telling the sync module it changed. */
export function applyRemoteHub(personaId: string | null, next: HubState): void {
  cache.set(hubKeyFor(personaId), next)
  saveHub(personaId, next)
  listeners.forEach((l) => l())
}
