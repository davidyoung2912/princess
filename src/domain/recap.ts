import { excursionById } from './excursions'
import { venueById } from './dining'
import { SUSTAINABILITY, milesPhrase } from './postcruise'
import { portName } from './catalogueBrowse'
import { cruiseOf, shipOf } from './shipCatalogue'
import { itinerary, type Sailing } from './sailings'
import { formatDate } from './cruise'

const shortPort = (id: string): string => portName(id).replace(/\s*\(.*\)$/, '')

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
  /** First names on the booking, and the cruise's own name (empty when it has none), as the title is made from them. */
  party: string[]
  cruiseName: string
  shipName: string
  nights: number
  dates: string
  /** Ports visited, home port first and last, in order. */
  ports: string[]
  seaDays: number
  nauticalMiles: number
  photos: number
  tourNames: string[]
  dinnerCount: number
  /** Every restaurant dined at, in the order of the first sitting, once each. */
  dinnerVenues: string[]
  /** The restaurant dined at most, with the count, or null when none was reserved. */
  favouriteMeal: { name: string; times: number } | null
}


export function buildRecap(i: RecapInput): Recap {
  const days = itinerary(i.sailing)
  const ports: string[] = []
  for (const d of days) if (d.port !== 'sea' && !ports.includes(shortPort(d.port))) ports.push(shortPort(d.port))
  const counts = new Map<string, number>()
  for (const id of i.dinners) if (venueById(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  // Most visited; a tie goes to the first in the ship's own list, so the answer never depends on booking order.
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return {
    title: `${i.party.join(' and ')}’s ${cruiseOf(i.sailing.id).name || 'cruise'}`,
    party: [...i.party],
    cruiseName: cruiseOf(i.sailing.id).name || '',
    shipName: shipOf(i.sailing.id).name || 'Princess',
    nights: days.length - 1,
    dates: `${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}`,
    ports,
    seaDays: days.filter((d) => d.port === 'sea').length,
    nauticalMiles: SUSTAINABILITY.nauticalMiles,
    photos: i.photos,
    tourNames: i.tours.map((id) => excursionById(id)?.name).filter((n): n is string => !!n),
    dinnerVenues: [...new Set(i.dinners)].map((id) => venueById(id)?.name).filter((n): n is string => !!n),
    dinnerCount: [...counts.values()].reduce((a, b) => a + b, 0),
    favouriteMeal: top ? { name: venueById(top[0])!.name, times: top[1] } : null,
  }
}

/** Plain text for sharing: a few lines that read well in a message and carry no private detail beyond first names. */
export function recapText(r: Recap): string {
  const lines = [
    r.title,
    `${r.nights} nights on ${r.shipName}, ${r.dates}.`,
    `Ports: ${r.ports.join(', ')}. ${r.seaDays} days at sea${milesPhrase(r.nauticalMiles)}.`,
  ]
  if (r.tourNames.length) lines.push(`Ashore: ${r.tourNames.join('; ')}.`)
  if (r.favouriteMeal) lines.push(`Favourite table: ${r.favouriteMeal.name}${r.favouriteMeal.times > 1 ? ` (${r.favouriteMeal.times} dinners)` : ''}.`)
  if (r.photos) lines.push(`${r.photos} photos to remember it by.`)
  return lines.join('\n')
}
