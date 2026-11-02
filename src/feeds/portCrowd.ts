import { crowdFor, CROWD_SOURCE, type CrowdPort, type PortCrowd } from '../domain/portCrowd'

const LEVELS = ['quiet', 'moderate', 'busy']

/** Reads the server's crowd for a port and date; anything wrong in it gives null so the local simulation is used. */
export function normalizeCrowd(raw: unknown): PortCrowd | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Number.isInteger(r.ships) || (r.ships as number) < 1 || (r.ships as number) > 20 || !Number.isInteger(r.guests) || (r.guests as number) < 0 || !LEVELS.includes(r.level as string)) return null
  return { source: CROWD_SOURCE, ships: r.ships as number, guests: r.guests as number, level: r.level as PortCrowd['level'], stayAboardNote: r.level === 'busy' }
}

/** Asks the server how busy a port is on a date; null when there is no server (mock mode). Set by the runtime. */
export type CrowdFetcher = (port: CrowdPort, date: string) => Promise<unknown>
let fetcher: CrowdFetcher | null = null
export const setCrowdFetcher = (f: CrowdFetcher | null): void => { fetcher = f }

const served = new Map<string, PortCrowd>()
const key = (port: CrowdPort, date: string): string => `${port}|${date}`

/** What is known now: the server's answer if it has come, else the local simulation (the same figures, so nothing jumps). */
export const crowdNow = (port: CrowdPort, date: string): PortCrowd => served.get(key(port, date)) ?? crowdFor(port, date)

/** Fetches the server's crowd once per port and day; resolves true when a new value was stored. Failures leave the simulation in use. */
export async function loadCrowd(port: CrowdPort, date: string): Promise<boolean> {
  if (!fetcher || served.has(key(port, date))) return false
  try {
    const crowd = normalizeCrowd(await fetcher(port, date))
    if (!crowd) return false
    served.set(key(port, date), crowd)
    return true
  } catch {
    return false
  }
}

export const forgetCrowd = (): void => served.clear()
