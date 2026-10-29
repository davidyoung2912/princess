import { PERSONAS, personaById, type PersonaId, type StateroomKind } from './personas'
import { quote, type Cents } from './pricing'
import { sailingById } from './sailings'
import type { CategoryId } from './ship'

/** Days between two "YYYY-MM-DD" dates (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
  return Math.round((ms(to) - ms(from)) / 86_400_000)
}

/** The room type a stateroom is priced as. */
export const categoryOfStateroom = (kind: StateroomKind): CategoryId =>
  kind === 'interior' ? 'interior' : kind === 'oceanview' ? 'oceanview' : kind === 'miniSuite' ? 'miniSuite' : 'balcony'

/** A stable, made-up booking number for a booker, such as "PC482113". */
export function bookingNumber(booker: PersonaId): string {
  const i = PERSONAS.findIndex((p) => p.id === booker)
  return `PC${String(100_000 + ((i + 1) * 7919) % 900_000).padStart(6, '0')}`
}

/** Booking numbers are letters and digits only; people type spaces and lower case. */
export const normalizeBookingNumber = (text: string): string => text.replace(/[\s-]/g, '').toUpperCase()

export const DEFAULT_FINAL_PAYMENT_DAYS = 90
/** Guests who booked late pay in full closer to sailing. */
const LATE_BOOKERS: Partial<Record<PersonaId, number>> = { maria: 10, marcus: 10 }
/** Late bookers have not paid by default; everyone else has paid by the due date. */
export const paysLate = (booker: PersonaId): boolean => booker in LATE_BOOKERS
export const finalPaymentDays = (booker: PersonaId): number => LATE_BOOKERS[booker] ?? DEFAULT_FINAL_PAYMENT_DAYS

export const DEPOSIT_SHARE = 0.2

export interface PaymentPlan {
  total: Cents
  deposit: Cents
  balance: Cents
  /** Date the balance is due, "YYYY-MM-DD". */
  finalDue: string
  /** Date the deposit was paid. */
  booked: string
}

const addDaysTo = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/** Deposit at booking (a fifth, in whole dollars) and the balance due before sailing. */
export function paymentPlan(total: Cents, departure: string, finalDays: number): PaymentPlan {
  const deposit = Math.min(total, Math.round((total * DEPOSIT_SHARE) / 100) * 100)
  return { total, deposit, balance: total - deposit, finalDue: addDaysTo(departure, -finalDays), booked: addDaysTo(departure, -(finalDays + 60)) }
}

export type PaymentState = 'paid' | 'upcoming' | 'dueSoon' | 'overdue'
export const DUE_SOON_DAYS = 30

export function paymentState(plan: PaymentPlan, balancePaid: boolean, today: string): PaymentState {
  if (balancePaid || plan.balance === 0) return 'paid'
  const left = daysBetween(today, plan.finalDue)
  return left < 0 ? 'overdue' : left <= DUE_SOON_DAYS ? 'dueSoon' : 'upcoming'
}

/** A past sailing, shown in My Trips. */
export interface PastTrip { id: string; title: string; ship: string; departure: string; nights: number; /** A booking that was cancelled before sailing. */ cancelled?: boolean }

const PAST: Partial<Record<PersonaId, readonly PastTrip[]>> = {
  gerald: [
    { id: 'past-gerald-1', title: 'Alaska Inside Passage', ship: 'Discovery Princess', departure: '2024-06-09', nights: 7 },
    { id: 'past-gerald-2', title: 'Panama Canal', ship: 'Emerald Princess', departure: '2023-01-14', nights: 10 },
    { id: 'past-gerald-3', title: 'Eastern Caribbean', ship: 'Caribbean Princess', departure: '2019-11-03', nights: 7 },
  ],
  linda: [{ id: 'past-linda-1', title: 'Mexican Riviera', ship: 'Royal Princess', departure: '2025-02-16', nights: 7 }],
  alexander: [
    { id: 'past-alexander-1', title: 'Mediterranean', ship: 'Sky Princess', departure: '2025-09-07', nights: 10 },
    { id: 'past-alexander-2', title: 'Hawaii', ship: 'Star Princess', departure: '2024-03-02', nights: 14 },
  ],
  daniel: [{ id: 'past-daniel-1', title: 'Bahamas', ship: 'Regal Princess', departure: '2025-06-22', nights: 4 }],
}

/** Trips already sailed by the person's booking (a family shares the booker's). */
export const pastTrips = (persona: PersonaId): readonly PastTrip[] => PAST[personaById(persona)?.booker ?? persona] ?? []

/** A booking made through a travel agent, which a guest can link to their account (ACT-02). */
export interface AgentBooking { number: string; lastName: string; sailingId: string; category: CategoryId; guests: number; agent: string }

export const AGENT_BOOKINGS: readonly AgentBooking[] = [
  { number: 'AG4K72Q', lastName: 'Whitfield', sailingId: 'sun-2027-03-21', category: 'balcony', guests: 2, agent: 'Harbour Travel' },
  { number: 'AG9M18T', lastName: 'Delgado', sailingId: 'sun-2027-03-21', category: 'oceanview', guests: 3, agent: 'Sunrise Cruises & Tours' },
]

export type LinkResult = { ok: true; booking: AgentBooking } | { ok: false; reason: 'format' | 'noMatch' | 'alreadyLinked' }

/** Checks booking number, last name and departure date together; the same answer for any mismatch, so a stranger learns nothing. */
export function matchBooking(number: string, lastName: string, departure: string, already: readonly string[]): LinkResult {
  const n = normalizeBookingNumber(number)
  if (!/^[A-Z0-9]{6,8}$/.test(n) || !lastName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(departure)) return { ok: false, reason: 'format' }
  const hit = AGENT_BOOKINGS.find((b) => b.number === n && b.lastName.toLowerCase() === lastName.trim().toLowerCase() && sailingById(b.sailingId)?.departure === departure)
  if (!hit) return { ok: false, reason: 'noMatch' }
  return already.includes(hit.number) ? { ok: false, reason: 'alreadyLinked' } : { ok: true, booking: hit }
}

/** The all-in price of a booking, from the same estimate the Discover screens use. */
export const bookingTotal = (sailingId: string, category: CategoryId, guests: number): Cents => quote(sailingId, category, guests)?.total ?? 0

export type NextActionId = 'payOverdue' | 'documents' | 'payDue' | 'checkin' | 'allSet'
export interface NextActionInput { payment: PaymentState; documentsMissing: number; checkinOpen: boolean; checkinDone: boolean }

/** The one thing to do next (MNG-02): money owed first, then paperwork, then check-in. */
export function nextAction(i: NextActionInput): NextActionId {
  if (i.payment === 'overdue') return 'payOverdue'
  if (i.documentsMissing > 0) return 'documents'
  if (i.payment === 'dueSoon') return 'payDue'
  if (i.checkinOpen && !i.checkinDone) return 'checkin'
  return 'allSet'
}
