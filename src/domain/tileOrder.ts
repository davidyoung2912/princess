/** Party-aware order for a tab's screens: the screens that matter to this party come first, everything else keeps the stage's order. Pure, so it is unit tested without React. */
export interface PartyFacts {
  /** Ages of everyone on the booking. */
  ages: readonly number[]
  /** Whether anyone on the booking has a mobility need in their profile. */
  mobility: boolean
}

/** Screen ids to move up, in the order they should appear. */
export function priorityIds(f: PartyFacts): string[] {
  const out: string[] = []
  if (f.ages.some((a) => a < 18)) out.push('S40', 'S41')
  if (f.ages.some((a) => a >= 13 && a < 18)) out.push('S42')
  if (f.mobility) out.push('P10', 'M38')
  return out
}

/** The ids with the priority ones first (in priority order), the rest in their given order. Ids not in the list are never added. */
export function orderForParty(ids: readonly string[], priority: readonly string[]): string[] {
  const here = priority.filter((p) => ids.includes(p))
  return [...here, ...ids.filter((id) => !here.includes(id))]
}
