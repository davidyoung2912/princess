import type { Cents } from './pricing'
import { personaById, type PersonaId, type Tier } from './personas'
import { addDays } from './timezones'

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

export const CASE_TEXT_MAX = 600
export const CASE_PLACE_MAX = 80
export const CLAIM_MAX = 500_000
export const RECOVERY_CREDIT: Cents = 5000
/** Days after the answer that a refund takes to reach the card. */
export const REFUND_DAYS = 3

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

export const COMMENT_MAX = 1000
export const CREW_MAX = 3
export const CREW_NAME_MAX = 60
/** Feedback can be changed this many days after the cruise. */
export const FEEDBACK_EDIT_DAYS = 14

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

/** Days on the guest's record before this cruise: the level's minimum, unless an authored record says more. */
const DAYS_BEFORE: Partial<Record<PersonaId, number>> = { maria: 0, marcus: 28, daniel: 33, priya: 33, gerald: 112 }

export const daysBefore = (id: PersonaId): number => DAYS_BEFORE[id] ?? TIER_DAYS[personaById(id)?.tier ?? 'none']

export const tierForDays = (days: number): Tier => [...TIER_ORDER].reverse().find((t) => days >= TIER_DAYS[t]) ?? 'none'

export interface LoyaltyStatus { before: Tier; after: Tier; daysBefore: number; daysAfter: number; next: Tier | null; daysToNext: number | null; promoted: boolean }

/** Level and days before and after this cruise (7 nights). A level already held is never lost. */
export function loyaltyStatus(id: PersonaId, nights: number, counted: boolean): LoyaltyStatus {
  const p = personaById(id)!
  const before = daysBefore(id)
  const daysAfter = before + (counted ? nights : 0)
  const reached = tierForDays(daysAfter)
  const heldIndex = TIER_ORDER.indexOf(p.tier)
  const after = TIER_ORDER[Math.max(TIER_ORDER.indexOf(reached), heldIndex)]
  const next = TIER_ORDER[TIER_ORDER.indexOf(after) + 1] ?? null
  return { before: p.tier, after, daysBefore: before, daysAfter, next, daysToNext: next ? Math.max(0, TIER_DAYS[next] - daysAfter) : null, promoted: counted && TIER_ORDER.indexOf(after) > heldIndex }
}

// ---- Referral (POS-08) ----

export const REFERRAL_CREDIT: Cents = 5000
export type ReferralState = 'invited' | 'booked' | 'sailed'

export const referralCode = (id: PersonaId): string => `${personaById(id)!.firstName.toUpperCase()}${100 + (hash(`ref|${id}`) % 900)}`

export const REFERRALS: Partial<Record<PersonaId, readonly { name: string; state: ReferralState }[]>> = {
  gerald: [{ name: 'Ruth', state: 'sailed' }, { name: 'Frank', state: 'invited' }],
  alexander: [{ name: 'Camille', state: 'booked' }],
}

/** Credit earned: both sides get it when the friend has sailed. */
export const referralEarned = (id: PersonaId): Cents => (REFERRALS[id] ?? []).filter((r) => r.state === 'sailed').length * REFERRAL_CREDIT

// ---- Rebooking (POS-06) ----

/** Hold a price and an offer for this many days (a week). */
export const HOLD_DAYS = 7
/** Deposit per guest when booking on board, instead of a fifth of the fare. */
export const ONBOARD_DEPOSIT: Cents = 10_000
/** Onboard credit for booking on board, and the extra for each level. */
export const BOOKING_CREDIT: Cents = 10_000
export const LEVEL_CREDIT: Record<Tier, Cents> = { none: 0, gold: 2500, ruby: 5000, platinum: 7500, elite: 10_000 }
/** Future cruise credit left from an earlier cruise. */
export const FCC_LEFT: Partial<Record<PersonaId, Cents>> = { gerald: 15_000, linda: 10_000, alexander: 25_000 }
/** Booking at least this many days after the cruise ends. */
export const REBOOK_GAP_DAYS = 14

export const fccBefore = (id: PersonaId): Cents => FCC_LEFT[id] ?? 0

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

export const SUSTAINABILITY = {
  nauticalMiles: 2000,
  fuel: 'lng',
  programmes: ['shorePower', 'foodWaste', 'noPlastic', 'ecoExcursions'] as const,
  tips: ['towels', 'refill', 'excursions', 'lights'] as const,
} as const
