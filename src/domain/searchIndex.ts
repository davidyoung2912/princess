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
  /** Plain phrases that find the hit without being shown. */
  words?: string
  to: string
}

const flat = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const MIN_QUERY = 2
export const MAX_HITS = 30

interface Entry extends Hit { haystack: string; tokens: readonly string[]; weight: number }

const tokensOf = (text: string): string[] => text.split(/[^a-z0-9]+/).filter(Boolean)
const entry = (hit: Hit, text: string, weight: number): Entry => { const haystack = flat(`${hit.title} ${text}`); return { ...hit, haystack, tokens: tokensOf(haystack), weight } }

const INDEX: readonly Entry[] = [
  ...DIRECTORY.map((v) => entry({ kind: 'venue', id: v.id, title: v.name, detail: `${v.deck}. ${v.blurb}`, to: `/ship/venues/${v.id}` }, `${v.blurb} ${v.dishes.map((d) => d.name).join(' ')} ${v.price}`, 3)),
  ...EVENTS.map((e) => entry({ kind: 'event', id: e.id, title: e.title, detail: `${e.start}, ${PLACES.find((p) => p.id === e.placeId)?.name ?? ''}`, to: '/plan' }, `${e.interest} ${e.age} ${PLACES.find((p) => p.id === e.placeId)?.name ?? ''}`, 2)),
  ...PLACES.filter((p) => !DIRECTORY.some((v) => v.placeId === p.id)).map((p) => entry({ kind: 'place', id: p.id, title: p.name, detail: `Deck ${p.deck}, ${p.section}`, to: '/ship/map' }, `${p.kind} ${p.note ?? ''}`, 2)),
  ...ITEMS.map((i) => entry({ kind: 'service', id: i.id, title: i.title, detail: i.detail, to: i.group === 'spa' || i.group === 'fitness' ? '/ship/spa' : i.group === 'faith' ? '/ship/community' : i.group === 'access' ? '/ship/access' : '/ship/shops' }, `${i.detail} ${i.group}`, 2)),
  ...EXCURSIONS.map((x) => entry({ kind: 'tour', id: x.id, title: x.name, detail: x.summary, to: '/excursions-explorer' }, `${x.summary} ${x.interests.join(' ')} ${PORTS[x.port].name}`, 1)),
  ...Object.values(PORTS).map((p) => entry({ kind: 'port', id: p.id, title: p.name, detail: '', to: `/home/ports/${p.id}` }, '', 1)),
]

/** Small words that carry no meaning in a question ("where can I eat late"); they are ignored when a search is widened. */
const STOP = new Set(['a', 'an', 'the', 'i', 'me', 'my', 'we', 'is', 'are', 'am', 'do', 'does', 'can', 'could', 'how', 'what', 'where', 'when', 'who', 'which', 'to', 'of', 'for', 'on', 'in', 'at', 'and', 'or', 'it', 'there', 'get', 'find', 'need', 'want', 'please', 'with', 'about'])

/** Other words a guest may use for the same thing. Kept short on purpose; each group means the same to the guest. */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['toilet', 'restroom', 'bathroom', 'loo', 'washroom', 'wc'],
  ['doctor', 'medical', 'nurse', 'clinic', 'infirmary', 'sick'],
  ['food', 'eat', 'eating', 'restaurant', 'dining', 'meal', 'hungry'],
  ['drink', 'drinks', 'bar', 'cocktail', 'beer', 'wine'],
  ['kids', 'children', 'child', 'family', 'youth'],
  ['luggage', 'bags', 'bag', 'suitcase', 'baggage'],
  ['internet', 'wifi', 'online', 'connection'],
  ['cancel', 'refund', 'cancellation'],
  ['money', 'pay', 'payment', 'card', 'charge', 'bill'],
  ['pass', 'boarding', 'ticket'],
  ['swim', 'swimming', 'pool'],
  ['gym', 'fitness', 'workout', 'exercise'],
  ['show', 'theatre', 'theater', 'entertainment', 'performance'],
  ['trip', 'cruise', 'voyage', 'sailing'],
  ['wheelchair', 'accessible', 'accessibility', 'mobility'],
]
const SYNONYMS: ReadonlyMap<string, readonly string[]> = new Map(SYNONYM_GROUPS.flatMap((g) => g.map((w) => [w, g.filter((x) => x !== w)] as const)))

