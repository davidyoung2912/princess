import { record, type DiagnosticKind } from './log'

/** A page load slower than this is worth a line in the log (milliseconds to the load event). */
export const SLOW_LOAD_MS = 4000

const local = (): Storage | null => {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

/** Notes a problem in the on-device log. */
export const report = (kind: DiagnosticKind, message: unknown): void => record(local(), kind, message)

/** Starts listening for uncaught errors, unhandled promise failures and a slow first load. Call once at start-up. */
export function watchProblems(): void {
  window.addEventListener('error', (e) => report('error', e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => report('promise', e.reason))
  window.addEventListener('load', () => {
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav && nav.loadEventEnd > SLOW_LOAD_MS) report('slow', `Page took ${Math.round(nav.loadEventEnd)} ms to load`)
    }, 0)
  })
}
