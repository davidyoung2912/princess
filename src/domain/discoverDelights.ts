import type { Cabin, Side } from './cabins'
import { ELEVATORS, PLACES, placeById, roomId, type Place, type PlaceKind } from './deck'
import { wayBetween } from './deckGraph'
import type { ItineraryDay, PortId } from './sailings'

/**
 * Small delights, phase DL3 (docs/small-delights.md): discover and cabin helpers. Pure functions over the sailing, cabin and deck data, so they can
 * be tested in a node environment. Sun sides, walk times and the land-holiday range are rough, authored guides and are labelled that way on screen.
 */

// ---------------------------------------------------------------- D1-2: the shape of the trip as a strip of days

export type StripKind = 'home' | 'dock' | 'tender' | 'sea'
export interface StripDay { day: number; kind: StripKind; /** Whole hours in port, or null when there is no time to show. */ hours: number | null }

const minutesOf = (hhmm: string | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** One block per day: sea, home port, dock or tender, with the hours between arriving and leaving (past midnight counts as the next day). */
export function dayStrip(days: readonly Pick<ItineraryDay, 'day' | 'port' | 'arrive' | 'depart'>[], tenderPorts: ReadonlySet<string>, homePort: string | undefined = days[0]?.port): StripDay[] {
  return days.map((d) => {
    if (d.port === 'sea') return { day: d.day, kind: 'sea', hours: null }
    const a = minutesOf(d.arrive)
    const b = minutesOf(d.depart)
    const hours = a !== null && b !== null ? Math.round(((b - a + 1440) % 1440) / 60) : null
    const kind: StripKind = d.port === homePort ? 'home' : tenderPorts.has(d.port) ? 'tender' : 'dock'
    return { day: d.day, kind, hours }
  })
}

export function stripSummary(strip: readonly StripDay[]): { sea: number; ports: number; tender: number } {
  return { sea: strip.filter((s) => s.kind === 'sea').length, ports: strip.filter((s) => s.kind === 'dock' || s.kind === 'tender').length, tender: strip.filter((s) => s.kind === 'tender').length }
}

// ---------------------------------------------------------------- D1-4: which side the sun is on, day by day

/** Compass bearing in degrees (0 north, 90 east) from one [lon, lat] to another. */
export function bearing(from: readonly [number, number], to: readonly [number, number]): number {
  const rad = Math.PI / 180
  const dLon = (to[0] - from[0]) * rad
  const y = Math.sin(dLon) * Math.cos(to[1] * rad)
  const x = Math.cos(from[1] * rad) * Math.sin(to[1] * rad) - Math.sin(from[1] * rad) * Math.cos(to[1] * rad) * Math.cos(dLon)
  return ((Math.atan2(y, x) / rad) + 360) % 360
}

const angleGap = (a: number, b: number): number => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d }

export interface SunDay { day: number; /** Ship heading in degrees while sailing, or null when it depends on the berth. */ heading: number | null; morning: boolean; afternoon: boolean }

/**
 * For each day, whether a cabin's side of the ship faces the morning sun (east) or the afternoon sun (west). The heading on a sea day is the bearing
 * from the last port to the next; on a day in port it depends on how the ship is berthed, so nothing is claimed (both false, heading null).
 */
export function sunByDay(days: readonly Pick<ItineraryDay, 'day' | 'port'>[], coords: Partial<Record<PortId, readonly [number, number]>>, side: Side): SunDay[] {
  return days.map((d, i) => {
    if (d.port !== 'sea') return { day: d.day, heading: null, morning: false, afternoon: false }
    const prev = [...days.slice(0, i)].reverse().find((x) => x.port !== 'sea')
    const next = days.slice(i + 1).find((x) => x.port !== 'sea')
    const from = prev && coords[prev.port]
    const to = next && coords[next.port]
    if (!from || !to) return { day: d.day, heading: null, morning: false, afternoon: false }
    const heading = bearing(from, to)
    const facing = (heading + (side === 'starboard' ? 90 : -90) + 360) % 360
    return { day: d.day, heading: Math.round(heading), morning: angleGap(facing, 90) <= 80, afternoon: angleGap(facing, 270) <= 80 }
  })
}

// ---------------------------------------------------------------- D1-5: walk time from a cabin

export interface Walk { id: string; name: string; minutes: number; /** How the way goes: on the cabin's own deck, or by lift (the deck graph has lifts only, no stairs). */ by: 'deck' | 'lift'; /** The place is marked step-free in the deck data; this is not a verified route. */ placeStepFree: boolean }

const cabinSpot = (c: Pick<Cabin, 'deck' | 'position'>): Place => ({ id: 'cabin', name: 'Cabin', deck: c.deck, section: c.position, kind: 'service', stepFree: true })

/** Minutes between two places: a minute to get started, a minute for each section walked along a deck, and the lift (a wait and about a quarter minute a deck). */
export function walkMinutes(a: Place, b: Place): number | null {
  const way = wayBetween(a, b)
  if (!way) return null
  const halls = way.filter((w) => w.kind === 'hall').length
  const lift = way.some((w) => w.kind === 'lift')
  const walked = lift ? Math.max(0, halls - 2) : Math.max(0, halls - 1)
  const ride = lift ? 1.5 + Math.abs(a.deck - b.deck) * 0.25 : 0
  return Math.max(1, Math.ceil(1 + walked + ride))
}

