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
import type { Draft, GuestDraft, LeadContact, DiningChoice, Occasion } from '../domain/booking'
import type { Cabin } from '../domain/cabins'
import type { BookingQuote, FareId, PayOption, PayPlan, PaymentPart, Promotion } from '../domain/fares'
import type { Acceptance, CancelTerms, ChangeCheck } from '../domain/policy'
import type { DietaryId, NeedId } from '../domain/account'
import type { ExcursionItem, TimingProblem, TourRefund } from '../domain/excursions'
import type { DiningPlan, Slot, Window as DiningWindow } from '../domain/dining'
import type { AddOnId, PriceState, Unit } from '../domain/packages'
import type { ChecklistEntry, Milestone } from '../domain/checklist'
import type { PackItem, Weather } from '../domain/packing'
import type { TravelPlan, Window as ArrivalWindow } from '../domain/travel'
import type { AssistId, Deadline, RequestStatus } from '../domain/assistance'
import type { PlanDay } from '../domain/plan'

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
  kind: 'current' | 'linked' | 'booked'
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

/** A sailing as the booking funnel shows it. */
export interface BookableSailing extends SailingOffer {
  open: boolean
  daysToDeparture: number
}

export interface RoomOption {
  id: CategoryId
  /** Fare per person for two sharing, before taxes and extras. */
  fare: number
  capacity: number
  /** The package the room type includes, if any. */
  includes: FareId | null
}

export interface FareOption {
  id: FareId
  /** The all-in total with this fare. */
  total: number
  /** Compared with the lowest-priced fare for this room type. */
  difference: number
  included: boolean
  perNight: number
}

export interface QuoteView {
  quote: BookingQuote
  promotions: Promotion[]
  /** Until when the price is held, in ms since 1970. */
  lockedUntil: number
  pay: PayPlan
  daysToDeparture: number
}

export interface PrefillView {
  people: GuestDraft[]
  contact: LeadContact
}

export interface ResumeSent {
  via: 'email' | 'sms'
  /** Where it was sent, with the middle hidden. */
  to: string
  /** The address of the link in the message. */
  link: string
  at: number
}

export interface BookingReceipt {
  id: string
  label: 'deposit' | 'full' | 'balance' | 'refund'
  cents: number
  at: number
  /** One entry per way the payment was made. */
  methods: string[]
}

export interface BookingView {
  number: string
  status: 'confirmed' | 'cancelled'
  sailingId: string
  departure: string
  returnDate: string
  category: CategoryId
  categoryName: string
  /** The stateroom number, or null when it is a guaranteed room to be assigned. */
  cabin: string | null
  fare: FareId
  people: GuestDraft[]
  contact: LeadContact
  dining: DiningChoice
  occasion: Occasion
  total: number
  paid: number
  balance: number
  finalDue: string
  payment: PaymentState
  receipts: BookingReceipt[]
  accepted: Acceptance[]
  /** Where the confirmation was sent. */
  notified: { via: 'email' | 'sms'; to: string }[]
  daysToDeparture: number
  createdAt: number
  /** What cancelling now would cost and refund. */
  cancel: CancelTerms
  canCancel: boolean
  canChange: boolean
  cancelled: { at: number; fee: number; refund: number } | null
}

export interface ChangePreview {
  check: ChangeCheck
  newTotal: number
  /** New total minus the old; negative is a saving. */
  difference: number
  /** Whether a stateroom picked earlier is kept. A moved booking goes back to a guaranteed room. */
  cabinKept: boolean
}

export interface BookInput {
  draft: Draft
  /** The total the guest saw; if the price has moved, the booking is refused so nothing is charged unseen. */
  expectedTotal: number
  option: PayOption
  parts: PaymentPart[]
  /** The bank's one-time code, when the bank asks. */
  challenge?: string
}


// ---- Pre-book and personalise (Phase 4) ----

export interface ExcursionOffer {
  item: ExcursionItem
  /** The day it runs, "YYYY-MM-DD", and the itinerary day number. */
  date: string
  day: number
  /** Places left on the sailing; 0 is sold out. */
  spots: number
  /** Whether it fits the ship's day. Every authored tour does; a tour that did not would be shown but not bookable. */
  timing: TimingProblem | null
  /** Be back at the landing by this local time, "HH:MM". */
  backBy: string
  daysToTour: number
  tender: boolean
}

