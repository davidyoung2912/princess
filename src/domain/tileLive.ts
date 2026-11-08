/** A live value for a tab tile: the short line shown beside a screen's title ("14 of 40 packed"). Pure, so it is unit tested without React. */
export interface TileFacts {
  checklist?: { done: number; total: number } | null
  packing?: { ticked: number; total: number } | null
}

/** Screen paths mapped to the words for their live value; a screen with nothing to say is left out. */
export type TileWords = { checklist: (done: number, total: number) => string; packing: (ticked: number, total: number) => string }

export function tileValues(facts: TileFacts, words: TileWords): Record<string, string> {
  const out: Record<string, string> = {}
  const c = facts.checklist
  if (c && c.total > 0) out['/plan/checklist'] = words.checklist(Math.min(c.done, c.total), c.total)
  const p = facts.packing
  if (p && p.total > 0) out['/plan/packing'] = words.packing(Math.min(p.ticked, p.total), p.total)
  return out
}
