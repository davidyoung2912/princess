import type { StringKey } from '../i18n'
import { addDays } from './timezones'

/** What the app keeps, for how long, and what the guest has agreed to (SEC-03, SEC-04, ACT-06). The periods are authored concept values (verify before real use). */
export interface RetentionRule {
  id: 'idDocuments' | 'photo' | 'health' | 'payment' | 'messages' | 'history'
  label: StringKey
  why: StringKey
  /** Days after the cruise ends that it is deleted; null where it is kept until the guest deletes it. */
  days: number | null
  /** The saved records the rule deletes. */
  kinds: readonly string[]
}

export const RETENTION: readonly RetentionRule[] = [
  { id: 'idDocuments', label: 'priv.r.id', why: 'priv.r.id.why', days: 30, kinds: ['ci-guest', 'documents'] },
  { id: 'photo', label: 'priv.r.photo', why: 'priv.r.photo.why', days: 30, kinds: ['ci-guest'] },
  { id: 'health', label: 'priv.r.health', why: 'priv.r.health.why', days: 90, kinds: ['illness'] },
  { id: 'payment', label: 'priv.r.payment', why: 'priv.r.payment.why', days: null, kinds: [] },
  { id: 'messages', label: 'priv.r.messages', why: 'priv.r.messages.why', days: null, kinds: [] },
  { id: 'history', label: 'priv.r.history', why: 'priv.r.history.why', days: null, kinds: [] },
]

/** The day (YYYY-MM-DD) a rule deletes its data, given the last day of the cruise. */
export const deleteOn = (rule: Pick<RetentionRule, 'days'>, cruiseEnds: string): string | null => (rule.days === null ? null : addDays(cruiseEnds, rule.days))

/** Whether a rule has come due on a date. */
export const isDue = (rule: Pick<RetentionRule, 'days'>, cruiseEnds: string, today: string): boolean => {
  const day = deleteOn(rule, cruiseEnds)
  return day !== null && today >= day
}

/** The records to delete today: every kind that a due rule names and that no rule still in force also needs. */
export function kindsToDelete(cruiseEnds: string, today: string): string[] {
  const due = RETENTION.filter((r) => isDue(r, cruiseEnds, today)).flatMap((r) => r.kinds)
  const keep = new Set(RETENTION.filter((r) => !isDue(r, cruiseEnds, today)).flatMap((r) => r.kinds))
  return [...new Set(due)].filter((k) => !keep.has(k))
}

export type ConsentId = 'marketingEmail' | 'marketingSms' | 'improve' | 'shipPhotos' | 'parent'
export const CONSENTS: readonly { id: ConsentId; label: StringKey; hint: StringKey; adultsOnly?: boolean; childOnly?: boolean }[] = [
  { id: 'marketingEmail', label: 'priv.c.email', hint: 'priv.c.email.hint', adultsOnly: true },
  { id: 'marketingSms', label: 'priv.c.sms', hint: 'priv.c.sms.hint', adultsOnly: true },
  { id: 'improve', label: 'priv.c.improve', hint: 'priv.c.improve.hint', adultsOnly: true },
  { id: 'shipPhotos', label: 'priv.c.photos', hint: 'priv.c.photos.hint' },
  { id: 'parent', label: 'priv.c.parent', hint: 'priv.c.parent.hint', childOnly: true },
]

/** Everything starts off. */
export type Consents = Record<ConsentId, boolean>
export const NO_CONSENTS: Consents = { marketingEmail: false, marketingSms: false, improve: false, shipPhotos: false, parent: false }

export function normalizeConsents(raw: unknown): Consents {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...NO_CONSENTS }
  for (const id of Object.keys(out) as ConsentId[]) out[id] = o[id] === true
  return out
}

/** The consents that apply to a person: under-13s have only the ones a parent decides, and nothing else is asked of the child. */
export const consentsFor = (age: number): readonly (typeof CONSENTS)[number][] =>
  CONSENTS.filter((c) => (age < 13 ? c.id === 'parent' || c.id === 'shipPhotos' : !c.childOnly))

export const COPPA_AGE = 13

/** One line of the access log: who or what looked at a sensitive record. */
export interface AccessEntry { at: number; what: 'passport' | 'photo' | 'health' | 'documents'; action: 'viewed' | 'saved' | 'deleted'; by: string }
export const MAX_ACCESS = 50
