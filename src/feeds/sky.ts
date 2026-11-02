import { simWeather, type SimWeather } from '../domain/autopilot'
import type { PortId } from '../domain/sailings'

const hhmm = (v: unknown): string | null => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null)

/** Reads the server's sky for a day; anything wrong in it gives null so the local simulation is used. */
export function normalizeSky(raw: unknown): SimWeather | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.uv !== 'number' || typeof r.tempF !== 'number' || !Number.isFinite(r.uv) || !Number.isFinite(r.tempF)) return null
  const rainFrom = hhmm(r.rainFrom)
  const rainTo = hhmm(r.rainTo)
  return { uv: r.uv, tempF: r.tempF, rainFrom: rainFrom && rainTo ? rainFrom : null, rainTo: rainFrom && rainTo ? rainTo : null, source: 'sim' }
}

/** Asks the server for a day's sky; null when there is no server (mock mode). Set by the runtime. */
export type SkyFetcher = (sailingId: string, day: number, port: PortId) => Promise<unknown>
let fetcher: SkyFetcher | null = null
export const setSkyFetcher = (f: SkyFetcher | null): void => { fetcher = f }

const served = new Map<string, SimWeather>()
const key = (sailingId: string, day: number): string => `${sailingId}|${day}`

/** What is known now: the server's answer if it has come, else the local simulation (the same figures, so nothing jumps). */
export const skyNow = (sailingId: string, day: number, port: PortId): SimWeather => served.get(key(sailingId, day)) ?? simWeather(sailingId, day, port)

/** Fetches the server's sky once per day; resolves true when a new value was stored. Failures leave the simulation in use. */
export async function loadSky(sailingId: string, day: number, port: PortId): Promise<boolean> {
  if (!fetcher || served.has(key(sailingId, day))) return false
  try {
    const sky = normalizeSky(await fetcher(sailingId, day, port))
    if (!sky) return false
    served.set(key(sailingId, day), sky)
    return true
  } catch {
    return false
  }
}

export const forgetSky = (): void => served.clear()
