import { api } from '../runtime'
import { allAboardFact, checkinFact, musterFact } from '../domain/tileLive'
import { daysBetween } from '../domain/trip'
import { dateIn } from '../domain/timezones'
import { pickMoment, type Moment } from '../domain/homeLook'
import { pickTrip } from './useStageFacts'
import { useNow } from './useDemo'
import { useOnboardToday } from './useOnboardToday'
import { useSharedMine } from './useSharedMine'

/** The one thing that matters now for the Home Moment card, from the guest's trip and, on board, today's drill and all-aboard. Null while loading or when nothing is pressing. */
export function useMoment(aboard: boolean): Moment | null {
  const now = useNow()
  const trips = useSharedMine('trips.list', () => api.trips.list())
  const today = useOnboardToday(aboard)
  const trip = trips.data ? pickTrip(trips.data.upcoming) : null
  const td = today.data
  return pickMoment({
    muster: td ? musterFact(td.muster, td.shipZone, now) : null,
    allAboard: allAboardFact(td?.portDay, now),
    checkin: trip && !aboard ? checkinFact(trip.checkin, now) : null,
    payment: trip && !aboard && trip.payment !== 'paid' ? { overdue: trip.payment === 'overdue', daysToFinal: daysBetween(dateIn(now, 'America/New_York'), trip.plan.finalDue) } : null,
  })
}
