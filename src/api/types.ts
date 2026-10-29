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
import type { EmergencyContact } from '../domain/account'
import type { CheckinProgress, DocumentKind, GuestCheckin, GuestProgress, PhotoMetrics, StepId } from '../domain/checkin'
import type { AfternoonId, CarryOnId, CompanionId, LuggageStatus, Terminal, Traffic } from '../domain/boarding'
import type { AboardState, PortDay, TenderView } from '../domain/allaboard'
import type { ChannelId, ChatState } from '../domain/chat'
import type { Choice, Location, Morning, OrderInput, OrderKind, PricedLine, Stage } from '../domain/orders'
import type { Authorisation, ClubId, KidStatus, ReunionPlan, Seen } from '../domain/family'
import type { DayType, RequestKind, Symptom } from '../domain/health'
import type { Amenity, Devices, Housekeeping } from '../domain/room'
import type { OptionId, Photo, PhotoOption, PhotographerSlot } from '../domain/photos'
import type { LaundryService, LaundryStage, PickupOption } from '../domain/laundry'
import type { StoredDevice, WifiPlan } from '../domain/wifi'
import type { DatedEvent } from '../domain/program'
import type { EmergencyCard } from '../domain/safety'
import type { FolioLine, FolioTotals } from '../domain/folio'

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
  state: 'notOpen' | 'open' | 'closed' | 'done'
  /** When online check-in opens (three days before departure). */
  opensAt: number
  /** When it closes (10:00 on sailing day); the terminal desk takes over after that. */
  closesAt: number
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
  /** People who have read it, when both they and the sender have read receipts on. */
  seenBy?: PersonaId[]
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
  /** Minutes the party said they would be late, or 0. */
  lateMinutes: number
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
    /**
     * Moves a reservation to another night or time (DIN-10). The original is held until the new table is confirmed; any failure
     * leaves the original as it was. Rejects `conflict` with `full`, `clash`, `closed`, `unchanged`, `invalid` for a bad night or time.
     */
    move(id: string, to: { day: number; time: string }): Promise<DiningView>
    /** Tells the restaurant the party will be late; the table is held for that long (up to 30 minutes). */
    late(id: string, minutes: number): Promise<DiningView>
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

export interface CheckinGuestView {
  id: PersonaId
  name: string
  first: string
  age: number
  child: boolean
  citizenship: Citizenship
  record: GuestCheckin
  progress: GuestProgress
  /** What the app already knows, so nothing is typed twice. */
  defaults: { emergency: EmergencyContact; documentKind: DocumentKind; passportExpires: string }
}

export interface CheckinView {
  status: CheckinStatus
  guests: CheckinGuestView[]
  payment: { cardId: string; label: string; at: number } | null
  arrival: string | null
  cards: Card[]
  windows: ArrivalWindow[]
  priority: boolean
  suggested: string
  progress: CheckinProgress
  returnDate: string
  /** False for a supervised child account, or once check-in has closed. */
  canEdit: boolean
  /** When the guest finished check-in, if they have. */
  finishedAt: number | null
}

export type CheckinSave =
  | { step: 'confirm'; guests: PersonaId[] }
  | { step: 'document'; guest: PersonaId; kind: DocumentKind; country: string; number: string; expires: string }
  | { step: 'photo'; guest: PersonaId; metrics: PhotoMetrics }
  | { step: 'emergency'; guests: PersonaId[]; name: string; phone: string; relationship: string }
  | { step: 'contract'; guests: PersonaId[] }
  | { step: 'health'; guest: PersonaId; answers: Record<string, boolean> }
  | { step: 'payment'; cardId: string }
  | { step: 'arrival'; window: string }

/** One line of the "what we have on file" receipt (CHK-13). */
export interface ReceiptItem {
  step: StepId
  /** What was saved, in words, never the whole number: "Passport ending 4821". */
  detail: string | null
  savedAt: number | null
}

export interface ReceiptView {
  number: string
  guests: { id: PersonaId; name: string; items: ReceiptItem[] }[]
  booking: ReceiptItem[]
  complete: boolean
  finishedAt: number | null
}

export interface GuestPass {
  id: PersonaId
  name: string
  /** Printed name, "WHITFIELD/GERALD". */
  printed: string
  seq: number
  ready: boolean
  /** The text inside the QR code. */
  code: string
  cabin: string
  deck: number
  muster: string
  group: string
}

export interface BoardingView {
  number: string
  departure: string
  checkinDone: boolean
  lane: 'green' | 'blue'
  terminal: Terminal
  arrival: ArrivalWindow | null
  waitMinutes: number | null
  passes: GuestPass[]
  inWallet: boolean
  /** When this copy was made. */
  issuedAt: number
}