/** Minutes from a stateroom to a public place, from the deck graph; null when there is no way. */
export const walkFromCabin = (c: Pick<Cabin, 'deck' | 'position'>, to: Place): number | null => walkMinutes(cabinSpot(c), to)

export const WALK_TARGETS = ['lido', 'arena', 'guest-services'] as const

/** Minutes from the cabin to the places guests ask about, from the deck graph. The nearest lift is always in the cabin's own section (a minute). */
export function cabinWalks(c: Pick<Cabin, 'deck' | 'position'>): { walks: Walk[]; lift: { bank: string; minutes: number } } {
  const from = cabinSpot(c)
  const walks = WALK_TARGETS.flatMap((id): Walk[] => {
    const p = placeById(roomId(id) ?? '')
    const minutes = p ? walkMinutes(from, p) : null
    return p && minutes !== null ? [{ id, name: p.name, minutes, by: p.deck === c.deck ? 'deck' : 'lift', placeStepFree: p.stepFree }] : []
  })
  const bank = ELEVATORS.find((e) => e.section === c.position) ?? ELEVATORS[0]
  return { walks, lift: { bank: bank.bank, minutes: 1 } }
}

// ---------------------------------------------------------------- D1-6: what is above and below

const LOUD_ABOVE: readonly PlaceKind[] = ['pool', 'bar', 'show', 'family', 'dining']
const LOUD_BELOW: readonly PlaceKind[] = ['bar', 'show']

export interface Neighbours { above: Place[]; below: Place[]; noise: 'noisy' | 'maybe' | 'quiet' }

/** The public rooms on the decks above and below, in the cabin's section. A pool, bar, show or dining room above, or a bar or show below, is a noise caution. */
export function cabinNeighbours(c: Pick<Cabin, 'deck' | 'position'>, places: readonly Place[] = PLACES): Neighbours {
  const on = (deck: number): Place[] => places.filter((p) => p.deck === deck && p.section === c.position)
  const above = on(c.deck + 1)
  const below = on(c.deck - 1)
  const noisy = above.some((p) => LOUD_ABOVE.includes(p.kind)) || below.some((p) => LOUD_BELOW.includes(p.kind))
  return { above, below, noise: noisy ? 'noisy' : above.length + below.length > 0 ? 'maybe' : 'quiet' }
}

// ---------------------------------------------------------------- D1-7: pick up where you left off

export interface LeftOff { count: number; /** Distinct decks of the cabins, low to high. */ decks: number[] }

/** A short description of an earlier comparison: how many cabins and on which decks. Null when nothing was being compared. */
export function leftOff(picks: readonly { number: string }[]): LeftOff | null {
  if (picks.length === 0) return null
  const decks = [...new Set(picks.map((p) => (/^\d{4,5}$/.test(p.number) ? Number(p.number.slice(0, -3)) : 0)).filter((d) => d > 0))].sort((a, b) => a - b)
  return { count: picks.length, decks }
}

// ---------------------------------------------------------------- D0-3: on that date you would be

/** The itinerary day that falls on a date, if the sailing is under way then. */
export const dayOn = <T extends { date: string }>(days: readonly T[], date: string): T | undefined => days.find((d) => d.date === date)

// ---------------------------------------------------------------- D0-6: cost per day beside a land holiday

/**
 * A typical mid-range land holiday for one person for one day, in cents: a hotel share, three meals, local travel and one paid activity. Authored
 * sample range, shown with its method and not a quote. Flights are left out here and in the cruise figure.
 */
export const LAND_HOLIDAY_PER_DAY = { low: 18_000, high: 32_000 } as const

export type LandPosition = 'below' | 'within' | 'above'

/** The cruise's cost per person per day (cents) and where it sits against the land-holiday range. Zero when the figures are not usable. */
export function costPerDay(total: number, guests: number, nights: number): { perDay: number; position: LandPosition } | null {
  if (!Number.isFinite(total) || total <= 0) return null
  const days = Math.max(1, Math.floor(nights)) + 1
  const perDay = Math.round(total / (Math.max(1, Math.floor(guests)) * days))
  return { perDay, position: perDay < LAND_HOLIDAY_PER_DAY.low ? 'below' : perDay > LAND_HOLIDAY_PER_DAY.high ? 'above' : 'within' }
}

// ---------------------------------------------------------------- D0-1: the gut-check flip

/** Which of two sailings a coin picks, for a random number in [0, 1). */
export const flipPick = (r: number): 0 | 1 => (r < 0.5 ? 0 : 1)

/** What the guest's reaction suggests: hoping for the result means the coin agrees with them; otherwise they probably prefer the other one. Never a verdict. */
export const flipHint = (result: 0 | 1, hopedFor: boolean): 0 | 1 => (hopedFor ? result : result === 0 ? 1 : 0)

/** A flip is only offered for two different sailings. */
export const canFlip = (a: string, b: string): boolean => a !== '' && b !== '' && a !== b
