import type { ExcursionOffer, ExcursionsView, TourBooking } from '../../api/types'
import type { Activity, Interest } from '../excursions'

/** The excursions that run on one cruise day, in start order. */
export const offersOnDay = (offers: readonly ExcursionOffer[], day: number): ExcursionOffer[] =>
  offers.filter((o) => o.day === day).sort((a, b) => a.item.start.localeCompare(b.item.start) || a.item.name.localeCompare(b.item.name))

/** The guest's live bookings for one day, with the offer each is for, in start order. */
export function bookingsOnDay(view: Pick<ExcursionsView, 'offers' | 'booked'>, day: number): { booking: TourBooking; offer: ExcursionOffer }[] {
  const out: { booking: TourBooking; offer: ExcursionOffer }[] = []
  for (const booking of view.booked) {
    if (booking.status !== 'booked') continue
    const offer = view.offers.find((o) => o.item.id === booking.excursionId)
    if (offer && offer.day === day) out.push({ booking, offer })
  }
  return out.sort((a, b) => a.offer.item.start.localeCompare(b.offer.item.start))
}

/** The nearest day to `from` (later days first on a tie) that has an excursion, or null when none run. */
export function nearestTourDay(offers: readonly ExcursionOffer[], from: number): number | null {
  const days = [...new Set(offers.map((o) => o.day))]
  if (days.length === 0) return null
  return days.sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || b - a)[0]
}

export interface DayFilter { interest: Interest | null; maxActivity: Activity | null; family: boolean; accessible: boolean }
export const NO_DAY_FILTER: DayFilter = { interest: null, maxActivity: null, family: false, accessible: false }

const LEVEL: readonly Activity[] = ['easy', 'moderate', 'strenuous']

/** The day's offers narrowed by the Explorer's filter chips. */
export const filterDayOffers = (offers: readonly ExcursionOffer[], f: DayFilter): ExcursionOffer[] =>
  offers.filter((o) => {
    const x = o.item
    if (f.interest && !x.interests.includes(f.interest)) return false
    if (f.maxActivity && LEVEL.indexOf(x.activity) > LEVEL.indexOf(f.maxActivity)) return false
    if (f.family && !x.family) return false
    if (f.accessible && !x.wheelchair) return false
    return true
  })