export interface EmbarkView {
  boarding: BoardingView
  opensAt: number
  gangwayClosesAt: number
  stateroomReadyAt: number
  stateroomReady: boolean
  traffic: Traffic | null
  luggage: { status: LuggageStatus; droppedAt: number | null }
  carryOn: { id: CarryOnId; done: boolean }[]
  companion: { id: CompanionId; done: boolean }[]
  current: CompanionId | null
  documents: { id: PersonaId; name: string; ready: boolean }[]
  afternoon: { id: AfternoonId; at: number }[]
  /** Anyone's health answer that will be passed to the terminal nurse. */
  nurseCheck: string[]
  canEdit: boolean
}

export interface Api {
  auth: { me(): Promise<Identity> }
  bookings: { get(): Promise<Booking>; sailings(): Promise<Sailing[]> }
  checkin: {
    status(): Promise<CheckinStatus>
    /** Finishes check-in; rejects `conflict` (message `notOpen`, `closed` or `incomplete`). */
    submit(): Promise<CheckinStatus>
    view(): Promise<CheckinView>
    /** Saves one step; rejects `invalid` (message is a problem code the screen explains), `conflict` (`notOpen`, `closed`) or `forbidden` for a child account. */
    save(input: CheckinSave): Promise<CheckinView>
    receipt(): Promise<ReceiptView>
  }
  boarding: {
    /** The signed-in booking's passes. */
    pass(): Promise<BoardingView>
    /** A pass by booking number and a guest's last name, with no sign-in; rejects `notFound` for any mismatch. */
    lookup(number: string, lastName: string): Promise<BoardingView>
    addToWallet(): Promise<BoardingView>
    embark(): Promise<EmbarkView>
    setCompanion(step: CompanionId, done: boolean): Promise<EmbarkView>
    setCarryOn(item: CarryOnId, done: boolean): Promise<EmbarkView>
    setBags(dropped: boolean): Promise<EmbarkView>
  }
  dining: { list(): Promise<Item[]>; reschedule(id: string, to: string): Promise<Item> }
  queues: { list(): Promise<Item[]> }
  orders: OrdersApi
  messages: {
    list(): Promise<Message[]>
    send(text: string): Promise<Message>
    /** Whether the signed-in person shows and sees read receipts. */
    receipts(): Promise<boolean>
    setReceipts(on: boolean): Promise<boolean>
    /** Marks the chat as read now (only recorded when receipts are on). */
    markSeen(): Promise<void>
  }
  photos: PhotosApi
  family: FamilyApi
  health: HealthApi
  room: RoomApi
  laundry: LaundryApi
  wifi: WifiApi
  folio: { entitlements(): Promise<{ entitlements: Entitlements; balances: Record<BalanceKey, Balance> }> }
  requests: { list(): Promise<Item[]>; create(kind: string, note: string): Promise<Item> }
  ports: { today(): Promise<PortToday> }
  onboard: OnboardApi
  service: ServiceApi
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

// ---- Onboard core (Phase 6) ----

export interface WeatherToday {
  summary: string
  highF: number
  lowF: number
  /** "Light breeze, calm sea." */
  sea: string
}

export interface MusterGuest { id: PersonaId; name: string; confirmedAt: number | null }

export interface MusterView {
  /** Drill time, ship epoch. */
  at: number
  /** True until every guest has checked in or the sailing has left on day 1. */
  required: boolean
  done: boolean
  station: string
  stationName: string
  stationPlace: string
  deck: number
  guests: MusterGuest[]
  canConfirm: boolean
}

export interface OnboardToday {
  /** The guest is aboard: embarkation day to the morning of arrival. */
  aboard: boolean
  day: number | null
  date: string
  port: PortId
  shipZone: string
  weather: WeatherToday | null
  /** The next port day (or today's), with the all-aboard countdown; null when none is left. */
  portDay: (PortDay & { state: AboardState }) | null
  muster: { required: boolean; done: boolean; at: number }
  /** The sail-away moment on day 1, or null after. */
  sailAwayAt: number | null
  /** Today's changes to the programme are on (the scenario). */
  changes: boolean
  /** The ship's clock moves tonight: hours and the moment, or null. */
  clockChange: { at: number; hours: number } | null
}

export interface ProgramView {
  day: number
  date: string
  port: PortId
  events: DatedEvent[]
  /** Ids of events in the signed-in person's plan. */
  mine: string[]
  changed: boolean
  canEdit: boolean
}

export interface TourToday {
  id: string
  excursionId: string
  name: string
  meeting: string
  /** Local start time, "HH:MM". */
  start: string
  backBy: string
  guests: { id: PersonaId; name: string; code: string }[]
  tender: boolean
}

export interface TenderInfo extends TenderView {
  mayTender: boolean
  assistance: boolean
}

export interface PortDayView {
  day: PortDay & { state: AboardState }
  tender: TenderInfo | null
  tours: TourToday[]
  /** Minutes the day's tender operation is late (the Belize scenario), 0 otherwise. */
  delayMinutes: number
  /** The port is not being visited as planned. */
  skipped: boolean
}

export interface FolioView {
  lines: FolioLine[]
  totals: FolioTotals
  guests: { id: PersonaId; name: string }[]
  throughDay: number
}

export interface OnboardApi {
  today(): Promise<OnboardToday>
  program(day: number): Promise<ProgramView>
  /** Adds or removes an event from the signed-in person's plan; rejects `forbidden` for a supervised account, `invalid` for an unknown event. */
  togglePlan(eventId: string, on: boolean): Promise<string[]>
  portDay(): Promise<PortDayView | null>
  muster(): Promise<MusterView>
  /** Checks guests in at the muster station; rejects `forbidden` for someone outside the booking. */
  confirmMuster(guests: PersonaId[]): Promise<MusterView>
  emergency(): Promise<EmergencyCard>
  folio(): Promise<FolioView>
}

export interface ServiceChannelView {
  id: ChannelId
  /** Typical minutes to a first reply right now (longer when chat is slow). */
  minutes: number
  slow: boolean
  unanswered: boolean
}

export interface ServiceMessage {
  id: string
  from: 'me' | 'crew'
  crew?: string
  text: string
  at: number
}

export interface ServiceThread {
  channel: ChannelId
  messages: ServiceMessage[]
  state: ChatState | null
  slow: boolean
}

export interface ServiceApi {
  channels(): Promise<ServiceChannelView[]>
  thread(channel: ChannelId): Promise<ServiceThread>
  /** Rejects `invalid` for an empty message or unknown channel. */
  send(channel: ChannelId, text: string): Promise<ServiceThread>
  /** Asks for a phone call instead of waiting; rejects `invalid` for a bad number. */
  escalate(channel: ChannelId, phone: string): Promise<ServiceThread>
}

// ---- Phase 7: onboard extended ----

export interface OrderGuest { id: PersonaId; name: string; age: number; drinkCapUsd: number }

export interface OrderMenuView {
  /** Ordering is open from embarkation to the last evening. */
  open: boolean
  /** Items the kitchen has run out of before checkout. */
  outOfStock: string[]
  guests: OrderGuest[]
  cabin: string
  deck: number
  mornings: Morning[]
  /** A guest on the booking is isolating for illness: meals and delivery are free. */
  isolating: boolean
  canOrder: boolean
}

export interface OrderView {
  id: string
  kind: OrderKind
  placedAt: number
  deliverAt: number | null
  location: Location
  tip: number
  stage: Stage
  etaAt: number | null
  lines: PricedLine[]
  fee: number
  service: number
  total: number
  covered: number
  /** Indices of lines that ran out and wait for a choice. */
  unavailable: number[]
  /** What is owed back after a cancellation. */
  refund: number
  canCancel: boolean
  canMove: boolean
  /** Times the guest asked Guest Services about this order. */
  contacted: number
  free: boolean
}

export interface OrdersApi {
  menu(): Promise<OrderMenuView>
  list(): Promise<OrderView[]>
  /** Rejects `invalid` (a problem code), `conflict` (`unavailable`, `closed`, `duplicate`), or `forbidden` for a supervised account. */
  place(input: OrderInput): Promise<OrderView>
  /** Chooses, for each line that ran out, to swap it or remove it. */
  resolve(id: string, choices: Record<number, Choice>): Promise<OrderView>
  /** Rejects `conflict` (`tooLate`) once the kitchen has started. */
  cancel(id: string): Promise<OrderView>
  moveTo(id: string, location: Location): Promise<OrderView>
  contact(id: string): Promise<OrderView>
}

export interface FamilyKid {
  id: PersonaId
  name: string
  age: number
  club: { id: ClubId; name: string; open: boolean; opens: string; closes: string } | null
  inClub: { clubId: ClubId; at: number } | null
  seen: Seen
  status: KidStatus
  zones: string[]
  auth: Authorisation
  /** This account may check the child out (a listed adult, or the child where allowed). */
  canCheckOut: boolean
}

export interface FamilyLogEntry { id: string; at: number; text: string }

export interface FamilyView {
  kids: FamilyKid[]
  adults: { id: PersonaId; name: string }[]
  reunion: ReunionPlan
  log: FamilyLogEntry[]
  canEdit: boolean
}

export interface FamilyApi {
  view(): Promise<FamilyView>
  setZones(child: PersonaId, zones: string[]): Promise<FamilyView>
  setAuth(child: PersonaId, auth: Authorisation): Promise<FamilyView>
  /** Rejects `invalid` (`tooYoung`, `tooOld`, `alreadyIn`, `closed`) or `forbidden`. */
  checkIn(child: PersonaId): Promise<FamilyView>
  checkOut(child: PersonaId): Promise<FamilyView>
  setReunion(plan: ReunionPlan): Promise<FamilyView>
}

export interface HealthReport { id: string; at: number; guests: string[]; symptoms: Symptom[]; startedHoursAgo: number }
export interface HealthRequest { id: string; at: number; kind: RequestKind; note: string }

export interface HealthView {
  day: DayType
  /** Medical Center open at this moment, and the next opening if not. */
  open: boolean
  nextOpen: string | null
  /** An illness notice for the ship (the illness scenario). */
  notice: boolean
  isolating: boolean
  reports: HealthReport[]
  requests: HealthRequest[]
  guests: { id: PersonaId; name: string }[]
}

export interface HealthApi {
  view(): Promise<HealthView>
  /** Rejects `invalid` with a problem code, `forbidden` for someone outside the booking. */
  report(input: { guests: PersonaId[]; symptoms: Symptom[]; startedHoursAgo: number }): Promise<HealthView>
  request(kind: RequestKind, note: string): Promise<HealthView>
}

export interface RoomView {
  number: string
  deck: number
  steward: string
  amenities: Amenity[]
  muster: string
  hasView: boolean
  housekeeping: Housekeeping
  devices: Devices
  /** Do Not Disturb has been on long enough that the steward will check. */
  checkDue: boolean
  canEdit: boolean
}

export interface RoomApi {
  view(): Promise<RoomView>
  setHousekeeping(patch: Partial<Housekeeping>): Promise<RoomView>
  setDevices(patch: Partial<Devices>): Promise<RoomView>
}

export interface PhotoReceipt {
  id: string
  at: number
  option: OptionId | 'included'
  photoIds: string[]
  paid: number
  saved: number
  verified: boolean
  until: number
}

export interface PhotosView {
  photos: Photo[]
  favourites: string[]
  owned: string[]
  receipts: PhotoReceipt[]
  includedLeft: number
  schedule: PhotographerSlot[]
  people: { id: PersonaId; name: string }[]
  throughDay: number
}

export interface PhotoQuote { included: number; paid: number; options: PhotoOption[]; cheapest: OptionId }

export interface PhotosApi {
  list(): Promise<PhotosView>
  toggleFavourite(photoId: string): Promise<string[]>
  quote(photoIds: string[]): Promise<PhotoQuote>
  /** Rejects `invalid` (`empty`, `unknownPhoto`, `alreadyOwned`) or `forbidden`. */
  buy(photoIds: string[], option: OptionId): Promise<PhotoReceipt>
  /** Saves the next batch; keeps what earlier attempts saved. Rejects `network` once in the photo-failure scenario. */
  download(receiptId: string): Promise<PhotoReceipt>
}

export interface LaundryRequest {
  id: string
  service: LaundryService
  qty: number
  pickupAt: number
  returnAt: number
  stage: LaundryStage
  total: number
  free: number
  note: string
}

export interface LaundryView {
  requests: LaundryRequest[]
  pickups: Record<LaundryService, PickupOption[]>
  freeBagLeft: boolean
  canRequest: boolean
}

export interface LaundryApi {
  view(): Promise<LaundryView>
  request(input: { service: LaundryService; qty: number; pickupAt: number; note: string }): Promise<LaundryView>
  cancel(id: string): Promise<LaundryView>
}

export interface WifiDeviceView extends StoredDevice {
  usedMb: number
  capMb: number | null
  expiresAt: number
  expired: boolean
}

export interface WifiView {
  devices: WifiDeviceView[]
  includedLeft: number
  canBuy: boolean
}

export interface WifiApi {
  view(): Promise<WifiView>
  add(input: { name: string; plan: WifiPlan; days: number }): Promise<WifiView>
  upgrade(id: string, plan: WifiPlan): Promise<WifiView>
  remove(id: string): Promise<WifiView>
}
