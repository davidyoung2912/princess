import { itinerary, portById, type ItineraryDay, type Sailing } from './sailings'

const dateFormat = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options })

/** "Sun, Mar 21, 2027" for a "YYYY-MM-DD" date. */
export const formatDate = (date: string): string => dateFormat({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`))

/** "Mar 21" for a "YYYY-MM-DD" date. */
export const formatDayMonth = (date: string): string => dateFormat({ day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`))

/** "9:00 AM" for a 24-hour "HH:MM" time. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "Mar 21 to Mar 28, 2027". */
export function sailingRange(s: Sailing): string {
  const days = itinerary(s)
  return `${formatDayMonth(s.departure)} to ${dateFormat({ month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${days[7].date}T12:00:00Z`))}`
}

export interface ItineraryStop extends ItineraryDay {
  /** Place name for the day, or "At sea". */
  place: string
  tender: boolean
}

export function stops(s: Sailing): ItineraryStop[] {
  return itinerary(s).map((d) => ({ ...d, place: d.port === 'sea' ? 'At sea' : portById(d.port)?.name ?? d.port, tender: d.port !== 'sea' && !!portById(d.port)?.tender }))
}
