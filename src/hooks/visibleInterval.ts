/** The part of `document` an interval needs; a test can supply its own. */
export interface VisibilitySource {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Calls `fn` every `ms` while the page is visible, and not at all while it is hidden (a phone in a pocket, another tab), so
 * polling does not drain the battery or the ship's data (PERF-08). When the page comes back it calls `fn` once at once, then carries on.
 * Returns a function that stops it for good.
 */
export function startVisibleInterval(fn: () => void, ms: number, doc: VisibilitySource = document): () => void {
  let timer: ReturnType<typeof setInterval> | null = null
  const start = () => { if (timer === null) timer = setInterval(fn, ms) }
  const stop = () => { if (timer !== null) { clearInterval(timer); timer = null } }
  const onChange = () => {
    if (doc.hidden) stop()
    else { fn(); start() }
  }
  if (!doc.hidden) start()
  doc.addEventListener('visibilitychange', onChange)
  return () => { stop(); doc.removeEventListener('visibilitychange', onChange) }
}
