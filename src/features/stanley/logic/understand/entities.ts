/**
 * Entities (docs/stanley-answers-plan.md, Phase 2): the things a guest names that the app already holds, found in a question by name. Venues, shows, tours, ports, countries, spa and shop services and ship places all come from
 * `src/domain`, the same catalogue the search reads, so nothing is written twice. Pure; the index is rebuilt only when the catalogue's size changes (it is filled from the server after the app starts).
 *
 * A name matches when every one of its distinctive words is in the question (a word may have one or two letters out of place), or when one word of it is found nowhere else in the catalogue ("crown" finds the Crown Grill).
 * A word that is an ordinary word of the lexicon ("grill", "spa", "bar") never identifies a place by itself.
 */
import { ITEMS } from '../../../../domain/catalogue'
import { PLACES } from '../../../../domain/deck'
import { EXCURSIONS } from '../../../../domain/excursions'
import { DIRECTORY } from '../../../../domain/menus'
import { catalogueShips } from '../../../../domain/shipCatalogue'
import { EVENTS } from '../../../../domain/program'
import { CATALOGUE_PORTS, PORTS } from '../../../../domain/sailings'
import { t } from '../../../../shared/i18n'
import { SCREEN_LIST } from '../../../../app/routes/screens'
import { CONCEPTS, COMMON_WORDS, STOP_WORDS } from './lexicon'
import { wordsOf } from './normalise'
import { distance } from './spell'
import { stem } from './stem'

export type EntityKind = 'venue' | 'show' | 'tour' | 'port' | 'country' | 'service' | 'place' | 'ship' | 'game'

export interface Entity {
  id: string
  kind: EntityKind
  name: string
  /** The page about it. */
  path: string
  /** The stemmed words of its name that count (filler such as "the" and "room" left out). */
  tokens: readonly string[]
  /** For a tour: the port it leaves from. For a port: its own id. */
  port?: string
}

export interface EntityMatch { entity: Entity; /** How many of its words were found, out of how many. */ found: number; of: number }

/** Words in a name that say what kind of place it is, not which one. */
const FILLER = new Set('the a an of and at in on by to for with de la el le dining room deck lounge restaurant'.split(' '))

const MIN_WORD = 3

let lexiconWords: Set<string> | null = null
const ordinary = (w: string): boolean => {
  if (!lexiconWords) {
    lexiconWords = new Set<string>()
    for (const c of CONCEPTS) for (const word of c.words) for (const part of wordsOf(word)) lexiconWords.add(stem(part))
    for (const w2 of [...STOP_WORDS, ...COMMON_WORDS]) for (const part of wordsOf(w2)) lexiconWords.add(stem(part))
  }
  return lexiconWords.has(w)
}

const tokensOf = (name: string): string[] => [...new Set(wordsOf(name).filter((w) => w.length >= MIN_WORD && !FILLER.has(w)).map(stem))]

const serviceRoute = (group: string): string => (group === 'spa' || group === 'fitness' ? '/ship/spa' : group === 'faith' ? '/ship/community' : group === 'access' ? '/ship/access' : '/ship/shops')

