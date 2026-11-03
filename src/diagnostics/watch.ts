import { record, type DiagnosticKind } from './log'
import { createTelemetry, type EventName, type TelemetryItem } from './telemetry'

/** Device flag for the "Help improve the app" consent (usage counts only; problems are always reported), set from the privacy centre. Off until the guest turns it on. */
export const IMPROVE_KEY = 'princess:improve'

/** A page load slower than this is worth a line in the log (milliseconds to the load event). */
export const SLOW_LOAD_MS = 4000

const local = (): Storage | null => {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

const improveOn = (): boolean => {
  try { return local()?.getItem(IMPROVE_KEY) === '1' } catch { return false }
}

/** Problem reports (always) and usage counts (only while the consent flag is on) (PERF-07, CNT-03). */
export const telemetry = createTelemetry(local(), improveOn)

let sender: ((items: TelemetryItem[]) => Promise<unknown>) | null = null

/** Where queued reports go. Set by the runtime when a server is configured; without one the queue stays on the device. */
export function setTelemetrySender(send: ((items: TelemetryItem[]) => Promise<unknown>) | null): void { sender = send }

/** Sends the queue now if a sender is set and the guest agreed. Never throws. */
export const flushTelemetry = (): Promise<number> => (sender ? telemetry.flush(sender) : Promise.resolve(0))

/** Records the guest's choice about helping improve the app; withdrawing it also forgets what was queued. */
export function setImproveConsent(on: boolean): void {
  try {
    if (on) local()?.setItem(IMPROVE_KEY, '1')
    else { local()?.removeItem(IMPROVE_KEY); telemetry.clear() }
  } catch { /* blocked storage: stays off */ }
}

/** Counts a named event, only if the guest agreed. */
export const track = (name: EventName, screen?: string): void => telemetry.event(name, screen)

/** Notes a problem in the on-device log and sends it to the server (scrubbed: no stack, address, e-mail or typed text); it waits in a queue while offline or signed out. */
export const report = (kind: DiagnosticKind, message: unknown): void => {
  record(local(), kind, message)
  telemetry.error(kind, message)
  void flushTelemetry()
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
