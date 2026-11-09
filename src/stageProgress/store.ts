import { EMPTY_PROGRESS, markVisited, normalizeProgress, type StageProgressState } from '../routes/stageProgress'
import { sync } from '../sync'

/** Which steps of each stage's welcome a person has opened, in memory only: the server's copy is the real one and the sync module pulls it at sign-in. */
const keyFor = (personaId: string | null): string => personaId ?? ''

const cache = new Map<string, StageProgressState>()
const listeners = new Set<() => void>()

const tell = (): void => listeners.forEach((l) => l())

export function getProgress(personaId: string | null): StageProgressState {
  return cache.get(keyFor(personaId)) ?? EMPTY_PROGRESS
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Records a visit to a step, saves it and tells the sync module. Nothing happens when it was recorded already. */
export function recordVisit(personaId: string | null, key: string, now: number): void {
  const cur = getProgress(personaId)
  const next = markVisited(cur, key, now)
  if (next === cur) return
  cache.set(keyFor(personaId), next)
  tell()
  sync.changed('stageProgress', personaId)
}

/** Forgets every visit, so every step starts again from what the data shows. Saved like any change. */
export function resetProgress(personaId: string | null): void {
  if (getProgress(personaId) === EMPTY_PROGRESS) return
  cache.set(keyFor(personaId), EMPTY_PROGRESS)
  tell()
  sync.changed('stageProgress', personaId)
}

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteProgress(personaId: string | null, raw: unknown): void {
  cache.set(keyFor(personaId), raw === null ? EMPTY_PROGRESS : normalizeProgress(raw))
  tell()
}
