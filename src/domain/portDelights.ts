import type { SimWeather } from './autopilot'
import { aboardState, type AboardLevel } from './allaboard'
import { ALLOWANCE_USD } from './disembark'
import { itinerary, portById, type PortId, type Sailing } from './sailings'
import { SUSTAINABILITY } from './postcruise'

/**
 * Small delights, phase DL8 (docs/small-delights.md): port days and the way home. Pure helpers for the pocket stopwatch, the take-me-back card, the
 * UV and heat prompt, port stamps, pinned spots, the offline day card, the final-day strip, the last look, credit and customs allowance left and the
 * trip numbers. Pins, the saved day card and the last look are kept on this device and travel in the memory document. The empty-cabin photo never
 * leaves the device. Port phrases and the breakfast hour are authored concept values.
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export type CallPort = PortId
/** Any stop in the catalogue (not a day at sea) is a call port. */
export const isCallPort = (v: unknown): v is CallPort => typeof v === 'string' && v !== 'sea' && portById(v) !== undefined

// ---------------------------------------------------------------- D6A-1: pocket stopwatch

export interface Stopwatch { hours: number; minutes: number; /** "1:05"; "0:00" once it is time. */ text: string; level: AboardLevel }

/** Time until all-aboard as big hours and minutes. The deadline itself is in ship time, so the same number holds wherever the phone clock is set. */
export function stopwatch(allAboardAt: number, now: number): Stopwatch {
  const s = aboardState(allAboardAt, now)
  const total = Math.max(0, s.minutesLeft)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return { hours, minutes, text: `${hours}:${String(minutes).padStart(2, '0')}`, level: s.level }
}

// ---------------------------------------------------------------- D6A-2: take me back to the ship

export interface TakeMeBack { port: CallPort; /** Where the ship is, in the local language. */ place: string; /** What to say, in the local language. */ say: string; /** The same in English, for the guest. */ english: string; lang: 'es' | 'en' }

/** The cruise pier or tender point and a short request, for the ports that have authored words; served with the port reference (`portsServed.ts`). A real berth feed would replace these. */
const AUTHORED_TAKE_ME_BACK: Record<string, TakeMeBack> = {}

/** Replaces the authored words in place, so earlier imports see the served values. */
export function replaceTakeMeBack(next: Record<string, TakeMeBack>): void {
  for (const k of Object.keys(AUTHORED_TAKE_ME_BACK)) delete AUTHORED_TAKE_ME_BACK[k]
  Object.assign(AUTHORED_TAKE_ME_BACK, next)
}

/** The card for any port: the authored words where there are some, otherwise a plain English request that names only the port (no invented pier). */
export function takeMeBackFor(port: CallPort): TakeMeBack {
  const name = portById(port)?.name.split(',')[0] ?? port
  return AUTHORED_TAKE_ME_BACK[port] ?? { port, place: `The cruise ship, ${name}`, say: 'Please take me to the cruise ship.', english: 'Please take me to the cruise ship.', lang: 'en' }
}

// ---------------------------------------------------------------- D6A-3: UV and heat prompt

export type SunPrompt = 'sunscreen' | 'shade' | 'water'
export const UV_SUNSCREEN = 3
export const UV_STRONG = 8
export const HEAT_F = 90

/** One gentle prompt from the day's sky: nothing when it is mild, sunscreen when the UV is up, shade at a strong UV or heat, water in the heat. */
export function sunPrompts(w: Pick<SimWeather, 'uv' | 'tempF'>): SunPrompt[] {
  const out: SunPrompt[] = []
  if (w.uv >= UV_SUNSCREEN) out.push('sunscreen')
  if (w.uv >= UV_STRONG || w.tempF >= HEAT_F) out.push('shade')
  if (w.tempF >= HEAT_F) out.push('water')
  return out
}

// ---------------------------------------------------------------- D6A-7: port stamps

export interface Stamp { port: CallPort; day: number; date: string }

/** A stamp for each port the ship has reached by `today` (a ship-date "YYYY-MM-DD"), in the order of the cruise. Worked out from the route, so nothing is stored. */
export function portStamps(s: Sailing, today: string): Stamp[] {
  return itinerary(s).flatMap((d): Stamp[] => (isCallPort(d.port) && d.date <= today ? [{ port: d.port, day: d.day, date: d.date }] : []))
}

// ---------------------------------------------------------------- D6A-8: pinned spots

export const PINS_MAX = 30
export interface Pin { id: string; port: CallPort; note: string; at: number }

export function addPin(pins: readonly Pin[], p: Pin): Pin[] {
  const note = clean(p.note, 80)
  if (!note || !isCallPort(p.port) || pins.length >= PINS_MAX || pins.some((x) => x.id === p.id)) return [...pins]
  return [...pins, { id: clean(p.id, 40), port: p.port, note, at: p.at }]
}
export const removePin = (pins: readonly Pin[], id: string): Pin[] => pins.filter((p) => p.id !== id)
export const pinsAt = (pins: readonly Pin[], port: CallPort): Pin[] => pins.filter((p) => p.port === port)

