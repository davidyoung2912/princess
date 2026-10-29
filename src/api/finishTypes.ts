import type { CaseInput, CaseKind, CaseOutcome, CaseStage, Feedback } from '../domain/postcruise'
import type { CustomsDeclaration, NightEntry, OnwardCheck, OnwardPlan, ReceiptId, TagGroup, WalkOffId } from '../domain/disembark'
import type { PersonaId, Tier } from '../domain/personas'
import type { Cents } from '../domain/pricing'
import type { CategoryId } from '../domain/ship'
import type { LoyaltyStatus, ReferralState } from '../domain/postcruise'

/** Disembarkation and after the cruise (phase 8): the shapes screens and the mock share. */

export interface DisembarkGuest { id: PersonaId; name: string; printed: string; bags: number; cabin: string; /** The text printed on the tag, when tags are chosen. */ label: string | null }

export interface DisembarkView {
  option: WalkOffId | null
  /** Where each way of getting off puts this booking. */
  group: TagGroup
  priority: boolean
  guests: DisembarkGuest[]
  tagsOn: boolean
  times: { arrivalAt: number; bagsOutAt: number; vacateAt: number; tipBy: number }
  /** When this booking can leave the ship with each choice. */
  offAt: Record<WalkOffId, number>
  /** Aboard, an adult, and before the bags-out time. */
  canChoose: boolean
  closed: boolean
  /** The guest has asked for help getting around, so carrying bags needs care. */
  needsHelp: boolean
  customsDone: boolean
  onwardSaved: boolean
  /** Photos can be downloaded until this moment. */
  photosUntil: number
}

export interface CustomsView {
  declaration: CustomsDeclaration | null
  submittedAt: number | null
  people: number
  allowanceUsd: number
  declare: string[]
  overUsd: number
  canEdit: boolean
}

export interface OnwardView {
  plan: OnwardPlan | null
  /** Null until a plan is saved. */
  check: OnwardCheck | null
  /** When this booking leaves the ship under its choice (or the default of the tag group). */
  offFrom: number
  people: number
  canEdit: boolean
}

export interface NightView { entries: NightEntry[]; option: WalkOffId | null }

export interface FinalBillView {
  /** The card the balance is charged to, "Visa ending 4242", or null when none is on file. */
  card: string | null
  tip: { charged: Cents; keepPercent: number; credit: Cents; by: number; canAdjust: boolean }
  receipts: { id: ReceiptId; available: boolean }[]
  emailedAt: number | null
  emailedTo: string | null
  /** Bill queries opened from the bill. */
  queries: { id: string; lineId: string; number: string; stage: CaseStage; cents: Cents }[]
  settled: boolean
}

export interface CaseView {
  id: string
  kind: CaseKind
  number: string
  summary: string
  place: string
  cents: Cents
  openedAt: number
  dueAt: number
  stage: CaseStage
  outcome: CaseOutcome | null
  refund: { cents: Cents; sent: boolean; expectedBy: number } | null
  canWithdraw: boolean
  fromFeedback: boolean
}

export interface CasesView { cases: CaseView[]; canOpen: boolean }

export interface CasesApi {
  list(): Promise<CasesView>
  open(input: CaseInput): Promise<CasesView>
  withdraw(id: string): Promise<CasesView>
}

export interface DisembarkApi {
  view(): Promise<DisembarkView>
  choose(input: { option: WalkOffId; bags: Record<string, number> }): Promise<DisembarkView>
  setTagsOn(on: boolean): Promise<DisembarkView>
  customs(): Promise<CustomsView>
  saveCustoms(d: CustomsDeclaration): Promise<CustomsView>
  onward(): Promise<OnwardView>
  saveOnward(plan: OnwardPlan): Promise<OnwardView>
  night(): Promise<NightView>
  tick(id: string, done: boolean): Promise<NightView>
  finalBill(): Promise<FinalBillView>
  adjustTip(keepPercent: number): Promise<FinalBillView>
  emailReceipt(): Promise<FinalBillView>
}

export interface HistoryDoc { id: 'fareReceipt' | 'folioStatement' | 'gratuityStatement' | 'taxSummary'; /** Whether it is ready to open. */ ready: boolean }

export interface HistoryTrip { id: string; title: string; ship: string; departure: string; nights: number; current: boolean; cancelled: boolean; fareCents: Cents | null; documents: HistoryDoc[] }

export interface HistoryView { trips: HistoryTrip[]; photosUntil: number | null; sailed: boolean }

export interface FeedbackView {
  open: boolean
  feedback: Feedback | null
  submittedAt: number | null
  editUntil: number
  crew: { id: string; name: string; role: string }[]
  /** The steward for the guest's stateroom, to suggest by name. */
  steward: string
  /** A service-recovery case opened from this feedback. */
  recovery: { number: string; dueAt: number; stage: CaseStage } | null
}

export interface LoyaltyView {
  status: LoyaltyStatus
  counted: boolean
  perks: string[]
  wifiDevices: number
  referral: { code: string; credit: Cents; earned: Cents; friends: { name: string; state: ReferralState }[] }
}

export interface HoldView {
  id: string
  departure: string
  category: CategoryId
  guests: number
  total: Cents
  deposit: Cents
  /** Onboard credit promised for holding on board. */
  credit: Cents
  fccApplied: Cents
  onboard: boolean
  placedAt: number
  expiresAt: number
  expired: boolean
  /** Whether the date is open to book now. */
  bookable: boolean
}

export interface RebookOption { id: string; departure: string; bookable: boolean; total: Cents; deposit: Cents; credit: Cents }

export interface DeskSlot { at: number; day: number }

export interface RebookView {
  category: CategoryId
  guests: number
  tier: Tier
  /** Held on board (the bigger offer) or after. */
  onboardOffer: boolean
  options: RebookOption[]
  holds: HoldView[]
  fccLeft: Cents
  fccConverted: Cents
  appointment: { at: number } | null
  slots: DeskSlot[]
  canHold: boolean
}

export interface PostApi {
  history(): Promise<HistoryView>
  feedback(): Promise<FeedbackView>
  saveFeedback(f: Feedback): Promise<FeedbackView>
  loyalty(): Promise<LoyaltyView>
  rebook(): Promise<RebookView>
  hold(departureId: string): Promise<RebookView>
  releaseHold(id: string): Promise<RebookView>
  convertFcc(): Promise<RebookView>
  bookSlot(at: number): Promise<RebookView>
  cancelSlot(): Promise<RebookView>
}
