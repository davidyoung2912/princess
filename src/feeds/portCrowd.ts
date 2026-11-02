import { type CrowdPort, type PortCrowd } from '../domain/portCrowd'
import { createFeed } from './feed'

const LEVELS = ['quiet', 'moderate', 'busy']

/** Reads the server's crowd for a port and date; anything wrong in it gives null. */
export function normalizeCrowd(raw: unknown): PortCrowd | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Number.isInteger(r.ships) || (r.ships as number) < 1 || (r.ships as number) > 20 || !Number.isInteger(r.guests) || (r.guests as number) < 0 || !LEVELS.includes(r.level as string)) return null
  return { ships: r.ships as number, guests: r.guests as number, level: r.level as PortCrowd['level'], stayAboardNote: r.level === 'busy' }
}

/** How busy a port is on a date. */
export const crowdFeed = createFeed<[port: CrowdPort, date: string], PortCrowd>((p, d) => `${p}|${d}`, normalizeCrowd, 'crowd')
