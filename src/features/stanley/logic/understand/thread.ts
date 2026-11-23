/**
 * What Stanley remembers between turns of one conversation (docs/stanley-answers-plan.md, section 7). Pure, in memory only, never stored: the last topic and the things named, and the choices of a clarifying question
 * waiting for an answer. The memory lasts two turns that lean on it, ten minutes, and the stage it was made in; a confident new topic replaces it.
 */
import type { JourneyStage } from '../../../../app/routes/hubs'
import type { Act } from './lexicon'
import { wordsOf } from './normalise'
import type { Named, Previous, Understood } from './understand'

export interface Thread {
  topic: string | null
  acts: Act[]
  entities: Named[]
  /** The topics a clarifying question offered, in the order the pills were shown. */
  options: string[]
  at: number
  stage: JourneyStage | undefined
  /** How many follow-ups have already leaned on this topic. */
  leaned: number
}

export const EMPTY_THREAD: Thread = { topic: null, acts: [], entities: [], options: [], at: 0, stage: undefined, leaned: 0 }

/** How long a topic is remembered, and how many follow-ups may lean on it. */
export const THREAD_MINUTES = 10
export const MAX_LEANS = 2

const alive = (t: Thread, now: number, stage: JourneyStage | undefined): boolean => t.at > 0 && now - t.at <= THREAD_MINUTES * 60_000 && t.stage === stage

/** What a new question may lean on, or nothing when the memory is old, from another stage, or already used twice. */
export function previousOf(t: Thread, now: number, stage: JourneyStage | undefined): Previous | undefined {
  if (!t.topic || !alive(t, now, stage) || t.leaned >= MAX_LEANS) return undefined
  return { topic: t.topic, acts: t.acts, entities: t.entities }
}

const ORDINALS: readonly (readonly string[])[] = [['first', '1', 'one', 'former'], ['second', '2', 'two', 'latter'], ['third', '3', 'three', 'last']]
const YES = new Set(['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'please', 'correct', 'right'])
const NO = new Set(['no', 'nope', 'nah', 'neither', 'none'])

/** How a typed answer to a clarifying question reads: which option, or "no", or not an answer at all. */
export type Choice = { pick: string } | { declined: true } | null

/** Reads "the first one", "second", "2", "yes" (the first) and "no" against the options waiting. Anything longer than a few words is a new question. */
export function choiceOf(text: string, t: Thread, now: number, stage: JourneyStage | undefined): Choice {
  if (t.options.length === 0 || !alive(t, now, stage)) return null
  const w = wordsOf(text).filter((x) => x !== 'the' && x !== 'one' && x !== 'option' && x !== 'number' && x !== 'please' && x !== 'i' && x !== 'mean')
  const all = wordsOf(text)
  if (all.length === 0 || all.length > 5) return null
  if (w.length === 0 && all.includes('one')) return { pick: t.options[0]! }
  if (w.length === 1 || w.length === 2) {
    if (w.every((x) => NO.has(x))) return { declined: true }
    if (w.every((x) => YES.has(x))) return { pick: t.options[0]! }
    const i = ORDINALS.findIndex((o) => w.length === 1 && o.includes(w[0]!))
    if (i >= 0 && t.options[i]) return { pick: t.options[i]! }
  }
  return null
}

/** The memory after a turn. A question that found its own topic starts it afresh; a follow-up that leaned on it counts one lean; a clarifying question keeps its options for the next turn. */
export function remember(t: Thread, u: Understood, now: number, stage: JourneyStage | undefined): Thread {
  const own = u.topics[0]?.id ?? null
  if (u.outcome === 'ambiguous' && u.options.length >= 2) return { topic: null, acts: u.acts, entities: u.entities, options: u.options, at: now, stage, leaned: 0 }
  if (u.carried) return { ...t, options: [], at: now, stage, topic: own ?? t.topic, acts: u.acts, entities: u.entities, leaned: t.leaned + 1 }
  if (u.outcome === 'confident' && (own || u.entities.length > 0)) return { topic: own, acts: u.acts, entities: u.entities, options: [], at: now, stage, leaned: 0 }
  // A miss leaves what was remembered as it was, so one stray question does not lose the thread.
  return { ...t, options: [] }
}
