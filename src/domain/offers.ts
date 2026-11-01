import type { PackageId, Tier } from './personas'
import type { StageId } from './sailings'

/**
 * The offers area (UX-02, CNT-02, NOT-04). Offers are restrained: required tasks outrank them, they live on one page plus at
 * most one card on Home, every one can be dismissed for the trip, and none uses a timer or says that stock is short.
 */
export type OfferStage = 'before' | 'aboard' | 'after'
export type OfferId = 'upgrade' | 'package' | 'excursions' | 'clubs' | 'drinks' | 'spa' | 'wifi' | 'photos' | 'rebook'

export interface OfferDef {
  id: OfferId
  stages: readonly OfferStage[]
  /** Where "See it" goes. */
  to: string
  /** Shown only to these loyalty tiers; any tier when absent. */
  tiers?: readonly Tier[]
  /** A guest who already has a package is not offered one (suppression after purchase). */
  hiddenWithPackage?: boolean
}

/** Authored concept offers, in the order they are shown. */
export const OFFERS: readonly OfferDef[] = [
  { id: 'package', stages: ['before'], to: '/me/packages', hiddenWithPackage: true },
  { id: 'upgrade', stages: ['before'], to: '/plan/upgrades' },
  { id: 'excursions', stages: ['before', 'aboard'], to: '/plan/excursions' },
  { id: 'clubs', stages: ['before'], to: '/plan/clubs' },
  { id: 'drinks', stages: ['aboard'], to: '/ship/drinks', hiddenWithPackage: true },
  { id: 'spa', stages: ['aboard'], to: '/ship/spa' },
  { id: 'wifi', stages: ['aboard'], to: '/ship/wifi' },
  { id: 'photos', stages: ['aboard'], to: '/ship/photos' },
  { id: 'rebook', stages: ['after'], to: '/me/rebook', tiers: ['none', 'gold', 'ruby'] },
]

/** Which part of the trip a stage belongs to. */
export function offerStageOf(stage: StageId): OfferStage {
  if (stage === 'booked' || stage === 'preCruise' || stage === 'checkIn') return 'before'
  if (stage === 'disembark' || stage === 'postCruise') return 'after'
  return 'aboard'
}

export interface OfferContext {
  stage: OfferStage
  tier: Tier
  package: PackageId
  /** Offers the guest dismissed for this trip. */
  dismissed: readonly string[]
}

/** What the offers page lists: the offers for this part of the trip, this tier and this package, without the dismissed ones. */
export function offersFor(c: OfferContext): OfferDef[] {
  return OFFERS.filter((o) => o.stages.includes(c.stage) && (!o.tiers || o.tiers.includes(c.tier)) && !(o.hiddenWithPackage && c.package !== 'none') && !c.dismissed.includes(o.id))
}

/** The offers dismissed for this trip that would otherwise show, so the page can offer "Show again". */
export function dismissedFor(c: OfferContext): OfferDef[] {
  return offersFor({ ...c, dismissed: [] }).filter((o) => c.dismissed.includes(o.id))
}

export interface HomeOfferInput extends OfferContext {
  /** A payment, a document, check-in or a trip change is waiting: that always comes first, so no offer shows. */
  taskWaiting: boolean
  /** The stage itself, so the last day and the ship's safety times stay clear of offers. */
  stageId: StageId
}

/** Stages with no offers at all: the last night and morning (checkout) and the first hours when safety comes first. */
const QUIET_STAGES: readonly StageId[] = ['embarkation', 'farewell', 'disembark']

/** The one contextual card for Home, or null. Never shown over a required task, at embarkation, or at checkout. */
export function homeOffer(i: HomeOfferInput): OfferDef | null {
  if (i.taskWaiting || QUIET_STAGES.includes(i.stageId) || i.stage === 'after') return null
  return offersFor(i)[0] ?? null
}

/** Routes that never show an offer card (safety, emergency, checkout and payment screens). */
export const OFFER_FREE_PREFIXES: readonly string[] = ['/ship/muster', '/ship/emergency', '/ship/help-now', '/ship/health', '/home/disembark', '/home/check-in', '/me/bill']

export const isOfferFree = (path: string): boolean => OFFER_FREE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

// ---- Per-person state: dismissals and marketing messages ----

export interface OfferState {
  /** Offer ids dismissed, by booking number. */
  dismissed: Record<string, string[]>
  /** When marketing messages were sent, as epoch ms, oldest first. Only the last week matters. */
  sent: number[]
}

export const EMPTY_OFFER_STATE: OfferState = { dismissed: {}, sent: [] }

const WEEK = 7 * 24 * 3_600_000
const ids = new Set<string>(OFFERS.map((o) => o.id))

/** State from untrusted stored data. Unknown offers are dropped, and so is anything that is not a plain list or number. */
export function normalizeOfferState(raw: unknown): OfferState {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const dismissed: Record<string, string[]> = {}
  if (o.dismissed && typeof o.dismissed === 'object') {
    for (const [trip, list] of Object.entries(o.dismissed as Record<string, unknown>)) {
      if (Array.isArray(list)) dismissed[trip] = [...new Set(list.filter((x): x is string => typeof x === 'string' && ids.has(x)))]
    }
  }
  const sent = Array.isArray(o.sent) ? o.sent.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b) : []
  return { dismissed, sent }
}

export const dismissOffer = (s: OfferState, trip: string, id: OfferId): OfferState => ({ ...s, dismissed: { ...s.dismissed, [trip]: [...new Set([...(s.dismissed[trip] ?? []), id])] } })

export const restoreOffer = (s: OfferState, trip: string, id: OfferId): OfferState => ({ ...s, dismissed: { ...s.dismissed, [trip]: (s.dismissed[trip] ?? []).filter((x) => x !== id) } })

/** No more than this many marketing messages go out in any seven days. Booking, payment and safety messages are exempt (NOT-04). */
export const MARKETING_WEEKLY_CAP = 2

/** Marketing messages sent in the seven days up to `now`. */
export const sentThisWeek = (s: OfferState, now: number): number => s.sent.filter((t) => t > now - WEEK && t <= now).length

/** How many more marketing messages may go out now. */
export const marketingLeft = (s: OfferState, now: number, cap: number = MARKETING_WEEKLY_CAP): number => Math.max(0, cap - sentThisWeek(s, now))

/** Whether a message of this kind counts against the cap: only marketing does. */
export const countsAgainstCap = (category: 'critical' | 'payments' | 'documents' | 'checkin' | 'offers'): boolean => category === 'offers'

/** Records a marketing message if the cap allows it; returns the new state and whether it may be sent. Old entries are dropped. */
export function sendMarketing(s: OfferState, now: number, cap: number = MARKETING_WEEKLY_CAP): { state: OfferState; allowed: boolean } {
  const recent = s.sent.filter((t) => t > now - WEEK)
  if (recent.length >= cap) return { state: { ...s, sent: recent }, allowed: false }
  return { state: { ...s, sent: [...recent, now] }, allowed: true }
}
