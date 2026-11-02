import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import { EMPTY_EMBARK, normalizeEmbark, type EmbarkState } from '../domain/embark'
import { EMPTY_JOURNEY_STATE, normalizeJourney, type JourneyState } from '../domain/journey'

/** Everything Phase H4 keeps on this device for one person: the door-to-ship plan, packing ticks, the bag log, and the embarkation plan. */
export interface TripState { journey: JourneyState; embark: EmbarkState }
export const EMPTY_TRIP: TripState = { journey: EMPTY_JOURNEY_STATE, embark: EMPTY_EMBARK }

export const normalizeTrip = (raw: unknown): TripState => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_TRIP
  const r = raw as Record<string, unknown>
  return { journey: normalizeJourney(r.journey), embark: normalizeEmbark(r.embark) }
}

export const tripKeyFor = (personaId: string | null): string => `${APP_PREFIX}trip:${personaId ?? ''}`

export function loadTrip(personaId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): TripState {
  try {
    const text = storage?.getItem(tripKeyFor(personaId))
    return text ? normalizeTrip(JSON.parse(text)) : EMPTY_TRIP
  } catch {
    return EMPTY_TRIP
  }
}

export function saveTrip(personaId: string | null, state: TripState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(tripKeyFor(personaId), JSON.stringify(state))
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

const cache = new Map<string, TripState>()
const listeners = new Set<() => void>()

export function getTrip(personaId: string | null): TripState {
  const key = tripKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadTrip(personaId); cache.set(key, s) }
  return s
}

export function subscribeTrip(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateTrip(personaId: string | null, change: (s: TripState) => TripState): void {
  const next = change(getTrip(personaId))
  cache.set(tripKeyFor(personaId), next)
  saveTrip(personaId, next)
  listeners.forEach((l) => l())
  sync.changed('trip', personaId)
}

/** Takes the server's copy without telling the sync module it changed. */
export function applyRemoteTrip(personaId: string | null, next: TripState): void {
  cache.set(tripKeyFor(personaId), next)
  saveTrip(personaId, next)
  listeners.forEach((l) => l())
}
