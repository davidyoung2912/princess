import { buildIcsCalendar } from '../calendar'
import type { ExplorerDay } from '../../api/explorerTypes'
import type { SpaView } from '../../api/spaTypes'
import type { DayTour, DiningView } from '../../api/types'
import { DINNER_MINUTES } from '../groupBoard'
import { sortItems, type PlanItem } from './planTimeline'
import type { ExplorerKind } from './types'

const MIN = 60_000

/** The screen a booked shore excursion links to. */
export const TOURS_PATH = '/plan/excursions'

/** Where each Explorer lives, so a plan line links back to its venue page. */
export const EXPLORER_PATHS: Readonly<Record<ExplorerKind, string>> = {
  dining: '/dining-today', entertainment: '/entertainment', shopping: '/shopping-today', spa: '/spa-explorer', exercise: '/exercise-explorer', activities: '/activities-explorer',
}

/**
 * Everything the guest has on a day, from what the Explorers served (`mine` lists the planned events), the dinner reservations, the spa appointments and the booked shore excursions, in time order.
 * `atMs` turns a ship date and "HH:MM" into an instant. A planned event the ship has since dropped from its list simply does not appear.
 */
export function buildPlanItems(o: { day: number; explorers: readonly ExplorerDay[]; dining: DiningView | null; spa: SpaView | null; tours?: readonly DayTour[] | null; atMs: (date: string, time: string) => number }): PlanItem[] {
  const items: PlanItem[] = []
  const venues = new Map<string, { title: string; placeId: string }>()
  const date = o.explorers.find((d) => d.day === o.day)?.date ?? ''
  for (const d of o.explorers) {
    for (const v of d.venues) {
      venues.set(`${d.explorer}:${v.venue.id}`, { title: v.venue.title, placeId: v.venue.placeId })
      for (const e of v.events) {
        if (!d.mine.includes(e.id)) continue
        items.push({ id: e.id, kind: 'event', explorer: d.explorer, venueId: v.venue.id, title: e.title, venueTitle: v.venue.title, placeId: v.venue.placeId, start: e.start, startAt: e.startAt, endAt: e.endAt, status: e.status, was: e.was, reason: e.reason })
      }
    }
  }
  const venue = (kind: ExplorerKind, id: string) => venues.get(`${kind}:${id}`) ?? { title: id, placeId: '' }
  for (const r of o.dining?.reservations ?? []) {
    if (r.day !== o.day || !date) continue
    const v = venue('dining', r.venueId)
    const startAt = o.atMs(date, r.time)
    items.push({ id: r.id, kind: 'dining', explorer: 'dining', venueId: r.venueId, title: v.title, venueTitle: v.title, placeId: v.placeId, start: r.time, startAt, endAt: startAt + DINNER_MINUTES * MIN, status: 'on', link: `/plan/reservations/${r.id}` })
  }
  for (const a of o.spa?.appointments ?? []) {
    if (a.day !== o.day) continue
    const v = venue('spa', a.venueId)
    items.push({ id: a.id, kind: 'spa', explorer: 'spa', venueId: a.venueId, title: a.title, venueTitle: v.title, placeId: v.placeId, start: a.time, startAt: a.startAt, endAt: a.startAt + a.minutes * MIN, status: 'on' })
  }
  for (const x of o.tours ?? []) {
    if (x.day !== o.day) continue
    items.push({ id: x.id, kind: 'tour', explorer: 'activities', venueId: '', title: x.name, venueTitle: x.port, placeId: '', start: x.start, startAt: x.startAt, endAt: x.endAt, status: 'on', link: TOURS_PATH })
  }
  return sortItems(items)
}

/** The day's plan as a calendar file, one entry per running item, each at its own ship time. Cancelled items are left out. */
export function planCalendar(items: readonly PlanItem[], o: { date: string; zone: string; stamp: number; product: string; where: string }): string {
  return buildIcsCalendar(items.filter((i) => i.status !== 'cancelled').map((i) => ({
    uid: `plan-${i.id}@${o.product}`, stamp: o.stamp, summary: i.title, description: i.venueTitle, location: i.venueTitle || o.where,
    start: o.date, end: o.date, at: i.start, zone: o.zone, minutes: Math.max(1, Math.round((i.endAt - i.startAt) / MIN)),
  })))
}
