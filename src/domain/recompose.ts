import { excursionById, overlaps, type ExcursionItem } from './excursions'
import type { PlanDay } from './plan'

/**
 * The weather recomposer (QOL-15): when weather may affect a day, it lists the guest's reservations that day and, for each tour, up to two other tours at the same
 * port that fit. It only suggests. It never cancels, moves or books anything: the guest keeps each reservation until they act on it themselves, and the operator
 * decides whether a tour runs.
 */
export interface Impacted {
  kind: 'tour' | 'dinner'
  id: string
  name: string
  time: string
  guests: string[]
  /** Other tours at this port that do not overlap the guest's other tours and are not already booked. Empty for a dinner. */
  alternatives: { id: string; name: string }[]
}

export const ALTERNATIVES_MAX = 2

export function impactedOn(day: PlanDay | undefined, catalogue: readonly ExcursionItem[], excursionIdOf: (bookingId: string) => string | null): Impacted[] {
  if (!day) return []
  const bookedIds = new Set(day.entries.filter((e) => e.kind === 'tour' && e.id).map((e) => excursionIdOf(e.id!)).filter((x): x is string => !!x))
  const booked = [...bookedIds].map((id) => excursionById(id) ?? catalogue.find((c) => c.id === id)).filter((x): x is ExcursionItem => !!x)
  return day.entries.flatMap((e): Impacted[] => {
    if ((e.kind !== 'tour' && e.kind !== 'dinner') || !e.id) return []
    const base = { kind: e.kind, id: e.id, name: e.name, time: e.time, guests: e.guests, alternatives: [] as Impacted['alternatives'] }
    if (e.kind === 'dinner') return [base]
    const own = excursionIdOf(e.id)
    const others = booked.filter((b) => b.id !== own)
    const alternatives = catalogue
      .filter((c) => c.port === day.port && !bookedIds.has(c.id) && !others.some((o) => overlaps(c, o)))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
      .slice(0, ALTERNATIVES_MAX)
      .map((c) => ({ id: c.id, name: c.name }))
    return [{ ...base, alternatives }]
  })
}
