import type { TripItem } from './reservationsByDay'

/** The three kinds of booking on the trip list. */
export const TRIP_KINDS = ['dining', 'spa', 'tour'] as const
export type TripKind = (typeof TRIP_KINDS)[number]
export const isTripKind = (v: unknown): v is TripKind => (TRIP_KINDS as readonly unknown[]).includes(v)

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const KIND_WORDS: Record<TripKind, string> = { dining: 'dinner dining restaurant table', spa: 'spa treatment appointment massage', tour: 'tour excursion shore' }

const flat = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Everything a guest might type to find a booking: its name, kind words, the day ("day 3"), the date as numbers and as "march 14", and its reference. */
export function tripSearchText(i: Pick<TripItem, 'title' | 'venueTitle' | 'kind' | 'day' | 'date' | 'id' | 'start'>): string {
  const [y, m, d] = i.date.split('-').map(Number)
  const month = m >= 1 && m <= 12 ? MONTHS[m - 1] : ''
  const dateWords = month ? `${month} ${d} ${month.slice(0, 3)} ${d} ${i.date} ${y}` : i.date
  return flat(`${i.title} ${i.venueTitle} ${KIND_WORDS[i.kind as TripKind] ?? ''} day ${i.day} ${dateWords} ${i.start} ${i.id}`)
}

export interface TripFilter { kinds: ReadonlySet<TripKind>; query: string }
export const NO_TRIP_FILTER: TripFilter = { kinds: new Set(), query: '' }
export const isTripFiltering = (f: TripFilter): boolean => f.kinds.size > 0 || f.query.trim() !== ''

/** The bookings that fit: any chosen kind (none chosen means all) and every word typed. */
export function filterTripItems<T extends Pick<TripItem, 'title' | 'venueTitle' | 'kind' | 'day' | 'date' | 'id' | 'start'>>(items: readonly T[], f: TripFilter): T[] {
  // "day 3" means the third day exactly, not any text containing a 3.
  const text = flat(f.query)
  const dayMatch = /\bday\s*(\d{1,2})\b/.exec(text)
  const day = dayMatch ? Number(dayMatch[1]) : null
  const words = (dayMatch ? text.replace(dayMatch[0], ' ') : text).split(/[^a-z0-9:-]+/).filter(Boolean)
  return items.filter((i) => (f.kinds.size === 0 || f.kinds.has(i.kind as TripKind)) && (day === null || i.day === day) && words.every((w) => tripSearchText(i).includes(w)))
}

/** Kinds read from a comma list in the address (`dining,spa`); anything else is dropped. */
export const readKinds = (raw: string | null): Set<TripKind> => new Set((raw ?? '').split(',').filter(isTripKind))
/** The comma list written to the address, in a fixed order; null when none. */
export const writeKinds = (kinds: ReadonlySet<TripKind>): string | null => (kinds.size === 0 ? null : TRIP_KINDS.filter((k) => kinds.has(k)).join(','))
