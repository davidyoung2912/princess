import type { CabinFilter } from '../domain/cabinScore'

/**
 * Stanley's "Asks" (docs/experience-extension-ideas.md 13.7, SG2): a form turned into one question at a time. This is the framework-free part:
 * the walk through the questions, and what the cabin conversation's answers mean. The words and the screens live elsewhere.
 */

export interface AskQuestion {
  id: string
  /** More than one answer may be chosen. */
  multi?: boolean
}

export type AskValue = string | readonly string[]

export interface AskState {
  index: number
  done: boolean
}

export const START: AskState = { index: 0, done: false }

/** Go to the next question, or finish after the last one. */
export function advance(state: AskState, total: number): AskState {
  if (state.index + 1 >= total) return { index: Math.max(0, total - 1), done: true }
  return { index: state.index + 1, done: false }
}

/** Go back one question; from the first question stay on it. Going back from "done" reopens the last question. */
export function back(state: AskState): AskState {
  return { index: Math.max(0, state.index - (state.done ? 0 : 1)), done: false }
}

/** How many questions have an answer, for "2 of 5" and for a progress bar. */
export const answeredCount = (questions: readonly AskQuestion[], values: Readonly<Record<string, AskValue | undefined>>): number =>
  questions.filter((q) => { const v = values[q.id]; return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' }).length

// ---- "Tell me which one": the cabin conversation ----

export const CABIN_ASKS: readonly AskQuestion[] = [
  { id: 'sleep' }, { id: 'sea' }, { id: 'access' }, { id: 'view' }, { id: 'booked' },
]

/** Every cabin question is yes or no. */
export const YES_NO = ['yes', 'no'] as const

/** What the cabin answers mean for the chooser's filters: "yes" to a question switches its filter on, anything else leaves it off. */
export function cabinFilterFrom(values: Readonly<Record<string, AskValue | undefined>>): CabinFilter {
  const yes = (id: string) => values[id] === 'yes'
  return { quiet: yes('sleep'), calmSea: yes('sea'), accessible: yes('access'), clearView: yes('view'), availableOnly: values.booked === undefined ? true : yes('booked') }
}

// ---- Why we ask: one line for each booking step, except Pay, where he stays quiet before a charge (13.6) ----

export const BOOKING_WHY_STEPS = ['sailing', 'room', 'fare', 'guests', 'dining', 'review'] as const
