import type { Entitlements, Balance, BalanceKey } from '../domain/entitlements'
import type { PackageId, PersonaId, StateroomKind, Tier } from '../domain/personas'
import type { PortId } from '../domain/sailings'
import type { FromPrice, Quote } from '../domain/pricing'
import type { CategoryId } from '../domain/ship'
import type { Card, CardBrand, Helper, HistoryEntry, PermissionId, Profile } from '../domain/account'
import type { Citizenship, DocId, Held, ReqResult } from '../domain/documents'
import type { Notice, NotificationPrefs } from '../domain/notifications'
import type { TicketStatus } from '../domain/help'
import type { NextActionId, PastTrip, PaymentPlan, PaymentState } from '../domain/trip'

/**
 * The contract between screens and "the server". Screens only ever use this interface; the mock below implements it with
 * async answers, seeded delay and failure, and an offline switch, so a real service could replace it without touching them.
 * Each group starts with the calls the first screens need and grows as phases add features.
 */
export interface Identity {
  personaId: PersonaId
  name: string
  tier: Tier
}

export interface Booking {
  personaId: PersonaId
  bookerId: PersonaId
  sailingId: string
  party: PersonaId[]
  stateroom: StateroomKind
  tier: Tier
  package: PackageId
}

export interface Sailing {
  id: string
  departure: string
}

export interface CheckinStatus {
  state: 'notOpen' | 'open' | 'done'
  /** When online check-in opens (three days before departure). */
  opensAt: number
}

export interface Item {
  id: string
  at: number
  data: unknown
}

export interface Message {
  id: string
  from: PersonaId
  text: string
  at: number
}

export interface PortToday {
  port: PortId
  day: number | null
}

export interface SailingOffer {
  id: string
  departure: string
  holiday: boolean
  from: FromPrice
}

/** A person on the signed-in guest's booking. */
export interface PartyMember {
  id: PersonaId
  name: string
  age: number
  child: boolean
}

export interface TripView {
  /** Booking number. */
  number: string
  kind: 'current' | 'linked'
  sailingId: string
  departure: string
  categoryName: string
  guests: number
  /** Days from today (ship home time) to departure; negative once sailed. */
  daysToDeparture: number
  plan: PaymentPlan
  payment: PaymentState
  /** Null for a travel-agent booking, whose documents are handled with the agent. */
  documents: { guests: number; missing: number; passportProblems: number } | null
  checkin: CheckinStatus
  next: NextActionId
  agent?: string
}

export interface TripsView {
  upcoming: TripView[]
  past: PastTrip[]
}

export interface Receipt {
  id: string
  label: 'deposit' | 'balance'
  cents: number
  at: number
  method: string
}

export interface PaymentsView {
  trip: TripView
  receipts: Receipt[]
  cards: Card[]
  /** Whether the signed-in person may pay (not a supervised child account). */
  canPay: boolean
}

export interface GuestDocumentsView {
  id: PersonaId
  name: string
  age: number
  citizenship: Citizenship
  held: Held
  results: ReqResult[]
  blocking: number
}

export interface DocumentsView {
  returnDate: string
  guests: GuestDocumentsView[]
  canEdit: boolean
}

export interface NoticeView extends Notice {
  read: boolean
}

export interface Ticket {
  id: string
  kind: 'callback' | 'email'
  at: number
  status: TicketStatus
  detail: string
}

export interface ProfileView {
  profile: Profile
  /** Whose profile this is. */
  id: PersonaId
  canEdit: boolean
  /** Days to departure, used for the name rules. */
  daysToDeparture: number
}

export interface Api {
  auth: { me(): Promise<Identity> }
  bookings: { get(): Promise<Booking>; sailings(): Promise<Sailing[]> }
  checkin: { status(): Promise<CheckinStatus>; submit(): Promise<CheckinStatus> }
  dining: { list(): Promise<Item[]>; reschedule(id: string, to: string): Promise<Item> }
  queues: { list(): Promise<Item[]> }
  orders: { list(): Promise<Item[]>; place(items: string[]): Promise<Item> }
  messages: { list(): Promise<Message[]>; send(text: string): Promise<Message> }
  photos: { list(): Promise<Item[]>; download(id: string): Promise<Item> }
  folio: { entitlements(): Promise<{ entitlements: Entitlements; balances: Record<BalanceKey, Balance> }> }
  requests: { list(): Promise<Item[]>; create(kind: string, note: string): Promise<Item> }
  ports: { today(): Promise<PortToday> }
  discover: {
    /** Every sailing with its "from" price. */
    offers(): Promise<SailingOffer[]>
    /** An all-in estimate; rejects with `invalid` for an unknown sailing, room type or party size. */
    quote(sailingId: string, category: CategoryId, guests: number): Promise<Quote>
    /** Saved items (`kind:id`), in the order saved, for the signed-in person. */
    favourites(): Promise<string[]>
    /** Saves an item, or removes it if saved; returns the new list. */
    toggleFavourite(key: string): Promise<string[]>
  }
  account: {
    party(): Promise<PartyMember[]>
    profile(id: PersonaId): Promise<ProfileView>
    /** Rejects with `forbidden` for a child account or someone outside the party, `invalid` for bad fields, `conflict` for a name change that needs Guest Services. */
    saveProfile(id: PersonaId, profile: Profile): Promise<ProfileView>
    helper(): Promise<Helper | null>
    saveHelper(input: { name: string; relationship: string; permissions: PermissionId[]; status: 'active' | 'requested' }): Promise<Helper>
    revokeHelper(): Promise<Helper>
    history(): Promise<HistoryEntry[]>
  }
  trips: {
    list(): Promise<TripsView>
    get(number: string): Promise<TripView>
    /** Rejects with `invalid` (typing slip), `notFound` (no match), or `conflict` (already linked). */
    link(number: string, lastName: string, departure: string): Promise<TripView>
  }
  payments: {
    get(): Promise<PaymentsView>
    addCard(brand: CardBrand, last4: string, expiry: string): Promise<Card[]>
    removeCard(id: string): Promise<Card[]>
    payBalance(cardId: string): Promise<PaymentsView>
  }
  documents: {
    get(): Promise<DocumentsView>
    /** Records that a guest holds a document (with its expiry), or removes it when `held` is null. */
    set(guest: PersonaId, doc: DocId, held: { expires?: string } | null): Promise<DocumentsView>
  }
  notifications: {
    list(): Promise<{ notices: NoticeView[]; prefs: NotificationPrefs }>
    markRead(ids: string[]): Promise<void>
    savePrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>
  }
  support: {
    tickets(): Promise<Ticket[]>
    callback(phone: string): Promise<Ticket>
    email(message: string): Promise<Ticket>
  }
  help: { contacts(): Promise<{ guestServices: string; emergency: string }> }
}
