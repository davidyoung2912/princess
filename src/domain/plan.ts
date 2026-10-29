import { dayOf, excursionById } from './excursions'
import { venueById } from './dining'
import { itinerary, PORTS, type ItineraryDay, type PortId, type Sailing } from './sailings'

/** The Plan tab (PRE-15): everything booked and not yet booked, day by day. */
export interface PlanTour { id: string; excursionId: string; guests: string[] }
export interface PlanTable { id: string; venueId: string; day: number; time: string; guests: string[] }

export type EntryKind = 'sail' | 'allAboard' | 'tour' | 'dinner'

export interface PlanEntry {
  kind: EntryKind
  /** Sort key and display time, "HH:MM" (local to the port on port days, ship time otherwise). */
  time: string
  /** Name of the tour or restaurant; unused for sail and all-aboard. */
  name: string
  id?: string
  guests: string[]
}

/** Something that could be added to a day and has not been. */
export type GapKind = 'tour' | 'dinner'

export interface PlanDay {
  day: number
  date: string
  port: PortId
  place: string
  entries: PlanEntry[]
  gaps: GapKind[]
}

export function buildPlan(s: Sailing, tours: readonly PlanTour[], tables: readonly PlanTable[]): PlanDay[] {
  return itinerary(s).map((d: ItineraryDay): PlanDay => {
    const entries: PlanEntry[] = []
    if (d.depart && d.port === 'fll') entries.push({ kind: 'sail', time: d.depart, name: '', guests: [] })
    if (d.allAboard) entries.push({ kind: 'allAboard', time: d.allAboard, name: '', guests: [] })
    for (const t of tours) {
      const x = excursionById(t.excursionId)
      if (x && dayOf(s, x).day === d.day) entries.push({ kind: 'tour', time: x.start, name: x.name, id: t.id, guests: t.guests })
    }
    for (const r of tables) if (r.day === d.day) entries.push({ kind: 'dinner', time: r.time, name: venueById(r.venueId)?.name ?? r.venueId, id: r.id, guests: r.guests })
    entries.sort((a, b) => a.time.localeCompare(b.time))
    const gaps: GapKind[] = []
    if (d.port !== 'sea' && d.port !== 'fll' && !entries.some((e) => e.kind === 'tour')) gaps.push('tour')
    if (d.day <= 7 && !entries.some((e) => e.kind === 'dinner')) gaps.push('dinner')
    return { day: d.day, date: d.date, port: d.port, place: d.port === 'sea' ? '' : PORTS[d.port].name, entries, gaps }
  })
}

export const countBooked = (plan: readonly PlanDay[]): number => plan.reduce((n, d) => n + d.entries.filter((e) => e.kind === 'tour' || e.kind === 'dinner').length, 0)