export interface TourBooking {
  id: string
  excursionId: string
  guests: PersonaId[]
  /** Price of the tour for these guests. */
  total: number
  /** Part of it covered by the excursion credit. */
  credit: number
  methods: string[]
  at: number
  status: 'booked' | 'cancelled'
  /** What cancelling now would cost and refund; for a cancelled tour, what was refunded. */
  cancel: TourRefund
}

export interface CartLine {
  excursionId: string
  guests: PersonaId[]
  total: number
}

export interface ExcursionsView {
  offers: ExcursionOffer[]
  booked: TourBooking[]
  cart: CartLine[]
  cartTotal: number
  /** Excursion credit left across the party, and how much of it the cart would use. */
  creditLeft: number
  creditApplied: number
  party: PartyMember[]
  /** Whether the signed-in person may book (an adult, before the ship sails). */
  canBook: boolean
  daysToDeparture: number
}

export interface Reservation {
  id: string
  venueId: string
  day: number
  time: string
  guests: PersonaId[]
  note: string
  /** Dietary needs of the guests, passed on with the reservation. */
  dietary: { name: string; needs: DietaryId[] }[]
  /** Guests whose dinner is covered by their package. */
  covered: PersonaId[]
  charge: number
  at: number
  /** The day the reminder goes, "YYYY-MM-DD". */
  reminderOn: string
}

export interface DiningView {
  window: DiningWindow
  plan: DiningPlan
  /** The assigned time for a fixed seating, or null for Anytime Dining. */
  seating: string | null
  reservations: Reservation[]
  party: PartyMember[]
  /** Specialty dinners the party's packages still cover. */
  mealsLeft: number
  canBook: boolean
  daysToDeparture: number
}

export interface Pooled { total: number; used: number; remaining: number }

export interface PersonEntitlements {
  id: PersonaId
  name: string
  package: PackageId
  entitlements: Entitlements
  balances: Record<BalanceKey, Balance>
}

export interface AddOnOffer {
  id: AddOnId
  unit: Unit
  /** The price of one unit now, and what it was before (or will be after) the change. */
  price: number
  base: number
  /** The day the price changes, "YYYY-MM-DD", and what it changes to. */
  changeOn: string
  changesTo: number
  eligible: PartyMember[]
}

export interface UpgradeOffer {
  guest: PersonaId
  name: string
  from: PackageId
  options: { to: Exclude<PackageId, 'none'>; price: number; changeOn: string; changesTo: number }[]
}

export interface PurchaseView {
  id: string
  kind: 'addOn' | 'upgrade'
  item: AddOnId | Exclude<PackageId, 'none'>
  guests: PersonaId[]
  /** Price paid for each unit, and how many units. */
  unit: number
  units: number
  total: number
  at: number
  methods: string[]
  status: 'active' | 'cancelled'
  /** Price protection: locked (the price has gone up since), dropped (it is lower now) or same; per unit and in all. */
  price: { state: PriceState; perUnit: number; total: number }
  /** Credit already given for a price drop. */
  credited: number
  canCancel: boolean
}

export interface PackagesView {
  addOns: AddOnOffer[]
  upgrades: UpgradeOffer[]
  purchases: PurchaseView[]
  people: PersonEntitlements[]
  credit: Pooled
  party: PartyMember[]
  daysToDeparture: number
  canBuy: boolean
}

export type BuyInput = { kind: 'addOn'; item: AddOnId; guests: PersonaId[] } | { kind: 'upgrade'; to: Exclude<PackageId, 'none'>; guests: PersonaId[] }

export interface PlanOverview {
  days: PlanDay[]
  daysToDeparture: number
  departure: string
}

export interface ChecklistView {
  entries: ChecklistEntry[]
  milestones: Milestone[]
  progress: { done: number; total: number }
  next: ChecklistEntry | null
  daysToDeparture: number
}

export interface PackingView {
  items: PackItem[]
  ticked: string[]
  weather: Weather
  nights: number
  daysToDeparture: number
}

export interface TravelView {
  plan: TravelPlan
  windows: ArrivalWindow[]
  priority: boolean
  suggested: string
  canEdit: boolean
}

export interface AssistRequest {
  id: string
  kind: AssistId
  guest: PersonaId
  note: string
  at: number
  status: RequestStatus
}