/** The word without a plural or "-ing" ending, so "towels" finds "towel". */
export const stem = (w: string): string => (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w)

/** True when the two words differ by at most one letter added, dropped, changed or swapped with its neighbour. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i)
}

/** How well an entry holds one word: 3 exactly, 2 by plural or a synonym, 1 by a small typo (longer words only), 0 not at all. */
function wordMatch(e: Entry, w: string): number {
  if (e.haystack.includes(w)) return 3
  const stemmed = stem(w)
  if (stemmed.length >= 3 && e.haystack.includes(stemmed)) return 2
  if ((SYNONYMS.get(w) ?? SYNONYMS.get(stemmed) ?? []).some((x) => e.haystack.includes(x))) return 2
  if (w.length >= 5 && e.tokens.some((tok) => tok.length >= 4 && withinOneEdit(tok, w))) return 1
  return 0
}

/**
 * Everything that matches the query, best first, at most `MAX_HITS`. Every word has to match (exactly, as a plural, by a synonym, or with one small typo in a longer word).
 * When nothing does, the search widens: small question words are dropped and entries holding most of the rest are offered, the ones holding more first. `extra` adds screens the caller knows by name; `allow` keeps only the results the guest may open.
 */
export function searchContent(query: string, extra: readonly Hit[] = [], allow: (to: string) => boolean = () => true): Hit[] {
  const words = flat(query).split(/\s+/).filter(Boolean)
  if (words.length === 0 || flat(query).trim().length < MIN_QUERY) return []
  const pool: Entry[] = [...INDEX, ...extra.map((h) => entry(h, `${h.detail} ${h.words ?? ''}`, 3))].filter((e) => allow(e.to))
  const rank = (found: { e: Entry; quality: number }[]): Hit[] => found
    .map(({ e, quality }) => ({ e, score: quality + e.weight + (words.every((w) => flat(e.title).includes(w)) ? 10 : 0) + (flat(e.title).startsWith(words[0]) ? 5 : 0) }))
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title))
    .slice(0, MAX_HITS)
    .map(({ e }) => ({ kind: e.kind, id: e.id, title: e.title, detail: e.detail, to: e.to }))
  const scored = pool.map((e) => ({ e, per: words.map((w) => wordMatch(e, w)) }))
  const all = scored.filter(({ per }) => per.every((m) => m > 0)).map(({ e, per }) => ({ e, quality: per.reduce((x, y) => x + y, 0) / per.length }))
  if (all.length > 0) return rank(all)
  const meaningful = words.filter((w) => !STOP.has(w) && w.length >= 2)
  if (meaningful.length < 2 && words.length === meaningful.length) return []
  if (meaningful.length === 0) return []
  const need = Math.max(1, Math.ceil(meaningful.length / 2))
  const partial = scored
    .map(({ e }) => ({ e, matched: meaningful.filter((w) => wordMatch(e, w) > 0).length }))
    .filter(({ matched }) => matched >= need)
    .map(({ e, matched }) => ({ e, quality: (matched / meaningful.length) * 3 }))
  return rank(partial)
}

/** A written answer that search can offer: a help question or one of Stanley's. `text` is searched but not shown in the result line. */
export interface AnswerDoc { id: string; question: string; text: string }

/**
 * The answers that match the query, best first, by the same rules as `searchContent` (every word, with plurals, synonyms and small typos; widened to most words when nothing matches all).
 * A match in the question counts more than one in the answer.
 */
export function searchAnswers<T extends AnswerDoc>(query: string, docs: readonly T[], max = 5): T[] {
  const hits = searchContent(query, docs.map((d) => ({ kind: 'screen', id: d.id, title: d.question, detail: '', words: d.text, to: `answer:${d.id}` })), (to) => to.startsWith('answer:'))
  const byId = new Map(docs.map((d) => [d.id, d]))
  return hits.slice(0, max).map((h) => byId.get(h.id)).filter((d): d is T => d !== undefined)
}
