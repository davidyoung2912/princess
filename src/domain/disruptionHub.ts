import type { StringKey } from '../i18n'
import { activeDisruptions, disruptionById, type DisruptionDef } from './disruption'
import type { ScenarioId } from './scenarios'

/**
 * The Disruption Hub (XD-01 to XD-10): for any change to the trip, one place that says what happened, what it means for the guest,
 * what has already been done, what they can choose, what happens next and how to reach a person. Texts are authored concept values.
 */
export type KnockOutcome = 'refunded' | 'moved' | 'cancelled' | 'kept'

/** Something else the change touched, already dealt with (XD-02), so the guest sees the result before doing anything. */
export interface KnockOn { id: string; item: StringKey; outcome: KnockOutcome; detail: StringKey }

/** What was given, when it arrives and what the guest must do, if anything (XD-03). */
export interface Compensation { given: StringKey; arrives: StringKey; todo: StringKey }

export interface HubDef {
  /** What it means for me. */
  meaning: StringKey
  /** What has already been done for me. */
  done: readonly StringKey[]
  knockOns: readonly KnockOn[]
  compensation: Compensation | null
  /** What happens next. */
  next: StringKey
  /** The plain-language notice for named people at home (XD-07); null when the change does not affect them. */
  familyNotice: StringKey | null
}

export const HUB: Partial<Record<ScenarioId, HubDef>> = {
  portSkipped: {
    meaning: 'hub.portSkipped.meaning',
    done: ['hub.portSkipped.done1', 'hub.portSkipped.done2'],
    knockOns: [
      { id: 'tour', item: 'hub.portSkipped.k1.item', outcome: 'refunded', detail: 'hub.portSkipped.k1.detail' },
      { id: 'dinner', item: 'hub.portSkipped.k2.item', outcome: 'moved', detail: 'hub.portSkipped.k2.detail' },
      { id: 'shuttle', item: 'hub.portSkipped.k3.item', outcome: 'cancelled', detail: 'hub.portSkipped.k3.detail' },
    ],
    compensation: { given: 'hub.portSkipped.comp.given', arrives: 'hub.portSkipped.comp.arrives', todo: 'hub.portSkipped.comp.todo' },
    next: 'hub.portSkipped.next',
    familyNotice: 'hub.portSkipped.family',
  },
  belizeTender: {
    meaning: 'hub.belizeTender.meaning',
    done: ['hub.belizeTender.done1'],
    knockOns: [{ id: 'tour', item: 'hub.belizeTender.k1.item', outcome: 'moved', detail: 'hub.belizeTender.k1.detail' }],
    compensation: null,
    next: 'hub.belizeTender.next',
    familyNotice: 'hub.belizeTender.family',
  },
  planChange: {
    meaning: 'hub.planChange.meaning',
    done: ['hub.planChange.done1'],
    knockOns: [{ id: 'dinner', item: 'hub.planChange.k1.item', outcome: 'kept', detail: 'hub.planChange.k1.detail' }],
    compensation: null,
    next: 'hub.planChange.next',
    familyNotice: null,
  },
  clockChange: {
    meaning: 'hub.clockChange.meaning',
    done: ['hub.clockChange.done1'],
    knockOns: [],
    compensation: null,
    next: 'hub.clockChange.next',
    familyNotice: null,
  },
  terminalChange: {
    meaning: 'hub.terminalChange.meaning',
    done: ['hub.terminalChange.done1'],
    knockOns: [],
    compensation: null,
    next: 'hub.terminalChange.next',
    familyNotice: null,
  },
  illness: {
    meaning: 'hub.illness.meaning',
    done: ['hub.illness.done1', 'hub.illness.done2'],
    knockOns: [],
    compensation: null,
    next: 'hub.illness.next',
    familyNotice: 'hub.illness.family',
  },
}

export const hubFor = (id: unknown): HubDef | undefined => HUB[id as ScenarioId]

export interface HubItem { def: DisruptionDef; hub: HubDef }

/** The disruptions in force with their hub detail, most serious first. */
export function hubItems(scenarios: readonly string[]): HubItem[] {
  return activeDisruptions(scenarios).flatMap((def) => { const hub = hubFor(def.id); return hub ? [{ def, hub }] : [] })
}

/** How many knock-on items ended each way, for a one-line summary. */
export function knockOnCounts(items: readonly KnockOn[]): Record<KnockOutcome, number> {
  const out: Record<KnockOutcome, number> = { refunded: 0, moved: 0, cancelled: 0, kept: 0 }
  for (const k of items) out[k.outcome]++
  return out
}

/** The notices for people at home: only the changes that touch them, most serious first. */
export function familyNotices(scenarios: readonly string[]): StringKey[] {
  return hubItems(scenarios).flatMap((i) => (i.hub.familyNotice ? [i.hub.familyNotice] : []))
}


/* ---- Guides for the things that go wrong without warning (XD-05, XD-06, XD-08, XD-09) ---- */

export type GuideId = 'stranded' | 'lostPhone' | 'outage' | 'health'

export interface Guide { id: GuideId; title: StringKey; steps: readonly StringKey[]; link: string | null }

