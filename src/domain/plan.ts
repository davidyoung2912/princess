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
  const all = itinerary(s)
  const lastDay = all[all.length - 1]?.day
  return all.map((d: ItineraryDay): PlanDay => {
    const entries: PlanEntry[] = []
    if (d.depart && d.day === 1) entries.push({ kind: 'sail', time: d.depart, name: '', guests: [] })
    if (d.allAboard) entries.push({ kind: 'allAboard', time: d.allAboard, name: '', guests: [] })
    for (const t of tours) {
      const x = excursionById(t.excursionId)
      if (x && dayOf(s, x).day === d.day) entries.push({ kind: 'tour', time: x.start, name: x.name, id: t.id, guests: t.guests })
    }
    for (const r of tables) if (r.day === d.day) entries.push({ kind: 'dinner', time: r.time, name: venueById(r.venueId)?.name ?? r.venueId, id: r.id, guests: r.guests })
    entries.sort((a, b) => a.time.localeCompare(b.time))
    const gaps: GapKind[] = []
    if (d.port !== 'sea' && d.day !== 1 && d.day !== lastDay && !entries.some((e) => e.kind === 'tour')) gaps.push('tour')
    if (d.day <= 7 && !entries.some((e) => e.kind === 'dinner')) gaps.push('dinner')
    return { day: d.day, date: d.date, port: d.port, place: d.port === 'sea' ? '' : PORTS[d.port].name, entries, gaps }
  })
}

export const countBooked = (plan: readonly PlanDay[]): number => plan.reduce((n, d) => n + d.entries.filter((e) => e.kind === 'tour' || e.kind === 'dinner').length, 0)

/** An item the guest has planned for a day (an accepted change from the week planner or assistant) that is not a booking (PRE-01). It is shown apart from confirmed ones. */
export interface PlannedEntry { id: string; time: string; title: string; kind: 'tour' | 'event' | 'dinner' | 'added' }

/**
 * What is planned for one day but not booked: the entries added by accepted changes, less any a later accepted change dropped. Proposed, declined and undone
 * changes are not plans. Anything at the same time and kind as a confirmed entry is a booking already, so it is left out.
 */
export function plannedForDay(changes: readonly import('./planChange').Change[], day: PlanDay): PlannedEntry[] {
  const accepted = changes.filter((c) => c.status === 'accepted' && c.day === day.day).sort((a, b) => (a.decidedAt ?? a.proposedAt) - (b.decidedAt ?? b.proposedAt))
  const map = new Map<string, PlannedEntry>()
  for (const c of accepted) {
    for (const e of c.edits) {
      if (e.op === 'add') map.set(e.entry.id, { id: e.entry.id, time: e.entry.start, title: e.entry.title, kind: e.entry.kind })
      else if (e.op === 'drop') map.delete(e.id)
      else { const cur = map.get(e.id); if (cur) map.set(e.id, { ...cur, time: e.to }) }
    }
  }
  const booked = (p: PlannedEntry) => day.entries.some((x) => (x.kind === 'tour' || x.kind === 'dinner') && x.kind === p.kind && x.time === p.time)
  return [...map.values()].filter((p) => !booked(p)).sort((a, b) => a.time.localeCompare(b.time))
}
