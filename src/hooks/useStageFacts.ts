import type { OnboardToday, TripView } from '../api/types'
import { daysBetween } from '../domain/trip'
import { dateIn } from '../domain/timezones'
import { api } from '../runtime'
import type { HomeFacts } from '../routes/stageHome'
import { useJourneyPosition } from './useJourneyPosition'
import { useMine } from './useMine'
import { useNow } from './useDemo'

/** The trip the guest is on, from the trips list: their own booking first. */
export const pickTrip = (upcoming: readonly TripView[]): TripView | null => upcoming.find((x) => x.kind === 'current') ?? upcoming[0] ?? null

/** What Home can tell about the guest (saved sailings, the booking draft, the trip, being aboard), from what the server has said. Shared by Home's Next steps and the stage welcome's progress. */
export function useStageFacts(trip: TripView | null, today: OnboardToday | null): { facts: HomeFacts; draftId: string | null } {
  const { day } = useJourneyPosition()
  const favourites = useMine(() => api.discover.favourites())
  const draft = useMine(() => api.booking.draft())
  const now = useNow()
  const d = draft.data
  const facts: HomeFacts = {
    savedSailings: (favourites.data ?? []).filter((k) => k.startsWith('sailing:')).length,
    draft: d ? { id: d.id, categoryChosen: d.category !== '', started: d.category !== '' || d.people.some((p) => p.firstName !== '' || p.lastName !== '') } : null,
    trip: trip && { number: trip.number, paid: trip.payment === 'paid', documentsOk: !!trip.documents && trip.documents.missing === 0 && trip.documents.passportProblems === 0, checkinDone: trip.checkin.state === 'done', agent: trip.kind !== 'booked',
      daysToFinal: daysBetween(dateIn(now, 'America/New_York'), trip.plan.finalDue), daysToDeparture: trip.daysToDeparture, checkinOpen: trip.checkin.state === 'open' },
    aboard: today?.aboard ? { musterDone: today.muster.done, lastFullDay: day?.kind === 'cruiseDay' && day.day >= day.of - 1 } : null,
  }
  return { facts, draftId: d?.id ?? null }
}