export const GUIDES: readonly Guide[] = [
  { id: 'stranded', title: 'hub.guide.stranded', link: '/ship/port', steps: ['hub.guide.stranded.s1', 'hub.guide.stranded.s2', 'hub.guide.stranded.s3', 'hub.guide.stranded.s4', 'hub.guide.stranded.s5'] },
  { id: 'lostPhone', title: 'hub.guide.lostPhone', link: '/me/documents', steps: ['hub.guide.lostPhone.s1', 'hub.guide.lostPhone.s2', 'hub.guide.lostPhone.s3', 'hub.guide.lostPhone.s4'] },
  { id: 'outage', title: 'hub.guide.outage', link: null, steps: ['hub.guide.outage.s1', 'hub.guide.outage.s2', 'hub.guide.outage.s3', 'hub.guide.outage.s4'] },
  { id: 'health', title: 'hub.guide.health', link: '/ship/health', steps: ['hub.guide.health.s1', 'hub.guide.health.s2', 'hub.guide.health.s3', 'hub.guide.health.s4'] },
]

/** The guide to put first: health when a health notice is active, none otherwise. */
export const featuredGuide = (scenarios: readonly string[]): GuideId | null => (scenarios.includes('illness') ? 'health' : null)

/** Guides in display order, the featured one first. */
export function orderedGuides(scenarios: readonly string[]): Guide[] {
  const first = featuredGuide(scenarios)
  return [...GUIDES].sort((a, b) => Number(b.id === first) - Number(a.id === first))
}

/** What still works when the ship's network or the app's service is down (XD-08). */
export const OUTAGE_WORKS: readonly StringKey[] = ['hub.outage.works1', 'hub.outage.works2', 'hub.outage.works3', 'hub.outage.works4']

/* ---- Callback with a place in the queue (XD-04) ---- */

const MINUTE = 60_000
/** A callback request is kept for two hours, then lapses and the guest is told. */
export const CALLBACK_LIFETIME_MS = 120 * MINUTE

export interface CallbackRequest { id: string; at: number; position: number; readyAt: number; reason: 'urgent' | 'changes' | 'health' | 'other'; /** A simulated queue; a real feed would replace it. */ source: 'sim' }
export type CallbackStatus = { kind: 'waiting'; minutes: number } | { kind: 'due' } | { kind: 'lapsed' }

const hash = (n: number): number => { let x = (n ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d0f4b5) >>> 0; x = Math.imul(x ^ (x >>> 13), 0x45d0f4b5) >>> 0; return (x ^ (x >>> 16)) >>> 0 }

/** A pretend queue: the place is 1 to 6 and moves on every five minutes, four minutes of wait per place. The same inputs give the same answer. */
export function queueEstimate(at: number, seed: number): { position: number; waitMinutes: number } {
  const position = 1 + (hash(Math.floor(at / (5 * MINUTE)) + seed) % 6)
  return { position, waitMinutes: position * 4 }
}

export function requestCallback(at: number, reason: CallbackRequest['reason'], seed: number, id: string): CallbackRequest {
  const { position, waitMinutes } = queueEstimate(at, seed)
  return { id, at, position, readyAt: at + waitMinutes * MINUTE, reason, source: 'sim' }
}

export function callbackStatus(c: CallbackRequest, now: number): CallbackStatus {
  if (now >= c.at + CALLBACK_LIFETIME_MS) return { kind: 'lapsed' }
  if (now >= c.readyAt) return { kind: 'due' }
  return { kind: 'waiting', minutes: Math.max(1, Math.ceil((c.readyAt - now) / MINUTE)) }
}

export const normalizeCallback = (raw: unknown): CallbackRequest | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const reasons = ['urgent', 'changes', 'health', 'other']
  if (typeof r.id !== 'string' || ![r.at, r.position, r.readyAt].every((n) => typeof n === 'number' && Number.isFinite(n)) || !reasons.includes(r.reason as string)) return null
  return { id: r.id, at: r.at as number, position: r.position as number, readyAt: r.readyAt as number, reason: r.reason as CallbackRequest['reason'], source: 'sim' }
}

/* ---- Follow-up after a disruption (XD-10) ---- */

export const RATINGS = ['good', 'ok', 'poor'] as const
export type Rating = (typeof RATINGS)[number]
export const MAX_DEBRIEF_NOTE = 280
export interface Debrief { id: ScenarioId; rating: Rating; note: string; at: number }

/** Only a poor rating asks for a person to look at it, and says so. */
export const needsHumanReview = (d: Debrief): boolean => d.rating === 'poor'

/** Records or replaces the answer for one disruption. */
export function addDebrief(list: readonly Debrief[], id: ScenarioId, rating: Rating, note: string, at: number): Debrief[] {
  return [...list.filter((d) => d.id !== id), { id, rating, note: note.trim().slice(0, MAX_DEBRIEF_NOTE), at }]
}

/** The disruptions that are over and have not been rated yet. */
export const awaitingDebrief = (endedIds: readonly string[], list: readonly Debrief[]): ScenarioId[] =>
  endedIds.flatMap((id) => (disruptionById(id) && !list.some((d) => d.id === id) ? [id as ScenarioId] : []))

export const normalizeDebriefs = (raw: unknown): Debrief[] =>
  (Array.isArray(raw) ? raw : []).flatMap((x): Debrief[] => {
    if (typeof x !== 'object' || x === null) return []
    const d = x as Record<string, unknown>
    return disruptionById(d.id) && RATINGS.includes(d.rating as Rating) && typeof d.at === 'number' ? [{ id: d.id as ScenarioId, rating: d.rating as Rating, note: typeof d.note === 'string' ? d.note.slice(0, MAX_DEBRIEF_NOTE) : '', at: d.at }] : []
  })
