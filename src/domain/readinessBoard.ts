import type { PersonReadiness } from './bookingPrep'

export interface BoardRow { id: string; name: string; percent: number; open: PersonReadiness['open']; behind: boolean }

/** Every traveller on one list, the furthest behind first (ties by name), with those under the line marked. */
export function readinessBoard(people: readonly { id: string; name: string; readiness: PersonReadiness }[], line = 70): BoardRow[] {
  return people
    .map((p) => ({ id: p.id, name: p.name, percent: p.readiness.percent, open: p.readiness.open, behind: p.readiness.percent < line }))
    .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name))
}

/** The pre-written message for one traveller: their next three open items, with the due dates already formatted by the caller. */
export function nudgeText(first: string, items: readonly { label: string; due: string }[]): string {
  if (items.length === 0) return `Hi ${first}, you are all ready for the cruise. Nothing left to do.`
  const list = items.slice(0, 3).map((i) => `- ${i.label} (due ${i.due})`).join('\n')
  return `Hi ${first}, a friendly reminder about what is still open before we sail:\n${list}\nThank you!`
}
