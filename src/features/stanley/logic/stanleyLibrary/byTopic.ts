import type { JourneyStage } from '../../../../app/routes/hubs'
import { conceptsOf, understand } from '../understand/understand'
import { wordsOf } from '../understand/normalise'
import { questionOf } from '.'
import type { LibraryEntry } from './types'

/**
 * The library read with the engine's own vocabulary (docs/stanley-answers-plan.md, Phase 5), so there is one way of understanding a question: an authored entry answers a typed question when both are confidently about the same topic and ask for the same
 * thing (a place, a time, a price), and it is the only entry that does. "wheres the spa" and "book massage" find their entry through the lexicon's synonyms and typo repair, which the word matcher in `index.ts` does not have. A typed question that names a thing
 * (a venue, a port) or is about the guest's own trip is never answered by a general entry, it must be about exactly the same things (the same nouns, no more, no fewer) and be hardly longer than the entry's own question, and when two entries fit the match is declined, so the pills and the server answer instead.
 */
/** Only a question that asks to know something is matched; a request to book, change, cancel or order is the server's, which prepares it as a preview. */
const ASKS: ReadonlySet<string> = new Set(['FIND', 'WHEN', 'PRICE', 'ALLOWED', 'REQUIRE', 'WHAT_IS', 'HOW'])
const read = (text: string, stage?: JourneyStage) => understand(text, { stage }, (d) => d)

interface Read { topic: string | null; act: string | null; personal: boolean; nouns: string; words: number }
const nounsOf = (text: string): string => conceptsOf(text).filter((c) => c.startsWith('n.')).sort().join(' ')
const own = new Map<string, Read>()
function ofEntry(e: LibraryEntry): Read {
  let r = own.get(e.id)
  if (!r) {
    const u = read(questionOf(e))
    r = { topic: u.outcome === 'confident' && u.entities.length === 0 ? u.topics[0]?.id ?? null : null, act: u.acts[0] ?? null, personal: u.personal, nouns: nounsOf(questionOf(e)), words: wordsOf(questionOf(e)).length }
    own.set(e.id, r)
  }
  return r
}

export function matchByTopic(text: string, stage: JourneyStage | undefined, entries: readonly LibraryEntry[]): LibraryEntry | null {
  const typed = read(text, stage)
  const topic = typed.outcome === 'confident' && typed.entities.length === 0 && !typed.carried ? typed.topics[0]?.id : undefined
  const act = typed.acts[0]
  if (!topic || !act || !ASKS.has(act) || typed.acts.some((a) => !ASKS.has(a))) return null
  const nouns = nounsOf(text)
  if (!nouns) return null
  const words = wordsOf(text).length
  const fits = entries.filter((e) => {
    const o = ofEntry(e)
    return o.topic === topic && o.act === act && o.nouns === nouns && words <= o.words + 1 && (o.personal || !typed.personal)
  })
  return fits.length === 1 ? fits[0]! : null
}
