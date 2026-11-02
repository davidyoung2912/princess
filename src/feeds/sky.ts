import type { SimWeather } from '../domain/autopilot'
import type { PortId } from '../domain/sailings'
import { createFeed } from './feed'

const hhmm = (v: unknown): string | null => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null)

/** Reads the server's sky for a day; anything wrong in it gives null. */
export function normalizeSky(raw: unknown): SimWeather | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.uv !== 'number' || typeof r.tempF !== 'number' || !Number.isFinite(r.uv) || !Number.isFinite(r.tempF)) return null
  const rainFrom = hhmm(r.rainFrom)
  const rainTo = hhmm(r.rainTo)
  return { uv: r.uv, tempF: r.tempF, rainFrom: rainFrom && rainTo ? rainFrom : null, rainTo: rainFrom && rainTo ? rainTo : null, source: 'sim' }
}

/** The sky on a date (`YYYY-MM-DD`) at the port the ship is at; the server uses one weather model for this, packing and today's weather. */
export const skyFeed = createFeed<[date: string, port: PortId], SimWeather>((d, p) => `${d}|${p}`, normalizeSky, 'sky')
