import { clockNow } from '../domain/clock'
import type { DemoState } from './state'

/** What `PUT /demo/state` takes: the server's clock is the real one plus an offset (seconds), so a demo user's "now" matches the controls. */
export interface DemoPayload { clockOffsetSeconds: number; clockSpeed: number; scenarios: string[] }

export const demoPayload = (state: DemoState, realNow: number): DemoPayload => ({
  clockOffsetSeconds: Math.round((clockNow(state.clock, realNow) - realNow) / 1000),
  clockSpeed: state.clock.speed,
  scenarios: [...state.scenarios],
})

/** Sends the controls to the server; unset in mock mode and for real accounts. Set by the runtime. */
export type DemoPublisher = (payload: DemoPayload) => Promise<unknown>
let publisher: DemoPublisher | null = null
export const setDemoPublisher = (p: DemoPublisher | null): void => { publisher = p }

/** Fire and forget: the controls work on this device whether or not the server hears them. */
export function publishDemo(state: DemoState, realNow: number = Date.now()): void {
  if (!publisher) return
  void publisher(demoPayload(state, realNow)).catch(() => {})
}