function collect(): Entity[] {
  const out: Entity[] = []
  const add = (id: string, kind: EntityKind, name: string, path: string, port?: string) => {
    const tokens = tokensOf(name)
    if (tokens.length > 0) out.push({ id: `${kind}:${id}`, kind, name, path, tokens, port })
  }
  for (const v of DIRECTORY) add(v.id, 'venue', v.name, `/ship/venues/${v.id}`)
  for (const e of EVENTS) add(e.id, 'show', e.title, '/entertainment')
  for (const x of EXCURSIONS) add(x.id, 'tour', x.name, `/excursions-explorer/${x.id}`, x.port)
  const seen = new Set<string>()
  for (const p of [...Object.values(PORTS), ...Object.values(CATALOGUE_PORTS)]) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    add(p.id, 'port', p.name, `/home/ports/${p.id}`, p.id)
  }
  const countries = new Set<string>()
  for (const p of [...Object.values(PORTS), ...Object.values(CATALOGUE_PORTS)]) {
    if (p.country && p.countryCode && !countries.has(p.countryCode)) { countries.add(p.countryCode); add(p.countryCode.toLowerCase(), 'country', p.country, `/home/countries/${p.countryCode.toLowerCase()}`) }
  }
  for (const sh of catalogueShips()) add(sh.id, 'ship', sh.name, `/home/ships/${sh.id}`)
  for (const i of ITEMS) add(i.id, 'service', i.title, serviceRoute(i.group))
  for (const s of SCREEN_LIST) if (s.path.startsWith('/games-explorer/')) add(s.id, 'game', t(s.titleKey), s.path)
  const named = new Set(DIRECTORY.map((v) => v.placeId))
  for (const p of PLACES) if (!named.has(p.id)) add(p.id, 'place', p.name, '/ship/map')
  return out
}

interface Index { entities: Entity[]; /** How many entities each token appears in. */ spread: Map<string, number>; signature: string }
let index: Index | null = null

const signature = (): string => [DIRECTORY.length, EVENTS.length, EXCURSIONS.length, Object.keys(PORTS).length, Object.keys(CATALOGUE_PORTS).length, ITEMS.length, PLACES.length, catalogueShips().length].join('.')

/** Every entity the catalogue holds now. */
export function entityIndex(): Index {
  const sig = signature()
  if (index && index.signature === sig) return index
  const entities = collect()
  const spread = new Map<string, number>()
  for (const e of entities) for (const t of e.tokens) spread.set(t, (spread.get(t) ?? 0) + 1)
  index = { entities, spread, signature: sig }
  return index
}

/** Whether a typed word is this name word: the same stem, or one slip in a long enough word, two in a very long one. */
function same(word: string, token: string): boolean {
  if (word === token) return true
  // An ordinary word that is not the name's word is never read as a slip of it ("dinner" is not "diner").
  if (ordinary(word)) return false
  if (token.length < 5 || word.length < 5 || word[0] !== token[0]) return false
  return distance(word, token, token.length >= 8 ? 2 : 1) <= (token.length >= 8 ? 2 : 1)
}

/** At most this many entities are returned for one question. */
export const MAX_ENTITIES = 2

/** The entities a question names, the best matches first. A name found only in part is returned when its one found word is found nowhere else. */
export function findEntities(text: string): EntityMatch[] {
  const typed = wordsOf(text).map(stem)
  if (typed.length === 0) return []
  const { entities, spread } = entityIndex()
  const found: EntityMatch[] = []
  for (const e of entities) {
    const hit = e.tokens.filter((tok) => typed.some((w) => same(w, tok)))
    if (hit.length === 0) continue
    const whole = hit.length === e.tokens.length
    // A name that has only ordinary words ("Main Pool") must match completely, and a name with a mix needs its distinctive word.
    const distinctive = hit.some((tok) => !ordinary(tok) && (spread.get(tok) ?? 0) === 1)
    if (whole ? e.tokens.length === 1 && ordinary(e.tokens[0]!) && e.kind !== 'game' : !distinctive) continue
    found.push({ entity: e, found: hit.length, of: e.tokens.length })
  }
  const share = (m: EntityMatch) => m.found / m.of
  found.sort((a, b) => share(b) - share(a) || b.found - a.found || a.entity.name.length - b.entity.name.length || (a.entity.id < b.entity.id ? -1 : 1))
  // Keep one entity per name and drop a shorter match a longer one on the same words already covers.
  const out: EntityMatch[] = []
  for (const m of found) {
    if (out.length >= MAX_ENTITIES) break
    if (out.some((o) => o.entity.kind === m.entity.kind && o.found >= m.found && m.entity.tokens.every((tok) => o.entity.tokens.includes(tok)))) continue
    out.push(m)
  }
  return out
}
