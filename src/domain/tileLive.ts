/** A live value for a tab tile: the short line shown beside a screen's title ("14 of 40 packed"). Pure, so it is unit tested without React. */
export interface TileFacts {
  checklist?: { done: number; total: number } | null
  packing?: { ticked: number; total: number } | null
  /** Dinners already reserved; null while unknown. */
  dinners?: number | null
  /** Documents for the current booking; null for an agent booking or while unknown. */
  documents?: { missing: number; passportProblems: number } | null
}

/** Screen paths mapped to the words for their live value; a screen with nothing to say is left out. */
export type TileWords = { checklist: (done: number, total: number) => string; packing: (ticked: number, total: number) => string; dinners: (count: number) => string; docsReady: string; docsMissing: (count: number) => string; docsPassport: (count: number) => string }

export function tileValues(facts: TileFacts, words: TileWords): Record<string, string> {
  const out: Record<string, string> = {}
  const c = facts.checklist
  if (c && c.total > 0) out['/plan/checklist'] = words.checklist(Math.min(c.done, c.total), c.total)
  const p = facts.packing
  if (p && p.total > 0) out['/plan/packing'] = words.packing(Math.min(p.ticked, p.total), p.total)
  if (typeof facts.dinners === 'number') out['/plan/reservations'] = words.dinners(facts.dinners)
  const d = facts.documents
  if (d) out['/me/documents'] = d.passportProblems > 0 ? words.docsPassport(d.passportProblems) : d.missing > 0 ? words.docsMissing(d.missing) : words.docsReady
  return out
}
