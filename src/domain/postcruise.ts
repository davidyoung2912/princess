import type { Cents } from './money'
import type { PersonaId, Tier } from './people'
import { addDays } from './timezones'
import { limit } from './limits'
import { registerContent } from './content'

/**
 * After the cruise (POS-01 to POS-14): cases for lost items, bills, claims and complaints, feedback with service
 * recovery, Captain's Circle progress, rebooking, referral and sustainability. Offers, amounts and figures are
 * authored concept values (verify before real use).
 */
const HOUR = 3_600_000

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

// ---- Cases (DEB-06, POS-07, POS-11) ----

export type CaseKind = 'lostItem' | 'billing' | 'claim' | 'complaint' | 'recovery'
/** The kinds a guest opens themselves; recovery cases open from poor feedback. */
export const OPEN_KINDS: readonly CaseKind[] = ['lostItem', 'billing', 'claim', 'complaint']

/** Hours the team has to reply with an answer. */
export const SLA_HOURS: Record<CaseKind, number> = { lostItem: 72, billing: 120, claim: 240, complaint: 72, recovery: 48 }
const CODES: Record<CaseKind, string> = { lostItem: 'LF', billing: 'BD', claim: 'CL', complaint: 'CP', recovery: 'SR' }

export let CASE_TEXT_MAX = 600
export let CASE_PLACE_MAX = 80
export let CLAIM_MAX = 500_000
export let RECOVERY_CREDIT: Cents = 5000
/** Days after the answer that a refund takes to reach the card. */
export let REFUND_DAYS = 3

export interface CaseInput { kind: CaseKind; summary: string; place: string; /** For a bill query, the line and its amount; for a claim, the amount asked for. */ lineId: string; cents: number }

export function caseProblem(c: CaseInput): string | null {
  if (!OPEN_KINDS.includes(c.kind)) return 'badKind'
  if (typeof c.summary !== 'string' || c.summary.trim().length < 5 || c.summary.length > CASE_TEXT_MAX) return 'badSummary'
  if (typeof c.place !== 'string' || c.place.length > CASE_PLACE_MAX) return 'badPlace'
  if (c.kind === 'lostItem' && c.place.trim().length === 0) return 'noPlace'
  if (c.kind === 'billing' && (typeof c.lineId !== 'string' || c.lineId.length === 0 || c.lineId.length > 80)) return 'noLine'
  if (c.kind === 'billing' && (!Number.isInteger(c.cents) || c.cents < 1 || c.cents > CLAIM_MAX)) return 'badAmount'
  if (c.kind === 'claim' && (!Number.isInteger(c.cents) || c.cents < 1 || c.cents > CLAIM_MAX)) return 'badAmount'
  return null
}

export type CaseStage = 'received' | 'inReview' | 'resolved' | 'withdrawn'
export type CaseOutcome = 'found' | 'notFound' | 'refunded' | 'explained' | 'goodwill' | 'replied' | 'credit'

export interface CaseTimes { kind: CaseKind; number: string; openedAt: number; cents: number; withdrawnAt?: number }

export interface CaseStatus {
  stage: CaseStage
  /** When the team's answer is due. */
  dueAt: number
  outcome: CaseOutcome | null
  /** What goes back to the guest in money, when the answer is a refund or goodwill payment. */
  refund: { cents: Cents; sent: boolean; expectedBy: number } | null
}

/** A case number that is the same every time for the same booking and count, such as "PC-LF-48213". */
export const caseNumber = (kind: CaseKind, booker: PersonaId, seq: number): string => `PC-${CODES[kind]}-${String(10_000 + (hash(`${booker}|${kind}|${seq}`) % 90_000))}`

/** Where a case stands at a moment: received for the first day, in review until it is due, then answered. The answer is steady for a case number. */
export function caseStatus(c: CaseTimes, now: number): CaseStatus {
  const dueAt = c.openedAt + SLA_HOURS[c.kind] * HOUR
  if (c.withdrawnAt !== undefined) return { stage: 'withdrawn', dueAt, outcome: null, refund: null }
  if (now < dueAt) return { stage: now - c.openedAt < 24 * HOUR ? 'received' : 'inReview', dueAt, outcome: null, refund: null }
  const h = hash(c.number)
  const expectedBy = dueAt + REFUND_DAYS * 24 * HOUR
  switch (c.kind) {
    case 'lostItem': return { stage: 'resolved', dueAt, outcome: h % 3 === 0 ? 'notFound' : 'found', refund: null }
    case 'billing': return h % 4 === 0
      ? { stage: 'resolved', dueAt, outcome: 'explained', refund: null }
      : { stage: 'resolved', dueAt, outcome: 'refunded', refund: { cents: c.cents, sent: now >= expectedBy, expectedBy } }
    case 'claim': return { stage: 'resolved', dueAt, outcome: 'goodwill', refund: { cents: Math.round(c.cents / 2), sent: now >= expectedBy, expectedBy } }
    case 'complaint': return { stage: 'resolved', dueAt, outcome: 'replied', refund: null }
    case 'recovery': return { stage: 'resolved', dueAt, outcome: 'credit', refund: { cents: RECOVERY_CREDIT, sent: true, expectedBy: dueAt } }
  }
}

