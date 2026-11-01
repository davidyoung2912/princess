import { record, type DiagnosticKind } from './log'
import { createTelemetry, type EventName } from './telemetry'

/** Device flag for the "Help improve the app" consent, set from the privacy centre. Off until the guest turns it on. */
export const IMPROVE_KEY = 'princess:improve'

/** A page load slower than this is worth a line in the log (milliseconds to the load event). */
export const SLOW_LOAD_MS = 4000

const local = (): Storage | null => {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

const improveOn = (): boolean => {
  try { return local()?.getItem(IMPROVE_KEY) === '1' } catch { return false }
}

/** Consent-gated reports and counts (PERF-07, CNT-03). Nothing is queued while the flag is off. */
export const telemetry = createTelemetry(local(), improveOn)

/** Records the guest's choice about helping improve the app; withdrawing it also forgets what was queued. */
export function setImproveConsent(on: boolean): void {
  try {
    if (on) local()?.setItem(IMPROVE_KEY, '1')
    else { local()?.removeItem(IMPROVE_KEY); telemetry.clear() }
  } catch { /* blocked storage: stays off */ }
}

/** Counts a named event, only if the guest agreed. */
export const track = (name: EventName, screen?: string): void => telemetry.event(name, screen)

/** Notes a problem in the on-device log, and queues it for the team if the guest agreed. */
export const report = (kind: DiagnosticKind, message: unknown): void => {
  record(local(), kind, message)
  telemetry.error(kind, message)
}

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