export interface AssistanceView {
  deadlines: { kind: AssistId; deadline: Deadline }[]
  requests: AssistRequest[]
  party: PartyMember[]
  canRequest: boolean
  daysToDeparture: number
  /** Needs already in each guest's profile. */
  needs: Partial<Record<PersonaId, NeedId[]>>
}

export interface PlanApi {
  overview(): Promise<PlanOverview>
  excursions: {
    list(): Promise<ExcursionsView>
    /** Rejects `conflict` with a message: `soldOut`, `overlap`, `timing`, `age`, `closed`, `inCart`; `invalid` for an unknown tour or guest. */
    addToCart(excursionId: string, guests: PersonaId[]): Promise<ExcursionsView>
    removeFromCart(excursionId: string): Promise<ExcursionsView>
    /** Books everything in the cart. The excursion credit is used first; the rest is paid as `parts`. Rejects as `booking.book` does for payment problems. */
    checkout(parts: PaymentPart[], challenge?: string): Promise<ExcursionsView>
    /** Changes who is on a booked tour (at least one guest stays). */
    changeGuests(bookingId: string, guests: PersonaId[]): Promise<ExcursionsView>
    cancel(bookingId: string): Promise<ExcursionsView>
  }
  dining: {
    view(): Promise<DiningView>
    /** The table grid for a restaurant on a night. */
    slots(venueId: string, day: number): Promise<Slot[]>
    /** Rejects `forbidden` (supervised), `conflict` with `notOpen`, `full` or `clash`, `invalid` for a bad venue, night, time or party. */
    reserve(input: { venueId: string; day: number; time: string; guests: PersonaId[]; note: string }): Promise<DiningView>
    cancel(id: string): Promise<DiningView>
  }
  packages: {
    view(): Promise<PackagesView>
    /** Rejects `invalid` for a guest who is not eligible, `conflict` when it is already held, payment errors as `booking.book`. */
    buy(input: BuyInput, parts: PaymentPart[], challenge?: string): Promise<PackagesView>
    /** Takes the credit owed after a price drop (PRE-17). */
    claimDrop(purchaseId: string): Promise<PackagesView>
    cancel(purchaseId: string): Promise<PackagesView>
  }
  checklist: { get(): Promise<ChecklistView>; tick(id: string, done: boolean): Promise<ChecklistView> }
  packing: { get(): Promise<PackingView>; tick(id: string, done: boolean): Promise<PackingView> }
  travel: { get(): Promise<TravelView>; save(plan: TravelPlan): Promise<TravelView> }
  assistance: {
    get(): Promise<AssistanceView>
    request(input: { kind: AssistId; guest: PersonaId; note: string }): Promise<AssistanceView>
    cancel(id: string): Promise<AssistanceView>
  }
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
  booking: {
    /** Every sailing, with whether it can still be booked. */
    dates(): Promise<BookableSailing[]>
    rooms(sailingId: string): Promise<RoomOption[]>
    /** Sample staterooms for a room type with which are free; rejects `invalid` for an unknown sailing or room type. */
    cabins(sailingId: string, category: CategoryId): Promise<Cabin[]>
    fares(draft: Draft): Promise<FareOption[]>
    quote(draft: Draft): Promise<QuoteView>
    prefill(): Promise<PrefillView>
    /** The saved draft, or null. */
    draft(): Promise<Draft | null>
    saveDraft(draft: Draft): Promise<Draft>
    discardDraft(): Promise<void>
    /** Sends a link back to the draft by email or text; rejects `invalid` for an unusable address or number, `notFound` when nothing is saved. */
    sendResumeLink(via: 'email' | 'sms', to: string): Promise<ResumeSent>
    /**
     * Books and charges. Rejects `invalid` (incomplete answers or bad payment), `conflict` (message `priceChanged`,
     * `cabinTaken` or `closed`), `challenge` (the bank's code is missing or wrong) or `declined`. Booking the same draft twice returns the first booking.
     */
    book(input: BookInput): Promise<BookingView>
    get(number: string): Promise<BookingView>
    /** Pays the rest of the balance; rejects `conflict` when nothing is owed. */
    payBalance(number: string, parts: PaymentPart[], challenge?: string): Promise<BookingView>
    changePreview(number: string, sailingId: string): Promise<ChangePreview>
    change(number: string, sailingId: string): Promise<BookingView>
    cancel(number: string): Promise<BookingView>
  }
  plan: PlanApi
  help: { contacts(): Promise<{ guestServices: string; emergency: string }> }
}
