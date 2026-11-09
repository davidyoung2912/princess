import type { Cents } from './money'

/**
 * A fare alert (DRM-16): tied to one sailing, one room type and one currency, with a price the guest sets. It can be paused or deleted in one tap.
 * The alert only says a fare has reached the price; it never books anything.
 */
export interface FareAlert {
  id: string
  sailingId: string
  category: string
  currency: 'USD'
  /** Tell me when the fare for the whole booking is at or below this. */
  belowCents: Cents
  createdAt: number
  paused: boolean
}

export type AlertState = 'paused' | 'met' | 'watching'

export const ALERTS_MAX = 6

export function newAlert(input: { id: string; sailingId: string; category: string; belowCents: number }, now: number, existing: readonly FareAlert[]): FareAlert[] | null {
  if (!input.sailingId || !input.category || !Number.isInteger(input.belowCents) || input.belowCents < 100) return null
  if (existing.length >= ALERTS_MAX || existing.some((a) => a.sailingId === input.sailingId && a.category === input.category)) return null
  return [...existing, { ...input, currency: 'USD', createdAt: now, paused: false }]
}

export const setPaused = (list: readonly FareAlert[], id: string, paused: boolean): FareAlert[] => list.map((a) => (a.id === id ? { ...a, paused } : a))
export const removeAlert = (list: readonly FareAlert[], id: string): FareAlert[] => list.filter((a) => a.id !== id)

/** Where an alert stands against the latest fare for its sailing and room type, or null when no fare is known. */
export function alertState(a: FareAlert, latest: Cents | null): AlertState {
  if (a.paused) return 'paused'
  return latest !== null && latest <= a.belowCents ? 'met' : 'watching'
}

export function normalizeAlerts(raw: unknown): FareAlert[] {
  if (!Array.isArray(raw)) return []
  const out: FareAlert[] = []
  for (const x of raw) {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
    if (typeof o.id === 'string' && typeof o.sailingId === 'string' && typeof o.category === 'string' && typeof o.belowCents === 'number' && Number.isInteger(o.belowCents) && o.belowCents >= 100) {
      out.push({ id: o.id, sailingId: o.sailingId, category: o.category, currency: 'USD', belowCents: o.belowCents, createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0, paused: o.paused === true })
    }
  }
  return out.slice(0, ALERTS_MAX)
}
