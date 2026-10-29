import type { Advisor, AdvisorWay, AssistKind, AssistStage, BagStage, ClubRegistration, ConsentRegion, ConsentState, MarketingChannel, MedallionStatus, TagWay, UpgradeOffer } from '../domain/ahead'
import type { FixId, FixStage } from '../domain/readiness'
import type { Cents } from '../domain/pricing'
import type { CategoryId } from '../domain/ship'
import type { PersonaId, Tier } from '../domain/personas'

/** Shapes for the Phase 13 groups: before-the-cruise services. */
export interface AdvisorRequest { id: string; advisorId: string; advisor: string; way: AdvisorWay; question: string; at: number; reply: string | null; callbackBy: number | null }
export interface AdvisorsApi {
  list(): Promise<AdvisorRequest[]>
  /** Rejects `invalid` with `badAdvisor`, `badWay`, `badPhone` or `noQuestion`, `forbidden` for a supervised account. */
  ask(input: { advisorId: Advisor['id']; way: AdvisorWay; phone: string; question: string }): Promise<AdvisorRequest[]>
}

export interface MarketingChoice { channel: MarketingChannel; contact: string; region: ConsentRegion; state: ConsentState | 'none'; askedAt: number | null; confirmedAt: number | null; needsCode: boolean; /** Shown so the demo can finish the second step. */ demoCode: string | null }
export interface MarketingView { choices: MarketingChoice[]; canEdit: boolean }
export interface MarketingApi {
  view(): Promise<MarketingView>
  /** Asks to be contacted. Where the guest's region needs it (Canada, the UK and the EU), nothing is subscribed until the code from the first message is entered. Rejects `invalid` (`badEmail`, `badPhone`, `badChannel`), `forbidden` for a child. */
  subscribe(channel: MarketingChannel, contact: string, region: ConsentRegion): Promise<MarketingView>
  /** Rejects `invalid` (`wrongCode`), `conflict` (`expired`, `nothingPending`). */
  confirm(channel: MarketingChannel, code: string): Promise<MarketingView>
  withdraw(channel: MarketingChannel): Promise<MarketingView>
}

export interface LoyaltyMine { number: string; tier: Tier; creditLeft: Cents }
export interface PerksApi {
  /** The signed-in person's own number and level, and the future cruise credit they have left. */
  mine(): Promise<LoyaltyMine>
}

export interface UpgradeBid { id: string; category: CategoryId; cents: Cents; at: number; status: 'open' | 'accepted' | 'declined' | 'withdrawn'; buyNow: boolean }
export interface UpgradesView {
  current: CategoryId
  offers: UpgradeOffer[]
  bids: UpgradeBid[]
  decidedAt: number
  /** Whether bids can still be placed. */
  open: boolean
  canEdit: boolean
}
export interface UpgradesApi {
  view(): Promise<UpgradesView>
  /** Rejects `invalid` (`badCategory`, `tooLow`, `tooHigh`, `notWhole`), `conflict` (`closed`, `duplicate`, `noCard`), `forbidden`. A bid at the "buy now" price is accepted at once. */
  bid(category: CategoryId, cents: Cents): Promise<UpgradesView>
  withdraw(id: string): Promise<UpgradesView>
}

export interface ClubChild { id: PersonaId; name: string; age: number; club: string | null; registered: boolean; registration: ClubRegistration | null }
export interface ClubsView { children: ClubChild[]; canEdit: boolean; open: boolean }
export interface ClubsApi {
  view(): Promise<ClubsView>
  /** Rejects `invalid` with a code from `clubProblem`, `forbidden` for a child's own account, `conflict` (`closed`) after sailing. */
  save(registration: ClubRegistration): Promise<ClubsView>
  withdraw(childId: PersonaId): Promise<ClubsView>
}

export interface MedallionView extends MedallionStatus { guests: { id: PersonaId; name: string }[]; address: string; trackingNumber: string; canEdit: boolean }
export interface MedallionApi {
  view(): Promise<MedallionView>
  /** Rejects `conflict` (`notDelivered`, `already`, `lost`), `forbidden` for a child. */
  activate(): Promise<MedallionView>
  /** Switches off the lost medallion and orders a replacement for collection. Rejects `conflict` (`already`). */
  lost(): Promise<MedallionView>
}

export interface TagGuest { id: PersonaId; name: string; printed: string; cabin: string; deck: number }
export interface TagsView {
  way: TagWay | null
  guests: TagGuest[]
  orderedAt: number | null
  daysToDeparture: number
  handedOverAt: number | null
  stage: BagStage
  canEdit: boolean
}
export interface TagsApi {
  view(): Promise<TagsView>
  /** Rejects `invalid` (`badWay`), `conflict` (`tooLate` for a mailed set inside 14 days), `forbidden`. */
  choose(way: TagWay): Promise<TagsView>
  /** Records that the bags were handed to porters, so their journey can be estimated. Rejects `conflict` (`notYet`). */
  handedOver(on: boolean): Promise<TagsView>
}

export interface FixRow { id: string; flow: FixId; note: string; at: number; reference: string; stage: FixStage; contactBy: number }
export interface FixApi {
  list(): Promise<FixRow[]>
  /** Opens a case for a flow whose steps did not help. Rejects `invalid` (`badFlow`, `noNote`), `conflict` (`duplicate`). */
  escalate(flow: FixId, note: string): Promise<FixRow[]>
}

export interface AssistRow { id: string; kind: AssistKind; note: string; phone: string; at: number; stage: AssistStage; reference: string; bookingNumber: string | null; terms: { fee: Cents; refund: Cents; credit: Cents } | null; choice: 'refund' | 'credit' | null }
export interface AssistApi {
  list(): Promise<AssistRow[]>
  /** Rejects `invalid` (`badKind`, `badPhone`, `noNote`, `noBooking`). Anyone on the account can ask on behalf of a guest they help. */
  ask(input: { kind: AssistKind; phone: string; note: string }): Promise<AssistRow[]>
  /** Once decided, how the money comes back. Rejects `conflict` (`notDecided`, `already`), `invalid`. */
  choose(id: string, choice: 'refund' | 'credit'): Promise<AssistRow[]>
}

export interface PrepApi {
  get(): Promise<string[]>
  set(id: string, on: boolean): Promise<string[]>
}

export interface SavedApi {
  /** Saved keys, such as `item:spa-swedish` or `excursion:coz-snorkel`, in the order saved. */
  list(): Promise<string[]>
  toggle(key: string): Promise<string[]>
}

export interface AheadApi {
  advisors: AdvisorsApi
  marketing: MarketingApi
  perks: PerksApi
  upgrades: UpgradesApi
  clubs: ClubsApi
  medallion: MedallionApi
  tags: TagsApi
  fix: FixApi
  assist: AssistApi
  prep: PrepApi
  saved: SavedApi
}
