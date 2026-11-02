import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import { normalizeDebriefs, type Debrief } from '../domain/disruptionHub'
import { EMPTY_DELAY, normalizeDelay, type DelayState } from '../domain/delay'
import { EMPTY_HOME, normalizeHome, type HomeState } from '../domain/homeLink'

/** Everything Phase H2 keeps on this device for one person: the family-at-home page, a delay and disruption follow-ups. A call-back request is the server's ticket (`GET /me/staff-requests`), not kept here. */
export interface HubState { home: HomeState; delay: DelayState; debriefs: Debrief[] }
export const EMPTY_HUB: HubState = { home: EMPTY_HOME, delay: EMPTY_DELAY, debriefs: [] }

export const normalizeHub = (raw: unknown): HubState => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_HUB
  const r = raw as Record<string, unknown>
  return { home: normalizeHome(r.home), delay: normalizeDelay(r.delay), debriefs: normalizeDebriefs(r.debriefs) }
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

/** The family-at-home page (contacts with their email addresses, links, postcards, and the secret that signs links): its own document (key `family`), only with the guest's agreement (Settings: syncPrivate). Everything else is key `hub`. */
export const hubRestOf = (s: HubState): HubState => ({ ...s, home: EMPTY_HOME })

export function updateHub(personaId: string | null, change: (s: HubState) => HubState): void {
  const prev = getHub(personaId)
  const next = change(prev)
  cache.set(hubKeyFor(personaId), next)
  saveHub(personaId, next)
  listeners.forEach((l) => l())
  if (JSON.stringify(hubRestOf(prev)) !== JSON.stringify(hubRestOf(next))) sync.changed('hub', personaId)
  if (JSON.stringify(prev.home) !== JSON.stringify(next.home)) sync.changed('family', personaId)
}

/** Takes the server's family-at-home page (null: empty) without telling the sync module it changed. */
export function applyRemoteFamily(personaId: string | null, raw: unknown): void {
  applyRemoteHub(personaId, { ...getHub(personaId), home: raw === null ? EMPTY_HOME : normalizeHome(raw) })
}

/** Takes the server's copy without telling the sync module it changed. */
export function applyRemoteHub(personaId: string | null, next: HubState): void {
  cache.set(hubKeyFor(personaId), next)
  saveHub(personaId, next)
  listeners.forEach((l) => l())
}
