import { itinerary, PORTS, type ItineraryDay, type PortId, type Sailing } from './sailings'
import { PORT_COORDS } from './ports'

/** The one cruise (requirements §22.6): 7-night Western Caribbean with Mexico, round trip Fort Lauderdale, on Sun Princess. */
export const CRUISE = {
  id: 'western-caribbean-7',
  name: '7-night Western Caribbean with Mexico',
  nights: 7,
  homePort: 'Fort Lauderdale (Port Everglades)',
  intro: 'Seven nights from Fort Lauderdale to Cozumel, Belize City and Roatán, with two sea days on the way home to enjoy the ship.',
  /** Reference "when to go" notes (DIS-02). */
  bestTime: 'Winter and early spring are dry and warm. Late December is busiest and dearest. November is quieter, at the end of hurricane season.',
} as const

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
  return itinerary(s).map((d) => ({ ...d, place: d.port === 'sea' ? 'At sea' : PORTS[d.port].name, tender: d.port !== 'sea' && PORTS[d.port].tender }))
}

/** The ports in sailing order, once each, home port first. */
export const ROUTE: readonly Exclude<PortId, 'sea'>[] = ['fll', 'cozumel', 'belize', 'roatan']

/** Positions for the route sketch on a width × height canvas, from real coordinates with a margin. */
export function routePoints(width: number, height: number, margin = 24): Record<Exclude<PortId, 'sea'>, { x: number; y: number }> {
  const all = ROUTE.map((id) => PORT_COORDS[id])
  const lons = all.map((c) => c[0])
  const lats = all.map((c) => c[1])
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const place = (lon: number, lat: number) => ({
    x: margin + ((lon - minLon) / (maxLon - minLon)) * (width - 2 * margin),
    y: margin + ((maxLat - lat) / (maxLat - minLat)) * (height - 2 * margin),
  })
  return Object.fromEntries(ROUTE.map((id) => [id, place(...PORT_COORDS[id])])) as Record<Exclude<PortId, 'sea'>, { x: number; y: number }>
}
