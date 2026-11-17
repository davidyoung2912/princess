import type { ActionContext } from './stanleyAction'

/**
 * The guest's reminders as the server holds them (docs/stanley-reminders-requirements.md, phases R1 and R2). The server reads the words, works out the moment in the ship's zone and follows a plan item or all aboard
 * when it moves; the device only lists, edits and removes, and builds the arguments for a Remind me button. Framework-free, so it is tested in node.
 */
export type ReminderKind = 'clock' | 'relative' | 'anchored'
export type ReminderState = 'scheduled' | 'cancelled'

export interface StanleyReminder {
  id: string
  text: string
  /** The moment, in epoch milliseconds. */
  dueAt: number
  /** The moment in words, with the weekday, the date and "ship time". Worked out by the server. */
  when: string
  kind: ReminderKind
  /** What it follows ("Evening Show", "all aboard"), for an anchored reminder. */
  anchor: string | null
  /** "1 hour before", for an anchored reminder. */
  lead: string | null
  state: ReminderState
  /** One line the guest is told once: it moved, or what it followed was dropped. */
  note: string | null
  private: boolean
  /** It was due in the last few hours and is no longer waiting. */
  past: boolean
}

const KINDS: readonly ReminderKind[] = ['clock', 'relative', 'anchored']
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** One reminder from the server, or null when it is not the agreed shape. */
export function normalizeReminder(raw: unknown): StanleyReminder | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = KINDS.find((k) => k === o.kind)
  const dueAt = typeof o.dueAt === 'string' ? Date.parse(o.dueAt) : NaN
  if (typeof o.id !== 'string' || !o.id || !kind || !Number.isFinite(dueAt)) return null
  return {
    id: o.id.slice(0, 64), text: text(o.text, 80) || 'Reminder', dueAt, when: text(o.when, 80), kind, anchor: text(o.anchor, 80) || null, lead: text(o.lead, 40) || null,
    state: o.state === 'cancelled' ? 'cancelled' : 'scheduled', note: text(o.note, 200) || null, private: o.private === true, past: o.past === true,
  }
}

/** The list (`GET /me/stanley/reminders`): soonest first, anything unreadable left out, at most 100. */
export const normalizeReminders = (raw: unknown): StanleyReminder[] =>
  (Array.isArray(raw) ? raw.flatMap((r) => { const x = normalizeReminder(r); return x ? [x] : [] }) : []).sort((a, b) => a.dueAt - b.dueAt).slice(0, 100)

/** Waiting reminders first, then the ones that ended or were due in the last few hours. */
export function groupReminders(list: readonly StanleyReminder[]): { upcoming: StanleyReminder[]; ended: StanleyReminder[] } {
  return { upcoming: list.filter((r) => r.state === 'scheduled' && !r.past), ended: list.filter((r) => r.state === 'cancelled' || r.past) }
}

/** The default lead for a Remind me button (requirements 31.2): 30 minutes before a show or event, an hour before all aboard. */
export const defaultLeadMin = (anchor: 'plan' | 'allAboard'): number => (anchor === 'allAboard' ? 60 : 30)
/** The leads the guest can choose from, in minutes. */
export const LEAD_CHOICES: readonly number[] = [15, 30, 45, 60, 90, 120]

/** The anchor a Remind me button follows: a plan item (its id, title and start) or all aboard. */
export type RemindAnchor = { kind: 'plan'; id: string; title: string; start: string } | { kind: 'allAboard'; at: string }

/** The arguments `POST /me/stanley/actions/prepare` takes for a Remind me button, with the day of the item (yyyy-MM-dd) when it is not today. The server checks the item is in the plan and works out the moment. */
export function remindMeArgs(anchor: RemindAnchor, leadMin: number, label: string, date?: string): Record<string, string> {
  const lead = String(Math.min(Math.max(Math.round(leadMin), 0), 24 * 60))
  const when: Record<string, string> = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}
  return anchor.kind === 'allAboard'
    ? { when: 'anchored', anchor: 'allAboard', offset: lead, at: anchor.at, text: label.slice(0, 80), ...when }
    : { when: 'anchored', anchor: anchor.id, offset: lead, at: anchor.start, text: label.slice(0, 80), ...when }
}

/** What the plan is sent with, so the server can follow the item and all aboard: only an all aboard that is today's is sent. */
export function reminderContext(plan: ActionContext['plan'], allAboard: string | null, sailingId: string): ActionContext {
  return { plan: plan ?? [], ...(allAboard ? { allAboard: { at: allAboard, label: 'ship' } } : {}), sailingId }
}

/** A native time control's value and date as the server's edit takes them: HH:MM and yyyy-MM-dd, or null when either is not that shape. */
export function editTime(at: string, date: string): { at: string; date: string } | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(at) && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { at, date } : null
}

export type ReminderProblem = 'past' | 'tooFar' | 'time' | 'text' | 'tooMany' | 'forbidden' | 'other'

/** Which words go with a refusal from the server, by its code. */
export function reminderProblem(code: string): ReminderProblem {
  return code === 'past' || code === 'tooFar' || code === 'time' || code === 'text' || code === 'tooMany' || code === 'forbidden' ? code : 'other'
}
