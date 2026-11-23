import { asSpaView } from '../../../../shared/api/guards'
import type { SpaView } from '../../../../shared/api/spaTypes'
import type { Span } from '../../domain/presentation'
import { usePersona } from '../../../../shared/hooks/useDemo'
import { useSavedCopy } from '../../../../shared/hooks/useSavedCopy'
import { api } from '../../../../app/runtime'

/** The guest's spa appointments, the ship's treatments and the cancellation policy, with a copy kept for offline use. */
export function useSpaView() {
  const me = usePersona()
  return useSavedCopy('spa', me?.booker ?? 'none', () => api.plan.spa.view(), asSpaView, [me?.id])
}

/** The spans of time the guest's appointments on a day fill, so an event that overlaps one is flagged. */
export function appointmentSpans(view: SpaView | null, day: number): Span[] {
  return (view?.appointments ?? []).filter((a) => a.day === day).map((a) => ({ id: a.id, title: a.title, startAt: a.startAt, endAt: a.startAt + a.minutes * 60_000 }))
}
