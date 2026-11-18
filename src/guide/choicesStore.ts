import { sync } from '../sync'
import { EMPTY_CHOICES, normalizeChoices, putOff, restoreTask, skipTask, type GuideChoices } from './choices'
import type { GuideTask } from '../api/guideTypes'

/** What the guest has put aside in their plan, in memory only: the server's copy is the real one and the sync module pulls it at sign-in. */
const keyFor = (personaId: string | null): string => personaId ?? ''

const cache = new Map<string, GuideChoices>()
const listeners = new Set<() => void>()
const tell = (): void => listeners.forEach((l) => l())

export function getChoices(personaId: string | null): GuideChoices {
  return cache.get(keyFor(personaId)) ?? EMPTY_CHOICES
}

export function subscribeChoices(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function set(personaId: string | null, next: GuideChoices): void {
  if (next === getChoices(personaId)) return
  cache.set(keyFor(personaId), next)
  tell()
  sync.changed('guideChoices', personaId)
}

/** "Not for me": hides a task (never one with a real deadline). */
export const skipGuideTask = (personaId: string | null, task: Pick<GuideTask, 'id' | 'hard'>, now: number): void => set(personaId, skipTask(getChoices(personaId), task, now))

/** "Later": the task comes back on the given day. */
export const putOffGuideTask = (personaId: string | null, task: Pick<GuideTask, 'id'>, day: string): void => set(personaId, putOff(getChoices(personaId), task, day))

/** Brings a hidden or put-off task back. */
export const restoreGuideTask = (personaId: string | null, id: string): void => set(personaId, restoreTask(getChoices(personaId), id))

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteChoices(personaId: string | null, raw: unknown): void {
  cache.set(keyFor(personaId), raw === null ? EMPTY_CHOICES : normalizeChoices(raw))
  tell()
}
