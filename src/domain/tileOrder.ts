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

/** The screens in `ids` that matter to this party, in priority order, at most `max`: these go in a "For you" list at the top of the tab. */
export function forYouIds(ids: readonly string[], priority: readonly string[], max: number): string[] {
  return priority.filter((p) => ids.includes(p)).slice(0, max)
}

/** Pins after the guest taps the pin on `id`: unpinned if pinned, otherwise added, dropping the oldest pin when `max` would be passed. */
export function togglePin(pins: readonly string[], id: string, max: number): string[] {
  if (pins.includes(id)) return pins.filter((p) => p !== id)
  return [...pins, id].slice(-max)
}
