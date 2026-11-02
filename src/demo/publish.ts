import { clockAt, clockNow, normalizePhoneZone } from '../domain/clock'
import { sailingById } from '../domain/sailings'
import { SCENARIOS } from '../domain/scenarios'
import type { DemoState } from './state'

/** What `PUT /demo/state` takes: the server's clock is the real one plus an offset (seconds), so a demo user's "now" matches the controls. */
export interface DemoPayload { clockOffsetSeconds: number; clockSpeed: number; scenarios: string[]; sailingId: string; phoneZone: string }

/** What the server answers: the payload as it keeps it (a stopped clock is kept as speed 1), and when the offset was set (ms; 0: never saved). */
export interface DemoAnswer extends Omit<DemoPayload, 'sailingId' | 'phoneZone'> { savedAt: number; sailingId: string | null; phoneZone: string | null }

export const demoPayload = (state: DemoState, realNow: number): DemoPayload => ({
  clockOffsetSeconds: Math.round((clockNow(state.clock, realNow) - realNow) / 1000),
  clockSpeed: state.clock.speed,
  scenarios: [...state.scenarios],
  sailingId: state.sailingId,
  phoneZone: state.phoneZone,
})

/** The server's answer from untrusted data; null when it is not one. Unknown scenarios are dropped. */
export function normalizeAnswer(raw: unknown): DemoAnswer | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.clockOffsetSeconds !== 'number' || !Number.isFinite(o.clockOffsetSeconds) || typeof o.clockSpeed !== 'number' || !Number.isFinite(o.clockSpeed)) return null
  const known = new Set<string>(SCENARIOS.map((s) => s.id))
  const scenarios = Array.isArray(o.scenarios) ? [...new Set(o.scenarios.filter((x): x is string => typeof x === 'string' && known.has(x)))].sort() : []
  return { clockOffsetSeconds: Math.trunc(o.clockOffsetSeconds), clockSpeed: Math.max(1, o.clockSpeed), scenarios, savedAt: typeof o.savedAt === 'number' && o.savedAt > 0 ? o.savedAt : 0,
    sailingId: typeof o.sailingId === 'string' && sailingById(o.sailingId) ? o.sailingId : null, phoneZone: typeof o.phoneZone === 'string' && o.phoneZone ? normalizePhoneZone(o.phoneZone) : null }
}

/** True when two answers describe the same saved controls (so there is nothing new to take). */
export const sameAnswer = (a: DemoAnswer, b: DemoAnswer): boolean =>
  a.clockOffsetSeconds === b.clockOffsetSeconds && a.clockSpeed === b.clockSpeed && a.savedAt === b.savedAt && a.scenarios.join() === b.scenarios.join()
  && a.sailingId === b.sailingId && a.phoneZone === b.phoneZone

/** The controls with the server's clock, scenarios, sailing and phone zone taken in; the pretend network stays as this device has it. A fast clock is followed from the moment it was saved. */
export function demoFromAnswer(state: DemoState, a: DemoAnswer, realNow: number): DemoState {
  const gained = a.savedAt > 0 && a.clockSpeed > 1 ? Math.max(0, Math.floor((realNow - a.savedAt) / 1000)) * (a.clockSpeed - 1) : 0
  const offsetMs = (a.clockOffsetSeconds + gained) * 1000
  return {
    ...state,
    clock: clockAt(realNow + offsetMs, realNow, a.clockSpeed),
    scenarios: a.scenarios as DemoState['scenarios'],
    sailingId: a.sailingId ?? state.sailingId,
    phoneZone: a.phoneZone ?? state.phoneZone,
  }
}

/** The server's demo routes; unset for real accounts. Set by the runtime. */
export interface DemoRemote {
  save(payload: DemoPayload): Promise<unknown>
  /** Moves the clock so its "now" is `at` (ms), measured on the server's clock. */
  jump(at: number): Promise<unknown>
  reset(): Promise<unknown>
  load(): Promise<unknown>
}
let remote: DemoRemote | null = null
export const setDemoRemote = (r: DemoRemote | null): void => { remote = r }

let listener: ((a: DemoAnswer) => void) | null = null
/** Told of every answer the server gives to this device's own changes, so the store can tell them from another device's. */
export const onDemoAnswer = (fn: ((a: DemoAnswer) => void) | null): void => { listener = fn }

/** Calls go one after another, so a reset followed by a jump arrive in that order. */
let queue: Promise<unknown> = Promise.resolve()
function send(call: (r: DemoRemote) => Promise<unknown>): void {
  if (!remote) return
  const r = remote
  queue = queue.then(() => call(r)).then((raw) => { const a = normalizeAnswer(raw); if (a) listener?.(a) }, () => {})
}

/** Fire and forget: the controls work on this device whether or not the server hears them. */
export function publishDemo(state: DemoState, realNow: number = Date.now()): void {
  const payload = demoPayload(state, realNow)
  send((r) => r.save(payload))
}
export const publishJump = (at: number): void => send((r) => r.jump(at))
export const publishReset = (): void => send((r) => r.reset())

/** The server's saved controls, or null when there is no server for this account or it cannot be reached. */
export async function fetchDemo(): Promise<DemoAnswer | null> {
  if (!remote) return null
  try { return normalizeAnswer(await remote.load()) } catch { return null }
}
