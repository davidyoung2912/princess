import { addDays } from './timezones'

/** The pre-cruise checklist (MNG-07): what to do and by when, on a 90/60/30/14/7/1-day timeline. */
export const MILESTONES: readonly number[] = [90, 60, 30, 14, 7, 1]

/** Things the app can see for itself; the guest does not tick these. */
export type AutoKey = 'paid' | 'documents' | 'tours' | 'dining' | 'assistance' | 'travel' | 'checkin'

export interface ChecklistItem {
  id: string
  /** Due this many days before sailing. */
  daysBefore: number
  /** Worked out from the guest's trip; null for items the guest ticks. */
  auto: AutoKey | null
  /** Where to go to do it. */
  to: string | null
}

export const CHECKLIST: readonly ChecklistItem[] = [
  { id: 'pay', daysBefore: 90, auto: 'paid', to: '/me/payments' },
  { id: 'names', daysBefore: 90, auto: null, to: '/me/profile' },
  { id: 'documents', daysBefore: 60, auto: 'documents', to: '/me/documents' },
  { id: 'tours', daysBefore: 60, auto: 'tours', to: '/plan/excursions' },
  { id: 'assistance', daysBefore: 30, auto: 'assistance', to: '/plan/assistance' },
  { id: 'dining', daysBefore: 30, auto: 'dining', to: '/plan/dining' },
  { id: 'insurance', daysBefore: 30, auto: null, to: null },
  { id: 'travel', daysBefore: 14, auto: 'travel', to: '/plan/travel' },
  { id: 'packages', daysBefore: 14, auto: null, to: '/me/packages' },
  { id: 'checkin', daysBefore: 7, auto: 'checkin', to: '/' },
  { id: 'packing', daysBefore: 7, auto: null, to: '/plan/packing' },
  { id: 'phone', daysBefore: 7, auto: null, to: null },
  { id: 'bags', daysBefore: 1, auto: null, to: null },
  { id: 'pass', daysBefore: 1, auto: null, to: '/' },
]

export type ItemState = 'done' | 'overdue' | 'dueSoon' | 'upcoming'
/** An item is "due soon" in the week before its date. */
export const DUE_SOON_DAYS = 7

export interface ChecklistEntry extends ChecklistItem {
  /** The date it is due, "YYYY-MM-DD". */
  due: string
  state: ItemState
  /** Whether the app found it done, as opposed to the guest ticking it. */
  automatic: boolean
}

export interface ChecklistInput {
  departure: string
  today: string
  daysToDeparture: number
  auto: Record<AutoKey, boolean>
  ticked: readonly string[]
}

export function buildChecklist(i: ChecklistInput): ChecklistEntry[] {
  return CHECKLIST.map((item) => {
    const due = addDays(i.departure, -item.daysBefore)
    const automatic = item.auto !== null && i.auto[item.auto]
    const done = automatic || i.ticked.includes(item.id)
    const left = i.daysToDeparture - item.daysBefore
    const state: ItemState = done ? 'done' : left < 0 ? 'overdue' : left <= DUE_SOON_DAYS ? 'dueSoon' : 'upcoming'
    return { ...item, due, state, automatic }
  })
}

export interface Milestone {
  daysBefore: number
  due: string
  entries: ChecklistEntry[]
}

/** The checklist grouped by milestone, soonest first. */
export function milestones(entries: readonly ChecklistEntry[]): Milestone[] {
  return MILESTONES.map((d) => {
    const list = entries.filter((e) => e.daysBefore === d)
    return { daysBefore: d, due: list[0]?.due ?? '', entries: list }
  }).filter((m) => m.entries.length > 0)
}

export const progress = (entries: readonly ChecklistEntry[]): { done: number; total: number } => ({ done: entries.filter((e) => e.state === 'done').length, total: entries.length })

/** The one item to do next: overdue first, then the soonest not done. */
export function nextItem(entries: readonly ChecklistEntry[]): ChecklistEntry | null {
  const open = entries.filter((e) => e.state !== 'done')
  return open.find((e) => e.state === 'overdue') ?? open.sort((a, b) => a.due.localeCompare(b.due))[0] ?? null
}
