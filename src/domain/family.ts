import type { PersonaId } from './personas'
import { placeById } from './deck'

/**
 * Finding the family and the children's clubs (SAF-05, ENT-04). A web page cannot tell where anyone is on the ship, so
 * a child's place here comes from the club's check-in or from the children's band (simulated in this concept).
 * Ages, hours and places are authored concept values (verify before real use).
 */
export type ClubId = 'firefly' | 'neon-grove' | 'underground'

export interface Club {
  id: ClubId
  name: string
  placeId: string
  /** Inclusive ages. */
  minAge: number
  maxAge: number
  /** Ship time, "HH:MM". */
  opens: string
  closes: string
  /** The age from which a child may sign themselves out, if a parent allows it. */
  aloneFrom: number | null
}

export const CLUBS: readonly Club[] = [
  { id: 'firefly', name: 'Firefly Park', placeId: 'firefly', minAge: 3, maxAge: 7, opens: '09:00', closes: '21:00', aloneFrom: null },
  { id: 'neon-grove', name: 'Neon Grove', placeId: 'neon-grove', minAge: 8, maxAge: 12, opens: '09:00', closes: '22:00', aloneFrom: 10 },
  { id: 'underground', name: 'The Underground', placeId: 'underground', minAge: 13, maxAge: 17, opens: '11:00', closes: '23:59', aloneFrom: 13 },
]

export const clubById = (id: unknown): Club | undefined => CLUBS.find((c) => c.id === id)

/** The club for a child's age, or undefined (under 3, or an adult). */
export const clubFor = (age: number): Club | undefined => CLUBS.find((c) => age >= c.minAge && age <= c.maxAge)

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

/** Whether the club is open at a ship-time "HH:MM". */
export const clubOpen = (c: Club, time: string): boolean => mins(time) >= mins(c.opens) && mins(time) < mins(c.closes)

export type ClubProblem = 'tooYoung' | 'tooOld' | 'closed' | 'alreadyIn' | 'notRegistered'

/** Why a child cannot be checked in to a club now, or null. */
export function checkInProblem(club: Club, age: number, time: string, alreadyIn: boolean): ClubProblem | null {
  if (age < club.minAge) return 'tooYoung'
  if (age > club.maxAge) return 'tooOld'
  if (alreadyIn) return 'alreadyIn'
  if (!clubOpen(club, time)) return 'closed'
  return null
}

/** Places a parent can allow a child to be (the club for the age is always included). */
export const KID_ZONES: readonly string[] = ['firefly', 'neon-grove', 'underground', 'lido-pool', 'piazza', 'arena', 'dome', 'promenade', 'eatery', 'americana', 'lido', 'shops', 'intl-cafe']

/** Where a child may go before a parent changes it. */
export function defaultZones(age: number): string[] {
  if (age < 8) return ['firefly', 'lido-pool', 'americana', 'eatery']
  if (age < 13) return ['neon-grove', 'lido-pool', 'piazza', 'promenade', 'dome', 'lido', 'americana', 'eatery']
  return [...KID_ZONES]
}

/** The places a child tends to be through the day when not at a club, by age band; some are outside the default zones on purpose, so the alert can be seen. */
const ROTATION: Record<'small' | 'middle' | 'teen', readonly string[]> = {
  small: ['lido-pool', 'americana', 'lido-pool', 'eatery', 'lido-pool', 'shops'],
  middle: ['lido-pool', 'piazza', 'promenade', 'arena', 'dome', 'lido', 'casino'],
  teen: ['lido-pool', 'piazza', 'promenade', 'shops', 'sea-view', 'underground', 'arena'],
}

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export const bandOf = (age: number): 'small' | 'middle' | 'teen' => (age < 8 ? 'small' : age < 13 ? 'middle' : 'teen')

/** A fifteen-minute bucket on the clock, so a child's place changes through the day but stays put within a quarter hour. */
const bucket = (now: number): number => Math.floor(now / (15 * 60_000))

export interface Seen { placeId: string; at: number; source: 'club' | 'band' }

/** Where a child was last seen. In the missing-child scenario the youngest child's band last reported a while ago. */
export function lastSeen(child: PersonaId, age: number, now: number, club: { clubId: ClubId; at: number } | null, missing: boolean): Seen {
  if (club) return { placeId: clubById(club.clubId)!.placeId, at: club.at, source: 'club' }
  if (missing) return { placeId: 'lido-pool', at: now - OVERDUE_MINUTES * 60_000 - 15 * 60_000, source: 'band' }
  const rotation = ROTATION[bandOf(age)]
  const b = bucket(now)
  return { placeId: rotation[(hash(child) + b) % rotation.length], at: Math.max(b * 15 * 60_000, now - (hash(`${child}${b}`) % 10) * 60_000), source: 'band' }
}

/** Not heard from for this long, a parent is told to act. */
export const OVERDUE_MINUTES = 30

export type KidStatus = 'inClub' | 'inZone' | 'outOfZone' | 'overdue'

export function kidStatus(seen: Seen, zones: readonly string[], now: number): KidStatus {
  if (now - seen.at >= OVERDUE_MINUTES * 60_000) return 'overdue'
  if (seen.source === 'club') return 'inClub'
  return zones.includes(seen.placeId) ? 'inZone' : 'outOfZone'
}

export interface Authorisation {
  /** Adults who may collect the child. */
  pickup: PersonaId[]
  /** The child may sign out alone (only from the club's age for that). */
  signOutAlone: boolean
  /** Club staff may take photos. */
  photos: boolean
}

/** A form read back from the store, or the default: every adult on the booking may collect. */
export function normalizeAuth(raw: unknown, adults: readonly PersonaId[]): Authorisation {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const pickup = Array.isArray(o.pickup) ? o.pickup.filter((p): p is PersonaId => adults.includes(p as PersonaId)) : adults.slice()
  return { pickup, signOutAlone: o.signOutAlone === true, photos: o.photos === true }
}

export interface ReunionPlan { placeId: string; backupId: string; note: string }

export const DEFAULT_REUNION: ReunionPlan = { placeId: 'guest-services', backupId: 'piazza', note: '' }

/** Places a family can pick to meet: easy to find and always staffed or central. */
export const MEETING_PLACES: readonly string[] = ['guest-services', 'piazza', 'lido-pool', 'eatery', 'promenade', 'excursions-desk']

export function normalizeReunion(raw: unknown): ReunionPlan {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ok = (v: unknown, d: string) => (typeof v === 'string' && MEETING_PLACES.includes(v) ? v : d)
  return { placeId: ok(o.placeId, DEFAULT_REUNION.placeId), backupId: ok(o.backupId, DEFAULT_REUNION.backupId), note: typeof o.note === 'string' ? o.note.slice(0, 200) : '' }
}

export const placeName = (id: string): string => (id === 'cabin' ? 'Stateroom' : (placeById(id)?.name ?? id))
