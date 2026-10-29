import { ITEMS } from './catalogue'
import { PLACES } from './deck'
import { EXCURSIONS } from './excursions'
import { DIRECTORY } from './menus'
import { EVENTS } from './program'
import { PORTS } from './sailings'

/** Search across the content of the ship (OB-07): places, food, shows, services, excursions and ports. One word or several; every word has to match. */
export type HitKind = 'venue' | 'event' | 'place' | 'service' | 'tour' | 'port' | 'screen'

export interface Hit {
  kind: HitKind
  id: string
  title: string
  detail: string
  to: string
}

const flat = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const MIN_QUERY = 2
export const MAX_HITS = 30

interface Entry extends Hit { haystack: string; weight: number }

const entry = (hit: Hit, text: string, weight: number): Entry => ({ ...hit, haystack: flat(`${hit.title} ${text}`), weight })

const INDEX: readonly Entry[] = [
  ...DIRECTORY.map((v) => entry({ kind: 'venue', id: v.id, title: v.name, detail: `${v.deck}. ${v.blurb}`, to: `/ship/venues/${v.id}` }, `${v.blurb} ${v.dishes.map((d) => d.name).join(' ')} ${v.price}`, 3)),
  ...EVENTS.map((e) => entry({ kind: 'event', id: e.id, title: e.title, detail: `${e.start}, ${PLACES.find((p) => p.id === e.placeId)?.name ?? ''}`, to: '/plan' }, `${e.interest} ${e.age} ${PLACES.find((p) => p.id === e.placeId)?.name ?? ''}`, 2)),
  ...PLACES.filter((p) => !DIRECTORY.some((v) => v.placeId === p.id)).map((p) => entry({ kind: 'place', id: p.id, title: p.name, detail: `Deck ${p.deck}, ${p.section}`, to: '/ship/map' }, `${p.kind} ${p.note ?? ''}`, 2)),
  ...ITEMS.map((i) => entry({ kind: 'service', id: i.id, title: i.title, detail: i.detail, to: i.group === 'spa' || i.group === 'fitness' ? '/ship/spa' : i.group === 'faith' ? '/ship/community' : i.group === 'access' ? '/ship/access' : '/ship/shops' }, `${i.detail} ${i.group}`, 2)),
  ...EXCURSIONS.map((x) => entry({ kind: 'tour', id: x.id, title: x.name, detail: x.summary, to: '/plan/excursions' }, `${x.summary} ${x.interests.join(' ')} ${PORTS[x.port].name}`, 1)),
  ...Object.values(PORTS).map((p) => entry({ kind: 'port', id: p.id, title: p.name, detail: '', to: `/home/ports/${p.id}` }, '', 1)),
]

/** Everything whose text holds every word of the query, best matches first (title matches before the rest), at most `MAX_HITS`. `extra` adds screens the caller knows by name. */
export function searchContent(query: string, extra: readonly Hit[] = []): Hit[] {
  const words = flat(query).split(/\s+/).filter(Boolean)
  if (words.length === 0 || flat(query).trim().length < MIN_QUERY) return []
  const pool: Entry[] = [...INDEX, ...extra.map((h) => entry(h, h.detail, 3))]
  return pool
    .filter((e) => words.every((w) => e.haystack.includes(w)))
    .map((e) => ({ e, score: e.weight + (words.every((w) => flat(e.title).includes(w)) ? 10 : 0) + (flat(e.title).startsWith(words[0]) ? 5 : 0) }))
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title))
    .slice(0, MAX_HITS)
    .map(({ e }) => ({ kind: e.kind, id: e.id, title: e.title, detail: e.detail, to: e.to }))
}
