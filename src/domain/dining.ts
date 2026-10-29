import type { Cents } from './pricing'
import type { Entitlements } from './entitlements'
import type { PaymentState } from './trip'
import type { PersonaId } from './personas'

/** Dining reservations before sailing (PRE-03, DIN-12). Venues follow the ship profile; cover charges and hours are authored. */
export type VenueKind = 'main' | 'specialty' | 'casual'
export type DressCode = 'casual' | 'smart' | 'elegant'

export interface Venue {
  id: string
  name: string
  kind: VenueKind
  deck: string
  cuisine: string
  /** Per person; 0 where the fare covers it. */
  cover: Cents
  dress: DressCode
  /** A line from the menu, as a taste. */
  menu: string
  /** The room cannot be reserved: it is walk-in, or has fixed seating. */
  walkIn?: boolean
}

export const VENUES: readonly Venue[] = [
  { id: 'eclipse', name: 'Eclipse Dining Room', kind: 'main', deck: 'Deck 7 aft', cuisine: 'Traditional three-course dinner', cover: 0, dress: 'smart', menu: 'Seared sea bass, braised short rib, a vegetarian tasting plate, and a different dessert every night.' },
  { id: 'crown', name: 'Crown Grill', kind: 'specialty', deck: 'Deck 7 aft', cuisine: 'Steakhouse', cover: 4500, dress: 'smart', menu: 'Aged filet, a shared seafood tower, creamed spinach and a warm chocolate soufflé.' },
  { id: 'sabatini', name: 'Sabatini’s', kind: 'specialty', deck: 'Deck 8 aft', cuisine: 'Italian trattoria', cover: 4200, dress: 'smart', menu: 'Hand-rolled pasta, veal Milanese, a tiramisu made at the table.' },
  { id: 'catch', name: 'The Catch by Rudi', kind: 'specialty', deck: 'Deck 7 midship', cuisine: 'Seafood', cover: 4800, dress: 'smart', menu: 'Lobster bisque, grilled catch of the day, and a key lime tart.' },
  { id: 'love', name: 'Love by Britto', kind: 'specialty', deck: 'Deck 17 aft', cuisine: 'Prix fixe with a wake view', cover: 6500, dress: 'elegant', menu: 'Five small courses, with wine pairings available, served as the sun sets behind the ship.' },
  { id: 'alfredo', name: 'Alfredo’s Pizzeria', kind: 'casual', deck: 'Deck 9 Piazza', cuisine: 'Neapolitan pizza', cover: 1499, dress: 'casual', menu: 'Margherita, diavola and a pizza of the day, with a dessert to share.', walkIn: true },
]

export const venueById = (id: unknown): Venue | undefined => VENUES.find((v) => v.id === id)

/** The rooms a guest can reserve ahead. */
export const reservable = (): Venue[] => VENUES.filter((v) => !v.walkIn)

/** How a guest's main dinner is arranged, chosen at booking (BOK-18). */
export type DiningPlan = 'anytime' | 'early' | 'late'

/** Fixed seatings in Soleil Dining Room, which assigns a table for the whole cruise. */
export const SEATINGS: Record<'early' | 'late', string> = { early: '17:00', late: '19:30' }

/** What each demo person chose when they booked. Gerald prefers traditional fixed seating. */
export const DINING_PLAN: Partial<Record<PersonaId, DiningPlan>> = { gerald: 'early' }
export const planOf = (id: PersonaId): DiningPlan => DINING_PLAN[id] ?? 'anytime'

/** Dinner nights a reservation can be made for (embarkation evening to the second-last night). */
export const DINNER_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7]
/** Dinner times offered, 5:30 pm to 8:30 pm. */
export const DINNER_TIMES: readonly string[] = ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30']

/** The most people at one table. */
export const MAX_PARTY = 8

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

export interface Slot {
  time: string
  /** Places left for a party; 0 is full. */
  tables: number
}

/** The grid for one venue on one night: the same every time for the same sailing. Peak times fill first. */
export function slotsFor(venueId: string, sailingId: string, day: number): Slot[] {
  return DINNER_TIMES.map((time) => {
    const h = hash(`${venueId}|${sailingId}|${day}|${time}`)
    const peak = time === '19:00' || time === '19:30'
    const full = peak ? h % 3 === 0 : h % 6 === 0
    return { time, tables: full ? 0 : 1 + (h % 4) }
  })
}

export interface Window {
  open: boolean
  /** Why it is not open yet. */
  reason?: 'awaitingPayment'
  /** When it opens: the final payment date, or on payment, whichever comes first. */
  opensOn?: string
}

/** Who may reserve now (DIN-12): Platinum and Elite guests from booking; everyone else once the cruise is paid in full. */
export function diningWindow(e: Pick<Entitlements, 'diningWindow'>, payment: PaymentState, finalDue: string): Window {
  if (e.diningWindow === 'atBooking' || payment === 'paid') return { open: true }
  return { open: false, reason: 'awaitingPayment', opensOn: finalDue }
}

export type MealCover = 'included' | 'cover'

/** How many of a party are covered by specialty dinners the package includes, and what the rest pay. Main dining and casual rooms are covered by the fare. */
export function mealCharge(v: Venue, partySize: number, mealsLeft: number): { covered: number; pays: number; charge: Cents } {
  if (v.kind !== 'specialty') return { covered: 0, pays: partySize, charge: v.kind === 'main' ? 0 : v.cover * partySize }
  const covered = Math.min(partySize, Math.max(0, mealsLeft))
  const pays = partySize - covered
  return { covered, pays, charge: pays * v.cover }
}

/** A reservation as far as clash checking cares. */
export interface ReservedTable { venueId: string; day: number; time: string; guests: string[] }

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
/** Dinner takes about two hours. */
export const SITTING_MINUTES = 120

/** Guests who would be at two tables at once on the same night. */
export function tableClash(existing: readonly ReservedTable[], day: number, time: string, guests: readonly string[], ignoreVenue?: string): string[] {
  const clash = new Set<string>()
  for (const r of existing) {
    if (r.day !== day || r.venueId === ignoreVenue) continue
    if (Math.abs(mins(r.time) - mins(time)) >= SITTING_MINUTES) continue
    for (const g of r.guests) if (guests.includes(g)) clash.add(g)
  }
  return [...clash]
}

export const DRESS_NOTES: Record<DressCode, string> = {
  casual: 'Come as you are, but no swimwear',
  smart: 'Smart casual: collared shirts or a nice top; no shorts or flip-flops at dinner',
  elegant: 'Elegant evening: a jacket or dress, to match the evening',
}
