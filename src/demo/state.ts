import { clockAt, DEFAULT_PHONE_ZONE, normalizeClock, normalizePhoneZone, type ClockState } from '../domain/clock'
import { REFERENCE_SAILING, sailingById, timeForStage } from '../domain/sailings'
import { SCENARIOS, type ScenarioId } from '../domain/scenarios'

/** How the pretend network behaves: offline switch, delay range, random failure rate, and the seed that makes both replay identically. */
export interface NetworkSettings {
  offline: boolean
  latencyMinMs: number
  latencyMaxMs: number
  /** 0 to 1: the share of calls that fail at random with a network error. */
  failureRate: number
  seed: number
}

export interface DemoState {
  sailingId: string
  clock: ClockState
  phoneZone: string
  scenarios: ScenarioId[]
  network: NetworkSettings
}

export const DEMO_KEY = 'princess:demo'

export const DEFAULT_NETWORK: NetworkSettings = { offline: false, latencyMinMs: 120, latencyMaxMs: 450, failureRate: 0, seed: 2027 }

/** First run: the reference sailing two weeks before departure, with the clock running at real speed. */
export function defaultDemoState(realNow: number): DemoState {
  return {
    sailingId: REFERENCE_SAILING.id,
    clock: clockAt(timeForStage(REFERENCE_SAILING, 'preCruise'), realNow),
    phoneZone: DEFAULT_PHONE_ZONE,
    scenarios: [],
    network: { ...DEFAULT_NETWORK },
  }
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback)

export function normalizeNetwork(raw: unknown): NetworkSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const min = clamp(o.latencyMinMs, 0, 30_000, DEFAULT_NETWORK.latencyMinMs)
  const max = clamp(o.latencyMaxMs, 0, 30_000, DEFAULT_NETWORK.latencyMaxMs)
  return {
    offline: o.offline === true,
    latencyMinMs: Math.min(min, max),
    latencyMaxMs: Math.max(min, max),
    failureRate: clamp(o.failureRate, 0, 1, 0),
    seed: Math.trunc(clamp(o.seed, 0, 2 ** 31, DEFAULT_NETWORK.seed)),
  }
}

/** Demo state from untrusted stored data; anything unknown falls back to the first-run value for that part. */
export function normalizeDemoState(raw: unknown, realNow: number): DemoState {
  const base = defaultDemoState(realNow)
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ids = new Set<string>(SCENARIOS.map((s) => s.id))
  return {
    sailingId: sailingById(o.sailingId)?.id ?? base.sailingId,
    clock: normalizeClock(o.clock, base.clock),
    phoneZone: normalizePhoneZone(o.phoneZone),
    scenarios: Array.isArray(o.scenarios) ? [...new Set(o.scenarios.filter((x): x is ScenarioId => typeof x === 'string' && ids.has(x)))] : [],
    network: normalizeNetwork(o.network),
  }
}

type ReadStore = Pick<Storage, 'getItem'>
type WriteStore = Pick<Storage, 'setItem'>

export function loadDemoState(realNow: number, storage: ReadStore | null): DemoState {
  try {
    const text = storage?.getItem(DEMO_KEY)
    return normalizeDemoState(text ? JSON.parse(text) : null, realNow)
  } catch {
    return defaultDemoState(realNow)
  }
}

export function saveDemoState(state: DemoState, storage: WriteStore | null): boolean {
  try {
    storage?.setItem(DEMO_KEY, JSON.stringify(state))
    return !!storage
  } catch {
    return false
  }
}
