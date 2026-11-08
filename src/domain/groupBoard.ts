import type { PlanDay, PlanEntry } from './plan'

/** The group plan board (N-P1): the shared week as a column for each day, who is doing each tour or dinner, who clashes, and who can join. */
export const DINNER_MINUTES = 90

export interface BoardItem {
  key: string
  kind: 'tour' | 'dinner'
  name: string
  time: string
  /** The booking id, the same as the plan entry's id. */
  bookingId: string
  guests: string[]
  start: number
  end: number
  /** People on this item who are also on another one at the same time. */
  clashing: string[]
}

export interface BoardDay { day: number; date: string; place: string; items: BoardItem[] }

const minutes = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const share = (a: readonly string[], b: readonly string[]): string[] => a.filter((x) => b.includes(x))

/** The tours and dinners of each day that have a booking, with who clashes. `hoursOf` is the length of a tour, or null when not known (then it is taken as one hour). */
export function boardDays(days: readonly PlanDay[], hoursOf: (bookingId: string) => number | null): BoardDay[] {
  return days.map((d) => {
    const items: BoardItem[] = d.entries
      .filter((e): e is PlanEntry & { id: string; kind: 'tour' | 'dinner' } => (e.kind === 'tour' || e.kind === 'dinner') && !!e.id)
      .map((e) => {
        const start = minutes(e.time)
        const length = e.kind === 'dinner' ? DINNER_MINUTES : Math.round((hoursOf(e.id) ?? 1) * 60)
        return { key: `${e.kind}-${e.id}`, kind: e.kind, name: e.name, time: e.time, bookingId: e.id, guests: e.guests, start, end: start + length, clashing: [] }
      })
    for (const a of items) {
      const clash = new Set<string>()
      for (const b of items) if (a !== b && a.start < b.end && b.start < a.end) for (const g of share(a.guests, b.guests)) clash.add(g)
      a.clashing = [...clash].sort()
    }
    return { day: d.day, date: d.date, place: d.place, items }
  })
}

/** Whether `who` may be offered a Join on this item: a tour they are not on, that does not overlap anything of theirs that day. */
export function canJoin(item: BoardItem, day: BoardDay, who: string, party: readonly string[]): boolean {
  if (item.kind !== 'tour' || !who || !party.includes(who) || item.guests.includes(who)) return false
  return !day.items.some((o) => o !== item && o.guests.includes(who) && item.start < o.end && o.start < item.end)
}

/** The guest list with `who` added. */
export const withGuest = (guests: readonly string[], who: string): string[] => (guests.includes(who) ? [...guests] : [...guests, who])
