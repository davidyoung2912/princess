import { chipsFor, LIBRARY, questionOf, type LibraryEntry } from './stanleyLibrary'
import type { JourneyStage } from '../routes/hubs'

/** Follow-up chips shown after Stanley's latest answer. */
export const MAX_FOLLOW = 2

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Up to two authored questions to offer after an answer (SG7c). They cost nothing to answer. Entries the guest has already asked are left out; if the answer came
 * from a library entry, the entries written for the same screens come first, so the next question follows on from the last.
 */
export function followUps(stage: JourneyStage, asked: readonly string[], from?: LibraryEntry | null): LibraryEntry[] {
  const done = new Set(asked.map(norm))
  const pool = [...(from ? LIBRARY.filter((e) => e.id !== from.id && e.stages.some((s) => from.stages.includes(s)) && e.screens.some((s) => from.screens.includes(s))) : []), ...chipsFor(undefined, stage, 12)]
  const seen = new Set<string>()
  return pool.filter((e) => {
    if (seen.has(e.id) || e.id === from?.id || done.has(norm(questionOf(e)))) return false
    seen.add(e.id)
    return true
  }).slice(0, MAX_FOLLOW)
}
