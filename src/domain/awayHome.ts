import { addDays } from './timezones'

/**
 * The away-from-home checklist (S3-11): what to sort out at home before and while you are away. The guest ticks things off and can add their own.
 * It is the guest's own list, kept on the device; nothing here books, sends or schedules anything.
 */
export const AWAY_GROUPS = ['people', 'house', 'money', 'work', 'health'] as const
export type AwayGroup = (typeof AWAY_GROUPS)[number]

export interface AwayItem { id: string; group: AwayGroup; /** Do it this many days before sailing. */ daysBefore: number }

export const AWAY_ITEMS: readonly AwayItem[] = [
  { id: 'pets', group: 'people', daysBefore: 14 },
  { id: 'plants', group: 'people', daysBefore: 3 },
  { id: 'contact', group: 'people', daysBefore: 7 },
  { id: 'mail', group: 'house', daysBefore: 7 },
  { id: 'keys', group: 'house', daysBefore: 7 },
  { id: 'lights', group: 'house', daysBefore: 2 },
  { id: 'bins', group: 'house', daysBefore: 1 },
  { id: 'fridge', group: 'house', daysBefore: 2 },
  { id: 'safety', group: 'house', daysBefore: 1 },
  { id: 'bills', group: 'money', daysBefore: 14 },
  { id: 'bank', group: 'money', daysBefore: 7 },
  { id: 'ooo', group: 'work', daysBefore: 3 },
  { id: 'handover', group: 'work', daysBefore: 7 },
  { id: 'supply', group: 'health', daysBefore: 14 },
]

export const EXTRA_MAX = 80
export const EXTRAS_MAX = 10

export interface AwayEntry extends AwayItem { due: string; done: boolean; late: boolean }

/** Each item with its date and whether it is done; one is late only when its date has passed and sailing has not started. */
export function awayList(departure: string, today: string, ticked: readonly string[]): AwayEntry[] {
  return AWAY_ITEMS.map((i) => {
    const due = addDays(departure, -i.daysBefore)
    const done = ticked.includes(i.id)
    return { ...i, due, done, late: !done && due < today && today < departure }
  }).sort((a, b) => a.due.localeCompare(b.due))
}

export interface Extra { id: string; text: string; done: boolean }

/** Plain text to send to whoever is looking after the house, with the guest's own wording for each item. */
export function awayText(title: string, entries: readonly AwayEntry[], label: (id: string) => string, extras: readonly Extra[]): string {
  const lines = [title]
  for (const g of AWAY_GROUPS) {
    const list = entries.filter((e) => e.group === g)
    if (list.length === 0) continue
    lines.push('', g.toUpperCase())
    for (const e of list) lines.push(`${e.done ? '[x]' : '[ ]'} ${label(e.id)} (by ${e.due})`)
  }
  if (extras.length) {
    lines.push('', 'MY OWN')
    for (const x of extras) lines.push(`${x.done ? '[x]' : '[ ]'} ${x.text}`)
  }
  return lines.join('\n')
}

export const cleanExtra = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, EXTRA_MAX)
