/**
 * A new version of the app waiting to be used (PERF-02). The service worker downloads it quietly; nothing reloads until the guest
 * says so, so a form half filled in or a message half written is never thrown away.
 */
let apply: (() => void) | null = null
const listeners = new Set<() => void>()

export const updateReady = (): boolean => apply !== null

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Called by the service-worker registration when a new version has been fetched. */
export function markUpdateReady(applyIt: () => void): void {
  apply = applyIt
  listeners.forEach((l) => l())
}

/** Reloads into the new version. */
export function applyUpdate(): void {
  apply?.()
}

/** Forgets a waiting update (used by tests). */
export function clearUpdate(): void {
  apply = null
  listeners.forEach((l) => l())
}
