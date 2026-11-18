/**
 * Reads an export of unanswered questions and says what to author next (docs/stanley-answers-plan.md, phase 7).
 * Pure: it runs the engine as the device does, with no labels, and counts. Run it with `STANLEY_EXPORT=<export.json> npm run stanley:misses`.
 */
import { wordsOf } from './normalise.ts'
import { conceptsOf, understand, type UnderstandContext } from './understand.ts'

export interface MissRow { text: string; count: number }
export interface Collision { text: string; topics: string[] }
export interface MissReport {
  total: number
  /** Questions the engine still cannot place, most asked first. */
  misses: MissRow[]
  /** Questions it now places confidently (the export is older than the lexicon). */
  nowAnswered: MissRow[]
  /** Questions that sit between two or three topics. */
  collisions: Collision[]
  /** The concepts that came up in missed questions, most common first: the words to add to a topic. */
  concepts: { concept: string; count: number }[]
  /** Words in missed questions the lexicon does not know at all, most common first: the nouns and verbs to add. */
  unknownWords: { word: string; count: number }[]
}

const top = <T extends { count: number }>(rows: T[], n: number): T[] => rows.sort((a, b) => b.count - a.count).slice(0, n)

export function analyseMisses(questions: readonly string[], ctx: UnderstandContext = {}, limit = 10): MissReport {
  const asked = new Map<string, number>()
  for (const q of questions) { const k = q.replace(/\s+/g, ' ').trim(); if (k) asked.set(k, (asked.get(k) ?? 0) + 1) }
  const misses: MissRow[] = []
  const nowAnswered: MissRow[] = []
  const collisions: Collision[] = []
  const concepts = new Map<string, number>()
  const unknown = new Map<string, number>()
  for (const [text, count] of asked) {
    const u = understand(text, ctx, (d) => d)
    if (u.outcome === 'confident') { nowAnswered.push({ text, count }); continue }
    if (u.outcome === 'ambiguous') collisions.push({ text, topics: u.options })
    else misses.push({ text, count })
    const known = conceptsOf(text)
    for (const c of known) concepts.set(c, (concepts.get(c) ?? 0) + count)
    if (known.length === 0) for (const w of wordsOf(text)) if (w.length > 2) unknown.set(w, (unknown.get(w) ?? 0) + count)
  }
  return {
    total: [...asked.values()].reduce((a, b) => a + b, 0),
    misses: top(misses, limit),
    nowAnswered: top(nowAnswered, limit),
    collisions: collisions.slice(0, limit),
    concepts: top([...concepts].map(([concept, count]) => ({ concept, count })), limit),
    unknownWords: top([...unknown].map(([word, count]) => ({ word, count })), limit),
  }
}

export function reportText(r: MissReport): string {
  const list = (title: string, lines: string[]) => [`${title}`, ...(lines.length ? lines.map((l) => `  ${l}`) : ['  none']), '']
  return [
    `Questions read: ${r.total}`, '',
    ...list('Still not placed (most asked first)', r.misses.map((m) => `${m.count} x ${m.text}`)),
    ...list('Between topics (near-collisions)', r.collisions.map((c) => `${c.text}  ->  ${c.topics.join(' / ')}`)),
    ...list('Concepts in the misses (what they were about)', r.concepts.map((c) => `${c.count} x ${c.concept}`)),
    ...list('Words the lexicon does not know (candidates to add)', r.unknownWords.map((w) => `${w.count} x ${w.word}`)),
    ...list('Placed now (the export is older than the lexicon)', r.nowAnswered.map((m) => `${m.count} x ${m.text}`)),
  ].join('\n')
}
