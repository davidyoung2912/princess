import { t, type StringKey } from '../../i18n'
import { en } from '../../i18n/locales/en'
import type { JourneyStage } from '../../routes/hubs'
import { BOOK } from './book'
import { DISCOVER } from './discover'
import { DISEMBARK } from './disembark'
import { DREAM } from './dream'
import { EMBARK } from './embark'
import { GET_TO_SHIP } from './getToShip'
import { MANAGE } from './manage'
import { PORT } from './port'
import { PREBOOK } from './prebook'
import { REMEMBER } from './remember'
import { SEA } from './sea'
import type { LibraryEntry } from './types'

export type { LibraryEntry } from './types'

/** Every authored entry, in the order of the journey: Dream to Book, then Manage, Prebook and Get to the ship, then Embark, Sea, Port and Disembark, then Remember. */
export const LIBRARY: readonly LibraryEntry[] = [...DREAM, ...DISCOVER, ...BOOK, ...MANAGE, ...PREBOOK, ...GET_TO_SHIP, ...EMBARK, ...SEA, ...PORT, ...DISEMBARK, ...REMEMBER]

export const questionOf = (e: LibraryEntry): string => t(`stanley.q.${e.id}` as StringKey)
export const answerOf = (e: LibraryEntry): string => t(`stanley.a.${e.id}` as StringKey)

/**
 * Questions written for one page only, found from the locale file: `stanley.q.pg.<page>.<n>` and `stanley.a.pg.<page>.<n>` (and `stanley.r.pg.<page>.<n>`, the screen ids of related pages, separated by spaces), where the page is a screen id
 * (`H02`) or a tab landing page (`tab.plan`). They name no stage, so they show on their page at every point in the journey, and they are kept out of
 * {@link LIBRARY} so that typed questions are only ever matched against the general library.
 */
export const PAGE_QA: readonly LibraryEntry[] = Object.keys(en).flatMap((k) => {
  const m = /^stanley\.q\.(pg\.(.+)\.\d+)$/.exec(k)
  if (!m) return []
  const related = `stanley.r.${m[1]}` in en ? t(`stanley.r.${m[1]}` as StringKey).split(' ').filter(Boolean) : []
  return [{ id: m[1]!, stages: [], screens: [m[2]!], ...(related.length ? { related } : {}) }]
})

/** Most chips shown at the foot of a page. */
export const MAX_CHIPS = 4

/**
 * The question chips for a page. On a page (`screenId`) they are only questions about that page: the general entries written for it at this stage,
 * then the ones written for the page alone, up to {@link MAX_CHIPS}. With no page, which is the Home tab's front page, they are the stage's general
 * questions. The order is the order of writing, so a page does not shuffle between visits.
 */
export function chipsFor(screenId: string | undefined, stage: JourneyStage, max = MAX_CHIPS): LibraryEntry[] {
  if (screenId) return [...LIBRARY.filter((e) => e.stages.includes(stage) && e.screens.includes(screenId)), ...PAGE_QA.filter((e) => e.screens.includes(screenId))].slice(0, max)
  return LIBRARY.filter((e) => e.stages.includes(stage)).slice(0, max)
}

const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'do', 'does', 'did', 'i', 'my', 'me', 'we', 'you', 'it', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'can', 'what', 'how', 'when', 'why', 'which', 'if', 'at', 'be', 'there', 'this', 'that', 'with', 'will', 'should', 'about', 'get', 'have', 'has', 'mean', 'means', 'work', 'works'])

const tokens = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)).filter((w) => w.length > 1 && !STOP.has(w))

/** The share of a question's own words found in what was typed, and how many words matched. */
export function scoreEntry(typed: readonly string[], entry: LibraryEntry, question: string): { score: number; shared: number } {
  const own = new Set(tokens(question))
  const extra = new Set(tokens(entry.words ?? ''))
  const have = new Set(typed)
  let shared = 0
  for (const w of own) if (have.has(w)) shared++
  let hints = 0
  for (const w of extra) if (have.has(w)) hints++
  if (own.size === 0) return { score: 0, shared: 0 }
  return { score: Math.min(1, (shared + hints * 0.5) / own.size), shared: shared + hints }
}

/** A weak match goes to the model; a strong one is answered from the library for free. */
export const STRONG_MATCH = 0.6

/**
 * The library entry a typed question matches strongly, or null. Entries for the guest's own stage win a tie; a match needs at least two matching words,
 * or the one word of a one-word question, so a stray word never answers for a whole sentence.
 */
export function matchQuestion(text: string, stage?: JourneyStage, entries: readonly LibraryEntry[] = LIBRARY): LibraryEntry | null {
  const typed = tokens(text)
  if (typed.length === 0) return null
  let best: { entry: LibraryEntry; score: number } | null = null
  for (const entry of entries) {
    const q = questionOf(entry)
    const { score, shared } = scoreEntry(typed, entry, q)
    const needed = Math.min(2, tokens(q).length)
    if (score < STRONG_MATCH || shared < needed) continue
    const adjusted = score + (stage && entry.stages.includes(stage) ? 0.05 : 0)
    if (!best || adjusted > best.score) best = { entry, score: adjusted }
  }
  return best?.entry ?? null
}
