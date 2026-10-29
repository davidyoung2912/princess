import type { Cents } from './pricing'
import { itinerary, shipZoneOnDate, type Sailing } from './sailings'
import { zonedToEpoch } from './timezones'

/** Laundry, pressing and dry cleaning (SHP-03): request, pick-up window, tracking. Prices and turnaround are authored concept values. */
export type LaundryService = 'washFold' | 'press' | 'dryClean'

export interface ServiceDef { id: LaundryService; unit: 'bag' | 'item'; cents: Cents; hours: number; maxQty: number }

export const SERVICES: readonly ServiceDef[] = [
  { id: 'washFold', unit: 'bag', cents: 1800, hours: 24, maxQty: 3 },
  { id: 'press', unit: 'item', cents: 300, hours: 12, maxQty: 20 },
  { id: 'dryClean', unit: 'item', cents: 900, hours: 48, maxQty: 20 },
]

export const serviceById = (id: unknown): ServiceDef | undefined => SERVICES.find((s) => s.id === id)

export const LAUNDRY_NOTE_MAX = 200

export const WINDOWS = ['08:00', '13:00', '18:00'] as const
export const WINDOW_HOURS = 2

const HOUR = 3_600_000

/** What a request costs; a guest with the laundry perk has the first wash-and-fold bag free. */
export function laundryPrice(s: ServiceDef, qty: number, freeBagLeft: boolean): { total: Cents; free: Cents } {
  const gross = s.cents * qty
  const free = s.id === 'washFold' && freeBagLeft ? s.cents : 0
  return { total: gross - free, free }
}

export interface PickupOption { date: string; day: number; time: string; at: number }

/** The next pick-up windows with an hour's notice, whose return is in time for the last morning. */
export function pickupOptions(s: Sailing, now: number, service: ServiceDef, count = 6): PickupOption[] {
  const days = itinerary(s)
  const last = days[days.length - 1]
  const lastMorning = zonedToEpoch(last.date, '07:00', shipZoneOnDate(s, last.date))
  const out: PickupOption[] = []
  for (const d of days) {
    const zone = shipZoneOnDate(s, d.date)
    for (const time of WINDOWS) {
      const at = zonedToEpoch(d.date, time, zone)
      if (at - now >= HOUR && at + service.hours * HOUR <= lastMorning) out.push({ date: d.date, day: d.day, time, at })
    }
    if (out.length >= count) break
  }
  return out.slice(0, count)
}

export type LaundryStage = 'requested' | 'cleaning' | 'returned' | 'cancelled'

export interface LaundryTrack { stage: LaundryStage; returnAt: number }

export function laundryStage(r: { pickupAt: number; hours: number; cancelledAt?: number }, now: number): LaundryTrack {
  const returnAt = r.pickupAt + r.hours * HOUR
  if (r.cancelledAt !== undefined) return { stage: 'cancelled', returnAt }
  return { stage: now < r.pickupAt ? 'requested' : now < returnAt ? 'cleaning' : 'returned', returnAt }
}

/** A request can be cancelled until the steward collects it. */
export const laundryCancellable = (stage: LaundryStage): boolean => stage === 'requested'
