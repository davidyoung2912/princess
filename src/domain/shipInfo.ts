import { itinerary, type PortId, type Sailing } from './sailings'

/** Ship information (OB-06): the captain's announcement, the noon report and the bridge. Every figure is an authored concept value, the same every time for the same day. */
const hash = (text: string): number => {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}

export type Sky = 'sunny' | 'partly' | 'showers'
export const SKIES: readonly Sky[] = ['sunny', 'partly', 'showers']

export interface NoonReport {
  day: number
  /** Where the ship is at noon: a port, or at sea heading for the next one. */
  at: PortId
  next: PortId | null
  /** Knots through the water; 0 in port. */
  knots: number
  /** Nautical miles to the next port; 0 in port. */
  milesToNext: number
  sky: Sky
  airF: number
  waterF: number
  windKnots: number
  /** Wave height in feet. */
  waveFt: number
  announcement: string
}

const ANNOUNCEMENTS: readonly string[] = [
  'Welcome aboard. We are under way for the western Caribbean and expect a smooth first night.',
  'A full day at sea. The pools are open, and the Piazza has music from noon.',
  'Good morning from the bridge. We are alongside early; please watch the all-aboard time posted at the gangway.',
  'We are anchored off the port today. Tenders run from the Atrium; priority groups are called first.',
  'Another warm day ahead. Please take the all-aboard time from your app, and remember sun protection ashore.',
  'Back at sea. The clocks went back an hour overnight; the app already shows ship time.',
  'Our last full day. Luggage tags are in the cabin, and the final night guide is in the app.',
  'We are alongside in Fort Lauderdale. Disembarkation groups are called from the Piazza.',
]

/** The ports the ship is between at noon on a day, or the port it is in. */
function between(s: Sailing, day: number): { at: PortId; next: PortId | null } {
  const days = itinerary(s)
  const today = days[day - 1]
  if (today.port !== 'sea') return { at: today.port, next: null }
  return { at: 'sea', next: days.slice(day).find((d) => d.port !== 'sea')?.port ?? null }
}

/** The noon report for a cruise day, 1 to 8. Rejects nothing: a day out of range is held to the nearest end. */
export function noonReport(s: Sailing, rawDay: number): NoonReport {
  const day = Math.min(8, Math.max(1, Math.round(rawDay)))
  const where = between(s, day)
  const seed = `${s.id}|${day}`
  const inPort = where.at !== 'sea'
  return {
    day,
    ...where,
    knots: inPort ? 0 : 14 + (hash(`${seed}|k`) % 7),
    milesToNext: inPort ? 0 : 90 + (hash(`${seed}|m`) % 260),
    sky: SKIES[hash(`${seed}|s`) % (day === 4 ? 3 : 2)],
    airF: 78 + (hash(`${seed}|a`) % 9),
    waterF: 80 + (hash(`${seed}|w`) % 5),
    windKnots: 6 + (hash(`${seed}|n`) % 14),
    waveFt: 1 + (hash(`${seed}|f`) % 4),
    announcement: ANNOUNCEMENTS[day - 1],
  }
}
