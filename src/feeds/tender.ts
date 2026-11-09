import type { TenderBand, TenderOutlook } from '../domain/tender'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const BANDS: readonly TenderBand[] = ['good', 'mixed', 'rough']
const YOU_CAN = ['early', 'plan', 'excursion']
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads the server's tender outlook; anything wrong in it gives null so nothing is shown. */
export function normalizeTender(raw: unknown): TenderOutlook | null {
  if (!isRecord(raw) || !oneOf(raw.band, BANDS) || !isInt(raw.percent, 0, 100)) return null
  if (typeof raw.port !== 'string' || typeof raw.date !== 'string' || !DATE.test(raw.date)) return null
  const youCan = raw.youCan
  if (!Array.isArray(youCan) || youCan.length > YOU_CAN.length || !youCan.every((k) => typeof k === 'string' && YOU_CAN.includes(k))) return null
  return { port: raw.port, date: raw.date, band: raw.band, percent: raw.percent, youCan: youCan as string[] }
}

/** The tender outlook for a port and date. */
export const tenderFeed = createFeed<[port: string, date: string], TenderOutlook>((p, d) => `${p}|${d}`, normalizeTender, 'tender')
