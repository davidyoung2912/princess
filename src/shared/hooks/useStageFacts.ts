import type { TripView } from '../api/types'
import { api } from '../../app/runtime'
import type { HomeFacts } from '../../app/routes/stageHome'
import { useMine } from './useMine'

/** The trip the guest is on, from the trips list: their own booking first. */
export const pickTrip = (upcoming: readonly TripView[]): TripView | null => upcoming.find((x) => x.kind === 'current') ?? upcoming[0] ?? null

/** What Home's tiles can tell about the guest (saved sailings, the booking draft), from what the server has said. The plan itself is the guide (`useGuideView`). */
export function useStageFacts(): { facts: HomeFacts; draftId: string | null } {
  const favourites = useMine(() => api.discover.favourites())
  const draft = useMine(() => api.booking.draft())
  const d = draft.data
  const facts: HomeFacts = {
    savedSailings: (favourites.data ?? []).filter((k) => k.startsWith('sailing:')).length,
    draft: d ? { id: d.id, categoryChosen: d.category !== '', started: d.category !== '' || d.people.some((p) => p.firstName !== '' || p.lastName !== '') } : null,
  }
  return { facts, draftId: d?.id ?? null }
}