// ---------------------------------------------------------------- D6A-9: offline day card

export interface DayCardInput { port: CallPort; portName: string; allAboardShip: string; allAboardLocal: string; phone: string; pins: readonly Pin[] }
export const DAY_CARD_MAX = 1200

/** Plain text for the day ashore, kept on the phone: leave-by time, the number to call, the words for a taxi and the guest's own pins. */
export function dayCardText(i: DayCardInput): string {
  const back = takeMeBackFor(i.port)
  const lines = [
    `${i.portName}: all aboard ${i.allAboardShip} ship time (${i.allAboardLocal} here).`,
    `Ship phone: ${i.phone}.`,
    `Back at: ${back.place}.`,
    `Say: ${back.say}`,
  ]
  const mine = pinsAt(i.pins, i.port)
  if (mine.length > 0) lines.push(`My spots: ${mine.map((p) => p.note).join('; ')}.`)
  return lines.join('\n').slice(0, DAY_CARD_MAX)
}

export interface SavedDayCard { port: CallPort; text: string; at: number }

// ---------------------------------------------------------------- D7-2: final-day strip

export const BREAKFAST_UNTIL_MINUTES = 90
export type StripId = 'arrive' | 'breakfast' | 'group' | 'vacate'
export interface StripItem { id: StripId; at: number }

/** The last morning in time order: the ship ties up, the dining room's last breakfast, the guest's walk-off time and the cabin to be empty. Breakfast closes 90 minutes after arrival (an authored concept hour). */
export function finalDayStrip(t: { arrivalAt: number; vacateAt: number }, walkOffAt: number): StripItem[] {
  const items: StripItem[] = [
    { id: 'arrive', at: t.arrivalAt },
    { id: 'breakfast', at: t.arrivalAt + BREAKFAST_UNTIL_MINUTES * 60_000 },
    { id: 'group', at: walkOffAt },
    { id: 'vacate', at: t.vacateAt },
  ]
  return items.sort((a, b) => a.at - b.at)
}

// ---------------------------------------------------------------- D7-4, D7-8: credit and allowance left

/** Onboard credit left, in cents: only when the account is in credit (credits are more than charges). */
export const creditLeft = (totals: { charges: number; credits: number }): number => Math.max(0, totals.credits - totals.charges)

/** The customs allowance left for the party, in dollars (never below zero), and how far over it is. An estimate; the official form stays official. */
export function allowanceLeft(people: number, goodsUsd: number): { left: number; over: number } {
  const total = Math.max(0, Math.round(people)) * ALLOWANCE_USD
  const spent = Math.max(0, Math.round(goodsUsd))
  return { left: Math.max(0, total - spent), over: Math.max(0, spent - total) }
}

// ---------------------------------------------------------------- D7-9: trip numbers

export interface TripNumbers { nights: number; ports: number; seaDays: number; nauticalMiles: number }

export function tripNumbers(s: Sailing): TripNumbers {
  const days = itinerary(s)
  return {
    nights: Math.max(1, days.length - 1),
    ports: new Set(days.filter((d) => isCallPort(d.port)).map((d) => d.port)).size,
    seaDays: days.filter((d) => d.port === 'sea').length,
    nauticalMiles: SUSTAINABILITY.nauticalMiles,
  }
}

export const tripNumbersText = (n: TripNumbers): string =>
  `${n.nights} nights, ${n.ports} ports, ${n.seaDays} days at sea, about ${n.nauticalMiles.toLocaleString('en-US')} nautical miles.`

// ---------------------------------------------------------------- state

export const LAST_LOOK_NOTE_MAX = 120
export interface LastLook { done: boolean; note: string }
export interface PortsState { pins: Pin[]; card: SavedDayCard | null; lastLook: LastLook }
export const EMPTY_PORTS: PortsState = { pins: [], card: null, lastLook: { done: false, note: '' } }

export function normalizePorts(raw: unknown): PortsState {
  const r = rec(raw)
  const pins = arr(r.pins).reduce<Pin[]>((acc, x) => {
    const o = rec(x)
    return typeof o.id === 'string' && isCallPort(o.port) && typeof o.note === 'string' ? addPin(acc, { id: o.id, port: o.port, note: o.note, at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0 }) : acc
  }, [])
  const c = rec(r.card)
  const text = typeof c.text === 'string' ? c.text.slice(0, DAY_CARD_MAX) : ''
  const card = isCallPort(c.port) && text !== '' ? { port: c.port, text, at: typeof c.at === 'number' && Number.isFinite(c.at) ? c.at : 0 } : null
  const l = rec(r.lastLook)
  return { pins, card, lastLook: { done: l.done === true, note: clean(l.note, LAST_LOOK_NOTE_MAX) } }
}
