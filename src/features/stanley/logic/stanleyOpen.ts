/**
 * A way for any screen to open Stanley's dialog, optionally with words already in the box (SG7). The shell listens; nothing is sent until the guest presses Send.
 */
export interface StanleyRequest { id: number; prefill: string }

let current: StanleyRequest | null = null
let next = 1
const listeners = new Set<() => void>()

export const requestStanley = (prefill = ''): void => {
  current = { id: next++, prefill: prefill.trim().slice(0, 500) }
  listeners.forEach((fn) => fn())
}
/** The shell calls this once it has opened the dialog, so the same request does not open it again. */
export const takeStanleyRequest = (): StanleyRequest | null => { const r = current; current = null; return r }
export const peekStanleyRequest = (): StanleyRequest | null => current
export const subscribeStanleyRequest = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
