/**
 * Lets screens that mount together (Home, a tab list, the countdowns) ask for the same data and share one call. A call is reused while it is running and for
 * `ttlMs` after it started, so a screen opened a moment later does not repeat it, yet a figure the guest has just changed is not held for long. A failed call
 * is forgotten at once so the next ask tries again. Pure and clock-injected, so it is unit tested without React.
 */
export function createSharedLoader(now: () => number = Date.now, ttlMs = 3000) {
  const entries = new Map<string, { at: number; promise: Promise<unknown> }>()
  function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = entries.get(key)
    if (hit && now() - hit.at < ttlMs) return hit.promise as Promise<T>
    const promise = load()
    entries.set(key, { at: now(), promise })
    promise.catch(() => { if (entries.get(key)?.promise === promise) entries.delete(key) })
    return promise
  }
  /** Drops everything held, so the next ask of any key calls again (a changed scenario, or a test starting clean). */
  shared.clear = () => entries.clear()
  return shared
}