/** A case can be withdrawn until it is answered. */
export const caseWithdrawable = (s: CaseStatus): boolean => s.stage === 'received' || s.stage === 'inReview'

export type CaseStep = 'sent' | 'looked' | 'answered'
/** The steps for a case: sent, being looked at, answered. A withdrawn case shows none. */
export function caseSteps(stage: CaseStage): { id: CaseStep; state: 'done' | 'current' | 'todo' }[] {
  if (stage === 'withdrawn') return []
  if (stage === 'received') return [{ id: 'sent', state: 'current' }, { id: 'looked', state: 'todo' }, { id: 'answered', state: 'todo' }]
  if (stage === 'inReview') return [{ id: 'sent', state: 'done' }, { id: 'looked', state: 'current' }, { id: 'answered', state: 'todo' }]
  return [{ id: 'sent', state: 'done' }, { id: 'looked', state: 'done' }, { id: 'answered', state: 'done' }]
}

// ---- Feedback (POS-02, POS-11, POS-14) ----

export const AREAS = ['ship', 'dining', 'entertainment', 'crew', 'excursions'] as const
export type AreaId = (typeof AREAS)[number]

export interface Feedback {
  overall: number
  areas: Partial<Record<AreaId, number>>
  comment: string
  crew: string[]
  /** May the team contact the guest about a problem. */
  allowContact: boolean
  /** May the ship's team see the comment with the guest's name. */
  shareName: boolean
}

export const blankFeedback = (): Feedback => ({ overall: 0, areas: {}, comment: '', crew: [], allowContact: false, shareName: false })

export let COMMENT_MAX = 1000
export let CREW_MAX = 3
export let CREW_NAME_MAX = 60
/** Feedback can be changed this many days after the cruise. */
export let FEEDBACK_EDIT_DAYS = 14

const rating = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5

export function feedbackProblem(f: Feedback): string | null {
  if (!rating(f.overall)) return 'noOverall'
  for (const [k, v] of Object.entries(f.areas)) if (!(AREAS as readonly string[]).includes(k) || !rating(v)) return 'badRating'
  if (typeof f.comment !== 'string' || f.comment.length > COMMENT_MAX) return 'badComment'
  if (!Array.isArray(f.crew) || f.crew.length > CREW_MAX || f.crew.some((n) => typeof n !== 'string' || n.trim().length === 0 || n.length > CREW_NAME_MAX)) return 'badCrew'
  if (typeof f.allowContact !== 'boolean' || typeof f.shareName !== 'boolean') return 'badConsent'
  return null
}

/** Poor feedback (2 or below overall or in any area) starts service recovery. */
export const needsRecovery = (f: Feedback): boolean => f.overall <= 2 || Object.values(f.areas).some((r) => r !== undefined && r <= 2)

export interface CrewMember { id: string; name: string; role: 'steward' | 'dining' | 'entertainment' | 'guest' }

/** Crew the guest can pick to thank by name. */
export const CREW: readonly CrewMember[] = [
  { id: 'marisol', name: 'Marisol', role: 'steward' },
  { id: 'dennis', name: 'Dennis', role: 'steward' },
  { id: 'aiko', name: 'Aiko', role: 'steward' },
  { id: 'rafael', name: 'Rafael', role: 'dining' },
  { id: 'joy', name: 'Joy', role: 'dining' },
  { id: 'tomas', name: 'Tomas', role: 'entertainment' },
  { id: 'imani', name: 'Imani', role: 'guest' },
]

// ---- Captain's Circle (POS-05) ----

export const TIER_ORDER: readonly Tier[] = ['none', 'gold', 'ruby', 'platinum', 'elite']
/** Cruise days that reach each level. */
export const TIER_DAYS: Record<Tier, number> = { none: 0, gold: 5, ruby: 30, platinum: 90, elite: 150 }

export const tierForDays = (days: number): Tier => [...TIER_ORDER].reverse().find((t) => days >= TIER_DAYS[t]) ?? 'none'

export interface LoyaltyStatus { before: Tier; after: Tier; daysBefore: number; daysAfter: number; next: Tier | null; daysToNext: number | null; promoted: boolean }

// ---- Referral (POS-08) ----

export let REFERRAL_CREDIT: Cents = 5000
export type ReferralState = 'invited' | 'booked' | 'sailed'

// ---- Rebooking (POS-06) ----

/** Hold a price and an offer for this many days (a week). */
export let HOLD_DAYS = 7
/** Deposit per guest when booking on board, instead of a fifth of the fare. */
export let ONBOARD_DEPOSIT: Cents = 10_000
/** Onboard credit for booking on board, and the extra for each level. */
export let BOOKING_CREDIT: Cents = 10_000
export const LEVEL_CREDIT: Record<Tier, Cents> = { none: 0, gold: 2500, ruby: 5000, platinum: 7500, elite: 10_000 }
/** Booking at least this many days after the cruise ends. */
export let REBOOK_GAP_DAYS = 14

