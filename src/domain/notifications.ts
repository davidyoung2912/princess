import type { PaymentState } from './trip'

/** The notifications centre (MNG-14): what is worth telling the guest, and how they choose to hear it. */
export type Category = 'critical' | 'payments' | 'documents' | 'checkin' | 'offers'
export const CATEGORIES: readonly Category[] = ['critical', 'payments', 'documents', 'checkin', 'offers']
export type Channel = 'push' | 'email' | 'sms'
export const CHANNELS: readonly Channel[] = ['push', 'email', 'sms']

export type ChannelPrefs = Record<Channel, boolean>
export interface QuietHours { on: boolean; /** "HH:MM". */ from: string; to: string }
export interface NotificationPrefs { channels: Record<Category, ChannelPrefs>; quiet: QuietHours }

export const DEFAULT_PREFS: NotificationPrefs = {
  channels: {
    critical: { push: true, email: true, sms: true },
    payments: { push: true, email: true, sms: false },
    documents: { push: true, email: true, sms: false },
    checkin: { push: true, email: true, sms: false },
    offers: { push: false, email: false, sms: false },
  },
  quiet: { on: false, from: '22:00', to: '07:00' },
}

const time = (v: unknown, fallback: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback)

/** Preferences from untrusted data. Critical notices (itinerary changes, port closures, safety) cannot be turned off on any channel. */
export function normalizePrefs(raw: unknown): NotificationPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ch = o.channels && typeof o.channels === 'object' ? (o.channels as Record<string, unknown>) : {}
  const q = o.quiet && typeof o.quiet === 'object' ? (o.quiet as Record<string, unknown>) : {}
  const channels = {} as Record<Category, ChannelPrefs>
  for (const c of CATEGORIES) {
    const row = ch[c] && typeof ch[c] === 'object' ? (ch[c] as Record<string, unknown>) : {}
    channels[c] = { push: typeof row.push === 'boolean' ? row.push : DEFAULT_PREFS.channels[c].push, email: typeof row.email === 'boolean' ? row.email : DEFAULT_PREFS.channels[c].email, sms: typeof row.sms === 'boolean' ? row.sms : DEFAULT_PREFS.channels[c].sms }
  }
  channels.critical = { push: true, email: true, sms: true }
  return { channels, quiet: { on: q.on === true, from: time(q.from, DEFAULT_PREFS.quiet.from), to: time(q.to, DEFAULT_PREFS.quiet.to) } }
}

/** Whether a time of day ("HH:MM") falls in quiet hours, which can span midnight. Critical notices ignore quiet hours. */
export function inQuietHours(q: QuietHours, at: string, category: Category): boolean {
  if (!q.on || category === 'critical') return false
  return q.from <= q.to ? at >= q.from && at < q.to : at >= q.from || at < q.to
}

export type NoticeId = 'payOverdue' | 'payDue' | 'passportProblem' | 'documentsMissing' | 'checkinOpens'
export interface Notice { id: NoticeId; category: Category; params: Record<string, string | number> }

export interface NoticeInput {
  payment: PaymentState
  /** "YYYY-MM-DD". */
  finalDue: string
  documentsMissing: number
  /** Guests whose passport does not last six months past the return. */
  passportProblems: number
  checkinState: 'notOpen' | 'open' | 'closed' | 'done'
  checkinOpens: string
}

/** What the guest should hear about now, most urgent first. Derived from their trip, so it can never disagree with it. */
export function buildNotices(i: NoticeInput): Notice[] {
  const list: Notice[] = []
  if (i.payment === 'overdue') list.push({ id: 'payOverdue', category: 'critical', params: { date: i.finalDue } })
  if (i.passportProblems > 0) list.push({ id: 'passportProblem', category: 'critical', params: { count: i.passportProblems } })
  if (i.payment === 'dueSoon') list.push({ id: 'payDue', category: 'payments', params: { date: i.finalDue } })
  if (i.documentsMissing > 0) list.push({ id: 'documentsMissing', category: 'documents', params: { count: i.documentsMissing } })
  if (i.checkinState !== 'done') list.push({ id: 'checkinOpens', category: 'checkin', params: { date: i.checkinOpens, open: i.checkinState === 'open' ? 1 : 0 } })
  return list
}
