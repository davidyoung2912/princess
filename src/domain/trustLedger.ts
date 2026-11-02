import type { Cents } from './pricing'
import type { FolioLine } from './folio'

/**
 * The trust ledger (XT-07): one timeline of money that moved, from the payments made on the booking and the charges and credits on
 * the onboard account. Nothing here can be removed. Bookings, requests and changes join it as later phases record them.
 */
export type LedgerSource = 'payment' | 'account'
export type LedgerKind = 'payment' | 'charge' | 'credit' | 'covered' | 'refund'

export interface LedgerEntry {
  id: string
  at: number
  source: LedgerSource
  kind: LedgerKind
  /** Plain text of what it was. */
  label: string
  /** Money in the guest's direction is negative (credits and refunds), money paid or charged is positive. */
  cents: Cents
  /** What a covered item would have cost. */
  value?: Cents
}

export interface PaymentRecord { id: string; label: string; cents: Cents; at: number; method: string }

/** Every payment and account line as ledger entries, newest first, with a stable order for equal times. */
export function buildLedger(payments: readonly PaymentRecord[], lines: readonly FolioLine[]): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  for (const p of payments) entries.push({ id: `pay-${p.id}`, at: p.at, source: 'payment', kind: p.label === 'refund' ? 'refund' : 'payment', label: `${p.label} · ${p.method}`, cents: p.label === 'refund' ? -Math.abs(p.cents) : p.cents })
  for (const l of lines) {
    const kind: LedgerKind = l.cents < 0 ? 'credit' : l.coveredBy && l.cents === 0 ? 'covered' : 'charge'
    entries.push({ id: `acct-${l.id}`, at: l.at, source: 'account', kind, label: l.description, cents: l.cents, ...(l.value !== undefined ? { value: l.value } : {}) })
  }
  return entries.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

/** Net money the guest has put in: payments and charges less credits and refunds. */
export const ledgerNet = (entries: readonly LedgerEntry[]): Cents => entries.reduce((n, e) => n + e.cents, 0)

/** Entries grouped by a day key from `dayOf(at)`, keeping order. */
export function groupByDay(entries: readonly LedgerEntry[], dayOf: (at: number) => string): { day: string; entries: LedgerEntry[] }[] {
  const out: { day: string; entries: LedgerEntry[] }[] = []
  for (const e of entries) {
    const day = dayOf(e.at)
    const last = out[out.length - 1]
    if (last && last.day === day) last.entries.push(e)
    else out.push({ day, entries: [e] })
  }
  return out
}