/** The deposit for a held cruise: a fifth of the fare in whole dollars, or the lower onboard deposit when held on board. */
export function holdDeposit(total: Cents, guests: number, onboard: boolean): Cents {
  const standard = Math.min(total, Math.round((total * 0.2) / 100) * 100)
  return onboard ? Math.min(standard, ONBOARD_DEPOSIT * guests) : standard
}

export const holdExpiry = (placedAt: number): number => placedAt + HOLD_DAYS * 24 * HOUR

/** The first morning a cruise can be held after a cruise ends. */
export const earliestRebook = (lastDay: string): string => addDays(lastDay, REBOOK_GAP_DAYS)

// ---- The Future Cruise desk (POS-06) ----

export const DESK = { place: 'Deck 9 midship', days: [2, 6, 7] as readonly number[], first: '10:00', last: '16:30', stepMinutes: 30 } as const

export const deskTimes = (): string[] => {
  const out: string[] = []
  for (let m = 10 * 60; m <= 16 * 60 + 30; m += DESK.stepMinutes) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return out
}

// ---- Sustainability (POS-12) ----

export const SUSTAINABILITY: {
  /** The focused sailing's whole track in nautical miles, from the server's ship-position feed; 0 while it is not known. The authored 2000 is the sample week's. */
  nauticalMiles: number
  fuel: 'lng'
  programmes: readonly ['shorePower', 'foodWaste', 'noPlastic', 'ecoExcursions']
  tips: readonly ['towels', 'refill', 'excursions', 'lights']
} = {
  nauticalMiles: 2000,
  fuel: 'lng',
  programmes: ['shorePower', 'foodWaste', 'noPlastic', 'ecoExcursions'],
  tips: ['towels', 'refill', 'excursions', 'lights'],
}

/** Sets the distance of the sailing in focus (0 when unknown); screens that show it draw again on the catalogue notice. */
export const setVoyageMiles = (nm: number): void => { SUSTAINABILITY.nauticalMiles = Number.isFinite(nm) && nm > 0 ? Math.round(nm) : 0 }

/** ", about 2,000 nautical miles" for a sentence, or nothing when the distance is not known. */
export const milesPhrase = (nm: number): string => (nm > 0 ? `, about ${nm.toLocaleString('en-US')} nautical miles` : '')

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('CASE_TEXT_MAX', (v) => { CASE_TEXT_MAX = v }, CASE_TEXT_MAX)
limit('CASE_PLACE_MAX', (v) => { CASE_PLACE_MAX = v }, CASE_PLACE_MAX)
limit('CLAIM_MAX', (v) => { CLAIM_MAX = v }, CLAIM_MAX)
limit('RECOVERY_CREDIT', (v) => { RECOVERY_CREDIT = v }, RECOVERY_CREDIT)
limit('REFUND_DAYS', (v) => { REFUND_DAYS = v }, REFUND_DAYS)
limit('COMMENT_MAX', (v) => { COMMENT_MAX = v }, COMMENT_MAX)
limit('CREW_MAX', (v) => { CREW_MAX = v }, CREW_MAX)
limit('CREW_NAME_MAX', (v) => { CREW_NAME_MAX = v }, CREW_NAME_MAX)
limit('FEEDBACK_EDIT_DAYS', (v) => { FEEDBACK_EDIT_DAYS = v }, FEEDBACK_EDIT_DAYS)
limit('REFERRAL_CREDIT', (v) => { REFERRAL_CREDIT = v }, REFERRAL_CREDIT)
limit('HOLD_DAYS', (v) => { HOLD_DAYS = v }, HOLD_DAYS)
limit('ONBOARD_DEPOSIT', (v) => { ONBOARD_DEPOSIT = v }, ONBOARD_DEPOSIT)
limit('BOOKING_CREDIT', (v) => { BOOKING_CREDIT = v }, BOOKING_CREDIT)
limit('REBOOK_GAP_DAYS', (v) => { REBOOK_GAP_DAYS = v }, REBOOK_GAP_DAYS)

registerContent('postcruise', { OPEN_KINDS, SLA_HOURS, AREAS, CREW, TIER_ORDER, TIER_DAYS, LEVEL_CREDIT, DESK, SUSTAINABILITY })

// ---- What the crew see (N6.6) ----

export interface CrewNote { crew: string; note: string; from: string | null }

/**
 * What each thanked crew member is shown: the guest's own note, and the guest's first name only if they allowed it.
 * It is built from the feedback alone. A gratuity is never an input here, so it cannot reach this view, and the ratings stay out of it too.
 */
export function crewNotes(f: Feedback, firstName: string): CrewNote[] {
  const note = f.comment.trim()
  return f.crew.map((crew) => ({ crew, note, from: f.shareName && firstName.trim() ? firstName.trim() : null }))
}
