import { type StormBand, type StormPhase, type StormReading } from '../domain/storm'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const BANDS: readonly StormBand[] = ['none', 'low', 'some', 'higher']
const PHASES: readonly StormPhase[] = ['far', 'watch', 'near', 'sailing']
const LINE_MAY = ['reroute', 'swap', 'shorten', 'delay', 'cancel']
const YOU_CAN = ['insurance', 'flights', 'early', 'follow', 'plan']
const DATE = /^\d{4}-\d{2}-\d{2}$/

const keys = (v: unknown, allowed: readonly string[]): string[] | null =>
  Array.isArray(v) && v.length <= allowed.length && v.every((k) => typeof k === 'string' && allowed.includes(k)) ? (v as string[]) : null

/** Reads the server's storm reading; anything wrong in it gives null so nothing is shown. */
export function normalizeStorm(raw: unknown): StormReading | null {
  if (!isRecord(raw) || !oneOf(raw.band, BANDS) || !oneOf(raw.phase, PHASES) || !isInt(raw.percent, 0, 100)) return null
  const lineMay = keys(raw.lineMay, LINE_MAY)
  const youCan = keys(raw.youCan, YOU_CAN)
  if (!lineMay || !youCan || typeof raw.departure !== 'string' || !DATE.test(raw.departure) || typeof raw.returns !== 'string' || !DATE.test(raw.returns)) return null
  if (typeof raw.inSeason !== 'boolean' || typeof raw.peak !== 'boolean') return null
  return { source: 'sim', departure: raw.departure, returns: raw.returns, inSeason: raw.inSeason, percent: raw.percent, band: raw.band, phase: raw.phase, lineMay, youCan, peak: raw.peak }
}

/** The storm watch for a sailing (by departure date) and the days until it leaves. */
export const stormFeed = createFeed<[departure: string, days: number], StormReading>((d, n) => `${d}|${n}`, normalizeStorm, 'storm')
