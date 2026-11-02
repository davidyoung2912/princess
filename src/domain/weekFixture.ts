import type { Week, WeekPrefs } from './autopilot'
import type { PlanEntry } from './planChange'
import { itinerary, type Sailing } from './sailings'

const dinner: PlanEntry = { id: 'eclipse', title: 'Dinner', start: '18:30', minutes: 90, kind: 'dinner', outdoor: false, path: '/plan/dining' }
const trivia: PlanEntry = { id: 'trivia', title: 'Trivia', start: '14:00', minutes: 45, kind: 'event', placeId: 'live', outdoor: false, path: '/plan' }

/** For tests only: a week shaped like the server's answer. Every day has trivia and dinner under the guest's wishes; a relaxed week keeps dinner and drops trivia. */
export function fixtureWeek(s: Sailing, prefs: WeekPrefs): Week {
  const keep = prefs.pace === 'relaxed' ? [dinner] : [dinner, trivia]
  const days = itinerary(s).map((d) => ({
    day: d.day, port: d.port, restDay: false, alternative: null, tourCost: 0, base: [trivia, dinner], target: keep,
    items: keep.map((e) => ({ kind: e.kind as 'event' | 'dinner', id: e.id, title: e.title, start: e.start, why: '' })),
  }))
  return { days, totalTours: 0, prefs }
}
