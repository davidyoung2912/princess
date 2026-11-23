import { asDiningView } from '../../../../shared/api/guards'
import type { DiningView } from '../../../../shared/api/types'
import type { Span } from '../../domain/presentation'
import { usePersona } from '../../../../shared/hooks/useDemo'
import { useSavedCopy } from '../../../../shared/hooks/useSavedCopy'
import { api } from '../../../../app/runtime'

/** The length of a dinner on the guest's plan, for spotting an event that overlaps it. */
const DINNER_MINUTES = 90

export function useDiningView() {
  const me = usePersona()
  return useSavedCopy('dining', me?.booker ?? 'none', () => api.plan.dining.view(), asDiningView, [me?.id])
}

/** The spans of time the guest's reservations on a day fill, so an event that overlaps one is flagged. */
export function reservationSpans(view: DiningView | null, day: number, date: string, venueTitle: (id: string) => string, atMs: (date: string, time: string) => number): Span[] {
  return (view?.reservations ?? []).filter((r) => r.day === day).map((r) => ({ id: r.id, title: venueTitle(r.venueId), startAt: atMs(date, r.time), endAt: atMs(date, r.time) + DINNER_MINUTES * 60_000 }))
}
