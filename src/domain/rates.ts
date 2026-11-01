import { CURRENCIES, currencyByCode } from './services'
import type { Cents } from './pricing'

/**
 * Exchange rates (ACC-07). A rate table has a date. The source here is a stub: it moves the authored sample rates a little each day so the
 * "update" button and the "out of date" note behave as they would with a real feed. Nothing is fetched. Amounts in another currency are an
 * estimate for reading only; the account is always charged in US dollars.
 */
export interface RateTable { asOf: string; perUsd: Record<string, number> }

/** After this many days a table is called out of date. */
export const RATES_STALE_DAYS = 3
/** The most a rate moves from its sample value, as a fraction. */
export const RATE_DRIFT = 0.03

const DAY = 86_400_000

/** The sample rates, dated. The fallback when nothing has been updated. */
export const SAMPLE_TABLE: RateTable = { asOf: '2026-10-01', perUsd: Object.fromEntries(CURRENCIES.map((c) => [c.code, c.perUsd])) }

export const isoDay = (at: number): string => new Date(at).toISOString().slice(0, 10)

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

/** The stub source: today's table, the same every time for the same day. US dollars never move. */
export function stubRates(now: number): RateTable {
  const asOf = isoDay(now)
  const perUsd: Record<string, number> = {}
  for (const c of CURRENCIES) {
    const unit = c.code === 'USD' ? 0 : ((hash(`${c.code}|${asOf}`) % 2001) / 1000 - 1) * RATE_DRIFT
    perUsd[c.code] = Math.round(c.perUsd * (1 + unit) * 10_000) / 10_000
  }
  return { asOf, perUsd }
}

/** Whole days between the table's date and now; never negative. */
export function rateAgeDays(table: RateTable, now: number): number {
  const then = Date.parse(`${table.asOf}T00:00:00Z`)
  return Number.isNaN(then) ? Infinity : Math.max(0, Math.floor((now - then) / DAY))
}

export const ratesStale = (table: RateTable, now: number): boolean => rateAgeDays(table, now) > RATES_STALE_DAYS

/** Reads a stored table; anything wrong in it gives the sample table. Unknown codes are dropped and bad rates fall back to the sample. */
export function normalizeRates(raw: unknown): RateTable {
  if (!raw || typeof raw !== 'object') return SAMPLE_TABLE
  const r = raw as { asOf?: unknown; perUsd?: unknown }
  if (typeof r.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.asOf) || !r.perUsd || typeof r.perUsd !== 'object') return SAMPLE_TABLE
  const given = r.perUsd as Record<string, unknown>
  const perUsd: Record<string, number> = {}
  for (const c of CURRENCIES) {
    const v = given[c.code]
    perUsd[c.code] = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : c.perUsd
  }
  perUsd.USD = 1
  return { asOf: r.asOf, perUsd }
}

/** An amount in another currency from a table, as "€12.34". Unknown codes show dollars. */
export function inCurrencyAt(cents: Cents, code: string, table: RateTable): string {
  const c = currencyByCode(code) ?? CURRENCIES[0]
  const amount = (cents / 100) * (table.perUsd[c.code] ?? c.perUsd)
  const sign = amount < 0 ? '-' : ''
  return `${sign}${c.symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
