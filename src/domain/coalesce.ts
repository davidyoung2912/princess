/**
 * Shares one fetch between callers that ask close together. While a request is running, any number of further calls wait for ONE follow-up request, so a burst
 * (a nudge, a window focus and a "mark read" in the same moment) costs two requests at most, and every caller still gets an answer that started after it asked.
 * Framework-free.
 */
export function coalesce<T>(fetch: () => Promise<T>): () => Promise<T> {
  let current: Promise<T> | null = null   // the request in flight
  let queued: Promise<T> | null = null    // the one follow-up, started when the current one settles
  const run = (): Promise<T> => {
    const p = fetch()
    current = p
    const done = () => { if (current === p) current = null }
    p.then(done, done)
    return p
  }
  return () => {
    if (!current) return run()
    if (!queued) {
      const after = (): Promise<T> => { queued = null; return run() }
      queued = current.then(after, after)
    }
    return queued
  }
}
