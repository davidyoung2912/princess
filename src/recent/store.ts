import { EMPTY_RECENT, normalizeRecent, type RecentState } from '../routes/recent'
import { sync } from '../sync'

/** The recent screens, one list per signed-in person, in memory only: the server's copy is the real one and the sync module pulls it at sign-in. */
const keyFor = (personaId: string | null): string => personaId ?? ''

const cache = new Map<string, RecentState>()
const listeners = new Set<() => void>()

export function getRecent(personaId: string | null): RecentState {
  const key = keyFor(personaId)
  return cache.get(key) ?? EMPTY_RECENT
}

export function subscribeRecent(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function put(personaId: string | null, next: RecentState): void {
  cache.set(keyFor(personaId), next)
  listeners.forEach((l) => l())
}

/** Changes a person's list, saves it and tells the sync module. Nothing happens when the change returns the same list. */
export function updateRecent(personaId: string | null, change: (s: RecentState) => RecentState): void {
  const cur = getRecent(personaId)
  const next = change(cur)
  if (next === cur) return
  put(personaId, next)
  sync.changed('recent', personaId)
}

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteRecent(personaId: string | null, raw: unknown): void {
  put(personaId, raw === null ? EMPTY_RECENT : normalizeRecent(raw))
}
