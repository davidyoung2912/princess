/**
 * Whether the reference tables the screens cannot draw without (sailings, ports, the catalogue) are in use: from the copy kept on this device, or from the
 * server's answer. The app shows a waiting page until then, so the screens never read an empty table. Pure: no network, no storage.
 */
export type ReferenceState = 'loading' | 'ready' | 'failed'

let required: readonly string[] = []
const ready = new Set<string>()
const failed = new Set<string>()
let state: ReferenceState = 'loading'
const listeners = new Set<() => void>()

const recompute = (): void => {
  const next: ReferenceState = required.every((k) => ready.has(k)) ? 'ready' : required.some((k) => failed.has(k) && !ready.has(k)) ? 'failed' : 'loading'
  if (next === state) return
  state = next
  for (const f of [...listeners]) f()
}

/** Names the tables that must be in use before the app draws. */
export function requireReference(kinds: readonly string[]): void {
  required = kinds
  recompute()
}

export const markReferenceReady = (kind: string): void => { ready.add(kind); failed.delete(kind); recompute() }
export const markReferenceFailed = (kind: string): void => { failed.add(kind); recompute() }
/** A new attempt: failures are forgotten, so the page says "loading" again. */
export function markReferenceRetry(): void { failed.clear(); recompute() }
/** Says every required table is in use (tests seed them directly). */
export function markReferenceAllReady(): void { for (const k of required) ready.add(k); recompute() }

export const referenceState = (): ReferenceState => state
export const subscribeReference = (f: () => void): (() => void) => { listeners.add(f); return () => { listeners.delete(f) } }
