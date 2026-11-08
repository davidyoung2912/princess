/** A live value for a tab tile: the short line shown beside a screen's title ("14 of 40 packed"). Pure, so it is unit tested without React. */
export interface TileFacts {
  checklist?: { done: number; total: number } | null
  packing?: { ticked: number; total: number } | null
  /** Dinners already reserved; null while unknown. */
  dinners?: number | null
  /** Documents for the current booking; null for an agent booking or while unknown. */
  documents?: { missing: number; passportProblems: number } | null
  /** Time ("HH:MM") of tonight's dinner, if one is booked; null otherwise. */
  tonight?: string | null
}

/** The earliest dinner on the day whose date is `today` ("YYYY-MM-DD"), or null. */
export function tonightsDinner(days: readonly { date: string; entries: readonly { kind: string; time: string }[] }[], today: string): string | null {
  const times = days.filter((d) => d.date === today).flatMap((d) => d.entries.filter((e) => e.kind === 'dinner').map((e) => e.time)).sort()
  return times[0] ?? null
}

/** Today's calendar date on the device, "YYYY-MM-DD". */
export function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Screen paths mapped to the words for their live value; a screen with nothing to say is left out. */
export type TileWords = { checklist: (done: number, total: number) => string; packing: (ticked: number, total: number) => string; dinners: (count: number) => string; dinnersTonight: (count: number, time: string) => string; docsReady: string; docsMissing: (count: number) => string; docsPassport: (count: number) => string }

export function tileValues(facts: TileFacts, words: TileWords): Record<string, string> {
  const out: Record<string, string> = {}
  const c = facts.checklist
  if (c && c.total > 0) out['/plan/checklist'] = words.checklist(Math.min(c.done, c.total), c.total)
  const p = facts.packing
  if (p && p.total > 0) out['/plan/packing'] = words.packing(Math.min(p.ticked, p.total), p.total)
  if (typeof facts.dinners === 'number') out['/plan/reservations'] = (facts.tonight ? words.dinnersTonight(facts.dinners, facts.tonight) : words.dinners(facts.dinners))
  const d = facts.documents
  if (d) out['/me/documents'] = d.passportProblems > 0 ? words.docsPassport(d.passportProblems) : d.missing > 0 ? words.docsMissing(d.missing) : words.docsReady
  return out
}
