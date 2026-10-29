import { cabinsFor, type Cabin } from './cabins'
import { arrivalWindows, type Window } from './travel'
import { PERSONAS, personaById, type PersonaId } from './personas'
import type { CategoryId } from './ship'
import { categoryOfStateroom } from './trip'
import { zonedToEpoch } from './timezones'

/** Boarding pass, embarkation day and the offline fallbacks (CHK-04, CHK-05, CHK-12, CHK-14, CHK-15). Times, places and rules are authored concept values (verify before real use). */
export const HOME_ZONE = 'America/New_York'

export const TERMINALS = { usual: 'Terminal 2', other: 'Terminal 4' } as const

export interface Terminal { name: string; /** Set when the terminal was changed, to the one it replaced. */ changedFrom?: string }

/** Terminal 2 is usual; operations can move a sailing to Terminal 4, which the guest is told about (CHK-15). */
export const terminalFor = (moved: boolean): Terminal => (moved ? { name: TERMINALS.other, changedFrom: TERMINALS.usual } : { name: TERMINALS.usual })

// ---- Stateroom, muster station, boarding group ----

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export interface Assignment { number: string; deck: number; accessible: boolean; muster: string }

const STATIONS = [['A', 'B'], ['C', 'D'], ['E', 'F']] as const
const POSITION_ROW = { forward: 0, midship: 1, aft: 2 } as const

/** The muster station follows where the stateroom is: front, middle or back of the ship, port or starboard side. */
export const musterStation = (c: Pick<Cabin, 'position' | 'side'>): string => `Station ${STATIONS[POSITION_ROW[c.position]][c.side === 'port' ? 0 : 1]}`

/** The stateroom for a booking: a stable pick from the free sample staterooms of its room type, a step-free one when the booker needs it. */
export function assignmentFor(booker: PersonaId, sailingId: string, needsStepFree: boolean): Assignment {
  const p = personaById(booker)!
  const category: CategoryId = categoryOfStateroom(p.stateroom)
  const free = cabinsFor(sailingId, category).filter((c) => c.available)
  const pool = needsStepFree && free.some((c) => c.accessible) ? free.filter((c) => c.accessible) : free.filter((c) => !c.accessible)
  const cabin = pool[hash(`${sailingId}|${booker}`) % pool.length] ?? free[0]
  return { number: cabin.number, deck: cabin.deck, accessible: cabin.accessible, muster: musterStation(cabin) }
}

/** Priority guests board first; everyone else boards by the arrival window they chose, so the group number follows it. */
export function boardingGroup(priority: boolean, window: string | null): string {
  if (priority) return 'Priority'
  if (!window) return 'Not set'
  const i = arrivalWindows(false).findIndex((w) => w.start === window)
  return i < 0 ? 'Not set' : `Group ${i + 1}`
}

/** Green lane when check-in is finished for everyone; Blue lane when documents must be checked at the desk (CHK-08). */
export const laneFor = (checkinDone: boolean): 'green' | 'blue' => (checkinDone ? 'green' : 'blue')

// ---- The pass and its QR code ----

export interface PassData { v: 1; booking: string; seq: number; name: string; departure: string; cabin: string; group: string }

const sign = (body: string): string => (hash(`pcp|${body}`) % 1_679_616).toString(36).padStart(4, '0')

/** The text inside a boarding pass QR code. The last part is a check value, so a misread or edited code is spotted. */
export function encodePass(p: PassData): string {
  const body = ['PCP1', p.booking, p.seq, p.name.toUpperCase().replace(/\|/g, ' '), p.departure, p.cabin, p.group.replace(/\|/g, ' ')].join('|')
  return `${body}|${sign(body)}`
}

export function decodePass(text: string): PassData | null {
  const parts = text.split('|')
  if (parts.length !== 8 || parts[0] !== 'PCP1') return null
  const body = parts.slice(0, 7).join('|')
  if (sign(body) !== parts[7]) return null
  const seq = Number(parts[2])
  if (!Number.isInteger(seq) || seq < 1) return null
  return { v: 1, booking: parts[1], seq, name: parts[3], departure: parts[4], cabin: parts[5], group: parts[6] }
}

/** The name as printed on a pass: "WHITFIELD/GERALD". */
export const passName = (first: string, last: string): string => `${last}/${first}`.toUpperCase()

// ---- Embarkation day (CHK-05, CHK-15) ----

export const EMBARK = {
  /** Terminal opens, ship local time. */
  terminalOpens: '11:00',
  priorityOpens: '10:30',
  /** Staterooms are ready from this time. */
  staterooms: '13:00',
  muster: '14:00',
  gangwayCloses: '13:30',
  sailAway: '15:00',
  address: '1850 Eller Drive, Fort Lauderdale, Florida',
  mapQuery: 'Port Everglades Cruise Terminal 2, 1850 Eller Dr, Fort Lauderdale, FL',
} as const

/** The wait to get through the terminal, a guide from how busy the arrival window usually is. */
export const WAIT_MINUTES: Record<Window['crowd'], number> = { quiet: 10, busy: 25, busiest: 40 }

export const windowFor = (start: string | null, priority: boolean): Window | null => arrivalWindows(priority).find((w) => w.start === start) ?? null

export type Traffic = 'light' | 'moderate' | 'heavy'
/** Road traffic near the port follows the crowd in the window. */
export const trafficFor = (crowd: Window['crowd']): Traffic => (crowd === 'quiet' ? 'light' : crowd === 'busy' ? 'moderate' : 'heavy')

export const departureEpoch = (departure: string, time: string): number => zonedToEpoch(departure, time, HOME_ZONE)

export type LuggageStatus = 'notDropped' | 'dropped' | 'delivered'
/** Bags dropped with the porters reach the stateroom within three hours, and not before the staterooms are ready. */
export const DELIVERY_HOURS = 3

export function luggageStatus(droppedAt: number | null, now: number, readyAt: number): LuggageStatus {
  if (droppedAt === null) return 'notDropped'
  return now >= Math.max(droppedAt + DELIVERY_HOURS * 3_600_000, readyAt) ? 'delivered' : 'dropped'
}

export const CARRY_ON = ['documents', 'medication', 'swimwear', 'chargers', 'valuables'] as const
export type CarryOnId = (typeof CARRY_ON)[number]
export const isCarryOn = (v: unknown): v is CarryOnId => (CARRY_ON as readonly unknown[]).includes(v)

/** The embarkation-day companion: the cards in the order a guest meets them (CHK-12). */
export const COMPANION = ['terminal', 'security', 'photo', 'gangway', 'muster', 'cabin'] as const
export type CompanionId = (typeof COMPANION)[number]
export const isCompanion = (v: unknown): v is CompanionId => (COMPANION as readonly unknown[]).includes(v)

/** The first card not yet done, or null when all are. */
export const currentCompanion = (done: readonly string[]): CompanionId | null => COMPANION.find((s) => !done.includes(s)) ?? null

export type AfternoonId = 'lunch' | 'stateroom' | 'muster' | 'sailAway'
/** The first afternoon in order, with the time each happens (ship home time, "HH:MM"). */
export const AFTERNOON: readonly { id: AfternoonId; time: string }[] = [
  { id: 'lunch', time: '12:00' },
  { id: 'stateroom', time: EMBARK.staterooms },
  { id: 'muster', time: EMBARK.muster },
  { id: 'sailAway', time: EMBARK.sailAway },
]

/** Who is on the booking, in persona order, with their position on the pass. */
export const seqOf = (booker: PersonaId, guest: PersonaId): number => PERSONAS.filter((p) => p.booker === booker).findIndex((p) => p.id === guest) + 1
