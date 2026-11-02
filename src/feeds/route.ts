import { conditionsFor, type Conditions, type Crowd } from '../domain/journey'

const TRAFFIC = ['light', 'moderate', 'heavy'] as const
const SKY = ['clear', 'cloudy', 'rain', 'storm'] as const

/** Reads the server's answer; anything wrong in it gives null so the local simulation is used. */
export function normalizeConditions(raw: unknown): Conditions | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!(TRAFFIC as readonly unknown[]).includes(r.traffic) || !(SKY as readonly unknown[]).includes(r.sky)) return null
  const mins = typeof r.leaveEarlierMinutes === 'number' && Number.isFinite(r.leaveEarlierMinutes) ? Math.max(0, Math.round(r.leaveEarlierMinutes)) : 0
  return { source: 'sim', traffic: r.traffic as Conditions['traffic'], sky: r.sky as Conditions['sky'], leaveEarlierMinutes: mins }
}

/** Asks the server for the conditions on the way to the port; unset in mock mode. Set by the runtime. */
export type RouteFetcher = (departure: string, crowd: Crowd) => Promise<unknown>
let fetcher: RouteFetcher | null = null
export const setRouteFetcher = (f: RouteFetcher | null): void => { fetcher = f }

const served = new Map<string, Conditions>()
const key = (departure: string, crowd: Crowd): string => `${departure}|${crowd}`

/** What is known now: the server's answer if it has come, else the local simulation. */
export const conditionsNow = (departure: string, crowd: Crowd): Conditions => served.get(key(departure, crowd)) ?? conditionsFor(departure, crowd)

/** Fetches the server's answer once per date and crowd; resolves true when a new value was stored. */
export async function loadConditions(departure: string, crowd: Crowd): Promise<boolean> {
  if (!fetcher || served.has(key(departure, crowd))) return false
  try {
    const c = normalizeConditions(await fetcher(departure, crowd))
    if (!c) return false
    served.set(key(departure, crowd), c)
    return true
  } catch {
    return false
  }
}

export const forgetConditions = (): void => served.clear()
