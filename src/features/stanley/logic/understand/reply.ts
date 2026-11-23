/**
 * What goes under (or instead of) a reply once the question has been understood (docs/stanley-answers-plan.md, section 4). Pure: it takes what the engine found and what the existing steps already produced, and says which words
 * and which pills to show. The engine only adds, except where the server could not answer at all.
 */
import type { Act } from './lexicon'
import { MAX_PILLS, type Pill, type Understood } from './understand'

export interface ReplyFacts {
  /** The kind of reply the earlier steps produced. */
  kind: 'answer' | 'blocked' | 'offtopic' | 'handoff' | 'unavailable' | 'unreachable'
  /** Where an answer came from: the device's `library` or `ship`, or the server's tier. */
  source?: string
  /** Set when the server's answer was its canned no-model reply. */
  scripted?: boolean
  /** The pills the earlier steps already have (the answer's own screens). */
  existing: readonly { label: string; path: string; id?: string }[]
}

export interface Composed {
  /** Words to show in place of the earlier reply, when it was no answer at all. */
  text: string | null
  /** The pills to show, the answer's own first. */
  actions: { label: string; path: string; id?: string }[]
  /** What the engine made of it, for the diagnostics counters. */
  outcome: Understood['outcome'] | 'skipped'
  replaced: boolean
  topic: string | null
}

/** A reply that was no answer: the server said it was off topic or unavailable, or gave its canned no-model reply. The engine may take its place. */
export const noAnswer = (f: ReplyFacts): boolean => f.kind === 'offtopic' || f.kind === 'unavailable' || (f.kind === 'answer' && f.scripted === true)

const ACT_FOR_LINE: readonly Act[] = ['LOST', 'PROBLEM', 'CANCEL', 'CHANGE', 'BOOK', 'ORDER', 'REMIND', 'PRICE', 'WHEN', 'FIND', 'ALLOWED', 'REQUIRE', 'COMPARE']

export interface Words {
  topic: (id: string) => string
  say: (act: string, topic: string) => string
  /** One sentence for a question that named a thing the app holds: "Here is {name}." */
  named: (name: string) => string
  /** "Do you mean A, or B?" for the topics a question could be about (the words of each, in the order of the pills). */
  clarify: (topics: readonly string[]) => string
  ambiguous: string
  miss: string
  /** The pills for a guest who got no answer and no topic: search, help, a person. */
  fallback: readonly Pill[]
}

const merge = (first: readonly { label: string; path: string; id?: string }[], more: readonly Pill[]): Composed['actions'] => {
  const out: Composed['actions'] = []
  for (const p of [...first, ...more]) if (out.length < MAX_PILLS && !out.some((o) => o.path === p.path)) out.push({ label: p.label, path: p.path, id: p.id })
  return out
}

/** Decides what the guest sees. A handoff, a block or a refusal is left exactly as it was: no pills are added to a safety reply. */
export function compose(u: Understood, facts: ReplyFacts, words: Words): Composed {
  const keep = (): Composed => ({ text: null, actions: merge(facts.existing, []), outcome: 'skipped', replaced: false, topic: null })
  if (facts.kind === 'handoff' || facts.kind === 'blocked') return keep()
  const topic = u.topics[0]?.id ?? null
  const replace = noAnswer(facts)
  if (!replace) {
    // An answer stands. Add the likeliest screens only when the engine is sure.
    const more = u.outcome === 'confident' ? u.pills : []
    return { text: null, actions: merge(facts.existing, more), outcome: u.outcome, replaced: false, topic }
  }
  if (u.outcome === 'confident' && u.entities.length > 0 && (!topic || u.acts.length === 0)) {
    return { text: words.named(u.entities.map((n) => n.name).join(' / ')), actions: merge([], u.pills), outcome: 'confident', replaced: true, topic }
  }
  if (u.outcome === 'confident' && topic) {
    const act = ACT_FOR_LINE.find((a) => u.acts.includes(a)) ?? 'default'
    return { text: words.say(act, words.topic(topic)), actions: merge([], u.pills), outcome: 'confident', replaced: true, topic }
  }
  if (u.outcome === 'ambiguous') {
    // One short question, and the likeliest screens as the choices; with only one screen to offer, the general words and the way out.
    const asked = u.options.length >= 2 && u.pills.length >= 2
    return { text: asked ? words.clarify(u.options.map(words.topic)) : words.ambiguous, actions: merge([], asked ? u.pills : [...u.pills, ...words.fallback]), outcome: 'ambiguous', replaced: true, topic }
  }
  return { text: words.miss, actions: merge([], words.fallback), outcome: u.outcome === 'empty' ? 'miss' : u.outcome, replaced: true, topic: null }
}

/** Questions that ask where, when, how much, how to or what something is: a pointer or a lookup, which never needs a model. */
const POINTER_ACTS: readonly Act[] = ['FIND', 'WHEN', 'PRICE', 'HOW', 'WHAT_IS', 'STATUS', 'CONTACT', 'LIST', 'ALLOWED', 'REQUIRE', 'BOOK', 'ORDER', 'REMIND']

/** What the server may use to skip a model: only a confident topic whose acts are all pointers. Anything that recommends, compares or plans is left to it. */
export function hintOf(u: Understood): { topic: string; confident: boolean; pointer: boolean } | undefined {
  const topic = u.topics[0]?.id
  if (!topic || u.outcome !== 'confident') return undefined
  return { topic, confident: true, pointer: u.acts.length > 0 && u.acts.every((a) => POINTER_ACTS.includes(a)) && !u.personal }
}
