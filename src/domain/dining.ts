import type { Cents } from './money'
import type { Entitlements } from './entitlements'
import type { PaymentState } from './trip'
import type { PersonaId } from './people'
import { limit } from './limits'

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

const AUTHORED_VENUES: readonly Venue[] = []

/** The live list (see `EXCURSIONS`): the authored rooms until the server's catalogue arrives (`replaceVenues`), then the server's, replaced in place so every importer sees it. */
const live: Venue[] = AUTHORED_VENUES.map((v) => ({ ...v }))
export const VENUES: readonly Venue[] = live
/** Swaps in the server's rooms, with their deck, cuisine, dress code and menu; an empty list is ignored. `null` goes back to the authored copy. */
export function replaceVenues(next: readonly Venue[] | null): void {
  const list = next ?? AUTHORED_VENUES
  if (list.length > 0) live.splice(0, live.length, ...list.map((v) => ({ ...v })))
}

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

/** Dinner nights a reservation can be made for: embarkation evening to the last night, whatever the length of the sailing (`days` is the sailing's day count). */
export const dinnerDays = (days: number): number[] => Array.from({ length: Math.max(0, days - 1) }, (_, i) => i + 1)
/** Dinner times offered, 5:30 pm to 8:30 pm. */
export const DINNER_TIMES: readonly string[] = ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30']

/** The most people at one table. */
export let MAX_PARTY = 8

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
export let SITTING_MINUTES = 120

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

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('MAX_PARTY', (v) => { MAX_PARTY = v }, MAX_PARTY)
limit('SITTING_MINUTES', (v) => { SITTING_MINUTES = v }, SITTING_MINUTES)
