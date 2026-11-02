import { flightStatus, normalizeFlight, type FlightState, type FlightStatus } from '../domain/journey'

const STATES: readonly FlightState[] = ['onTime', 'delayed', 'cancelled']

/** Reads the server's answer; anything wrong in it gives null so the local simulation is used. */
export function normalizeFlightStatus(raw: unknown): FlightStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!(STATES as readonly unknown[]).includes(r.state)) return null
  const minutes = typeof r.delayMinutes === 'number' && Number.isFinite(r.delayMinutes) ? Math.max(0, Math.round(r.delayMinutes)) : 0
  return { source: 'sim', state: r.state as FlightState, delayMinutes: r.state === 'delayed' ? minutes : 0 }
}

/** Asks the server for a flight's status; unset in mock mode. Set by the runtime. */
export type FlightFetcher = (number: string, date: string) => Promise<unknown>
let fetcher: FlightFetcher | null = null
export const setFlightFetcher = (f: FlightFetcher | null): void => { fetcher = f }

const served = new Map<string, FlightStatus>()
const key = (number: string, date: string): string => `${normalizeFlight(number)}|${date}`

/** What is known now: the server's answer if it has come, else the local simulation. Null for a number that is not a flight number. */
export const flightNow = (number: string, date: string): FlightStatus | null => served.get(key(number, date)) ?? flightStatus(number, date)

/** Fetches the server's status once per flight and date; resolves true when a new value was stored. */
export async function loadFlight(number: string, date: string): Promise<boolean> {
  if (!fetcher || served.has(key(number, date)) || !flightStatus(number, date)) return false
  try {
    const s = normalizeFlightStatus(await fetcher(normalizeFlight(number), date))
    if (!s) return false
    served.set(key(number, date), s)
    return true
  } catch {
    return false
  }
}

export const forgetFlights = (): void => served.clear()
