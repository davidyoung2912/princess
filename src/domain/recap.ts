import { excursionById } from './excursions'
import { venueById } from './dining'
import { SUSTAINABILITY } from './postcruise'
import { itinerary, type Sailing } from './sailings'
import { formatDate } from './cruise'

/** Trip memories (POS-03): the facts of a finished cruise gathered into a recap, and the words to share. Pure; the screen supplies what the guest booked and kept. */
export interface RecapInput {
  sailing: Sailing
  /** First names of the guests on the booking. */
  party: readonly string[]
  /** Excursion ids the party took (booked, not cancelled). */
  tours: readonly string[]
  /** Venue ids of dinners reserved, one per sitting. */
  dinners: readonly string[]
  /** Photos in the guest's gallery. */
  photos: number
}

export interface Recap {
  title: string
  nights: number
  dates: string
  /** Ports visited, home port first and last, in order. */
  ports: string[]
  seaDays: number
  nauticalMiles: number
  photos: number
  tourNames: string[]
  dinnerCount: number
  /** The restaurant dined at most, with the count, or null when none was reserved. */
  favouriteMeal: { name: string; times: number } | null
}

const PORT_NAMES: Record<string, string> = { fll: 'Fort Lauderdale', cozumel: 'Cozumel', belize: 'Belize City', roatan: 'Roatán' }

export function buildRecap(i: RecapInput): Recap {
  const days = itinerary(i.sailing)
  const ports: string[] = []
  for (const d of days) if (d.port !== 'sea' && PORT_NAMES[d.port] && !ports.includes(PORT_NAMES[d.port])) ports.push(PORT_NAMES[d.port])
  const counts = new Map<string, number>()
  for (const id of i.dinners) if (venueById(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  // Most visited; a tie goes to the first in the ship's own list, so the answer never depends on booking order.
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return {
    title: `${i.party.join(' and ')}’s Western Caribbean`,
    nights: days.length - 1,
    dates: `${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}`,
    ports,
    seaDays: days.filter((d) => d.port === 'sea').length,
    nauticalMiles: SUSTAINABILITY.nauticalMiles,
    photos: i.photos,
    tourNames: i.tours.map((id) => excursionById(id)?.name).filter((n): n is string => !!n),
    dinnerCount: [...counts.values()].reduce((a, b) => a + b, 0),
    favouriteMeal: top ? { name: venueById(top[0])!.name, times: top[1] } : null,
  }
}

/** Plain text for sharing: a few lines that read well in a message and carry no private detail beyond first names. */
export function recapText(r: Recap): string {
  const lines = [
    r.title,
    `${r.nights} nights on Sun Princess, ${r.dates}.`,
    `Ports: ${r.ports.join(', ')}. ${r.seaDays} days at sea, about ${r.nauticalMiles.toLocaleString('en-US')} nautical miles.`,
  ]
  if (r.tourNames.length) lines.push(`Ashore: ${r.tourNames.join('; ')}.`)
  if (r.favouriteMeal) lines.push(`Favourite table: ${r.favouriteMeal.name}${r.favouriteMeal.times > 1 ? ` (${r.favouriteMeal.times} dinners)` : ''}.`)
  if (r.photos) lines.push(`${r.photos} photos to remember it by.`)
  return lines.join('\n')
}
