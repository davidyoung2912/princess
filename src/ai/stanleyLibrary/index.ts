import { t, type StringKey } from '../../i18n'
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
import { SEA } from './sea'
import type { LibraryEntry } from './types'

export type { LibraryEntry } from './types'

/** Every authored entry, in the order of the journey: Dream to Book, then Manage, Prebook and Get to the ship, then Embark, Sea, Port and Disembark. */
export const LIBRARY: readonly LibraryEntry[] = [...DREAM, ...DISCOVER, ...BOOK, ...MANAGE, ...PREBOOK, ...GET_TO_SHIP, ...EMBARK, ...SEA, ...PORT, ...DISEMBARK]

export const questionOf = (e: LibraryEntry): string => t(`stanley.q.${e.id}` as StringKey)
export const answerOf = (e: LibraryEntry): string => t(`stanley.a.${e.id}` as StringKey)

/** Most chips shown at the foot of a page. */
export const MAX_CHIPS = 3

/**
 * The question chips for a page: the entries written for this screen first, then the stage's other entries, up to {@link MAX_CHIPS}.
 * A stage with no library yet gives none. The order is the order of writing, so a page does not shuffle between visits.
 */
export function chipsFor(screenId: string | undefined, stage: JourneyStage, max = MAX_CHIPS): LibraryEntry[] {
  const ofStage = LIBRARY.filter((e) => e.stages.includes(stage))
  const here = screenId ? ofStage.filter((e) => e.screens.includes(screenId)) : []
  const rest = ofStage.filter((e) => !here.includes(e))
  return [...here, ...rest].slice(0, max)
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
