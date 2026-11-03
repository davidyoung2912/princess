import { musterByLabel, ELEVATORS, PLACES, placeById, type Place, type Section } from './deck'
import { cabinPlace, wayBetween } from './deckGraph'
import type { Status } from './journey'
import { itinerary, type Sailing } from './sailings'
import { SHIP } from './ship'

/**
 * Small delights, phase DL6 (docs/small-delights.md): travel day and embark. Pure helpers for the traffic-light card, the show-the-driver card, the
 * ship-lengths count, the cabin-ready route in words, three landmarks, the usual bag window, the sail-away spot, the Wi-Fi QR and the ticket stub.
 * Figures and phrases here are authored concept samples: the guest is told to confirm with the terminal or the ship.
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

// ---------------------------------------------------------------- D4A-1: traffic light

export type Light = 'green' | 'amber' | 'red'
/** On track is green, tight is amber, at risk is red. The word is always shown with the colour. */
export const lightFor = (status: Status): Light => (status === 'onTrack' ? 'green' : status === 'tight' ? 'amber' : 'red')

// ---------------------------------------------------------------- D4A-2: show the driver

export const DRIVER_LANGS = ['en', 'es'] as const
export type DriverLang = (typeof DRIVER_LANGS)[number]
export const isDriverLang = (v: unknown): v is DriverLang => DRIVER_LANGS.some((l) => l === v)
export const DRIVER_LANG_NAMES: Record<DriverLang, string> = { en: 'English', es: 'Español' }

export interface DriverCard { lang: DriverLang; lines: string[] }

/** The words for a taxi or ride driver, in the language chosen, at big type. The text is deliberately fixed in that language whatever the app language is. */
export function driverCard(lang: DriverLang, place: { terminal: string; address: string }): DriverCard {
  const t = clean(place.terminal, 40)
  const a = clean(place.address, 120)
  return lang === 'es'
    ? { lang, lines: ['Por favor, lléveme al puerto de cruceros.', `Port Everglades, ${t}`, a, 'Entrada de pasajeros. Gracias.'] }
    : { lang, lines: ['Please take me to the cruise port.', `Port Everglades, ${t}`, a, 'Passenger drop-off. Thank you.'] }
}

// ---------------------------------------------------------------- D4A-8: distance in ship-lengths

/** Average road speed used to turn minutes into miles for a drive (authored, 45 mph). */
export const MILES_PER_MINUTE = 0.75
const FEET_PER_MILE = 5280

/** The ship's length in feet, read from its facts ("1,133 ft"). */
export const shipLengthFeet = (text: string = SHIP.length): number => {
  const n = Number(text.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 1133
}

export const shipLengthsIn = (miles: number, feet: number = shipLengthFeet()): number => Math.max(0, Math.round((miles * FEET_PER_MILE) / feet))

/** Minutes of driving left: the planned drive less the time since leaving, never below zero or above the whole drive. Before leaving, the whole drive. */
export function driveMinutesLeft(roadMinutes: number, leaveByMs: number | null, nowMs: number): number {
  const total = Math.max(0, roadMinutes)
  if (leaveByMs === null || nowMs <= leaveByMs) return total
  return Math.max(0, Math.min(total, total - Math.floor((nowMs - leaveByMs) / 60_000)))
}

export interface DriveProgress { miles: number; lengths: number; totalLengths: number }
export function driveProgress(roadMinutes: number, leaveByMs: number | null, nowMs: number): DriveProgress {
  const left = driveMinutesLeft(roadMinutes, leaveByMs, nowMs)
  const miles = Math.round(left * MILES_PER_MINUTE * 10) / 10
  return { miles, lengths: shipLengthsIn(left * MILES_PER_MINUTE), totalLengths: shipLengthsIn(Math.max(0, roadMinutes) * MILES_PER_MINUTE) }
}

// ---------------------------------------------------------------- D5-3: cabin ready, in words

export type Side = 'port' | 'starboard'
export interface CabinRoute {
  cabin: string
  deck: number
  section: Section
  /** The lift bank to take, in the cabin's own section. */
  bank: string
  /** Which side of the ship the cabin is on: even numbers are starboard (right, facing the front), odd are port (left). */
  side: Side
  /** Deck of the gangway the guest boards on. */
  fromDeck: number
}

/** A plain route from the gangway to a cabin: the deck, the lift bank, and the side. Null when the number is not a cabin. */
export function cabinRoute(cabin: string): CabinRoute | null {
  const place = cabinPlace(cabin)
  const landing = placeById('landing')
  if (!place || !landing) return null
  const bank = ELEVATORS.find((e) => e.section === place.section) ?? ELEVATORS[0]
  return { cabin, deck: place.deck, section: place.section, bank: bank.bank, side: Number(cabin.slice(-1)) % 2 === 0 ? 'starboard' : 'port', fromDeck: landing.deck }
}

// ---------------------------------------------------------------- D5-4: three landmarks

export interface Landmark { id: string; name: string; deck: number }

/**
 * Up to three public rooms along the way from the cabin to the guest's muster station: the first named room on each deck and section the route passes
 * through (service-only places last), then the muster station itself. Empty when the cabin or the station is not known.
 */
export function landmarksToMuster(cabin: string, musterLabel: string, places: readonly Place[] = PLACES): Landmark[] {
  const from = cabinPlace(cabin)
  const station = musterByLabel(musterLabel)
  const to = station ? placeById(station.placeId) : undefined
  if (!from || !station || !to) return []
  const way = wayBetween(from, to) ?? []
  const picked: Landmark[] = []
  const add = (p: Place | undefined) => { if (p && p.id !== to.id && !picked.some((x) => x.id === p.id)) picked.push({ id: p.id, name: p.name, deck: p.deck }) }
  const rank = (p: Place) => (p.kind === 'service' || p.kind === 'medical' ? 1 : 0)
  for (const w of way) {
    if (picked.length >= 2) break
    add([...places].filter((p) => p.deck === w.deck && p.section === w.section).sort((a, b) => rank(a) - rank(b))[0])
  }
  // Fill from the same decks if the route was short, then close with the station itself.
  for (const p of places.filter((p) => p.deck === from.deck || p.deck === to.deck).sort((a, b) => rank(a) - rank(b))) { if (picked.length >= 2) break; add(p) }
  picked.push({ id: to.id, name: station.name, deck: station.deck })
  return picked.slice(0, 3)
}

// ---------------------------------------------------------------- D5-5: where are my bags, usually?

/** The usual window, in the ship's local hours, in which bags reach cabins on embarkation day. Authored from the ship's pattern; not a promise. */
export const BAG_WINDOW = { fromHour: 13, toHour: 17, source: 'the usual pattern on this ship' } as const

export function bagWindow(): { from: string; to: string; source: string } {
  const h = (n: number) => `${n > 12 ? n - 12 : n}:00 ${n >= 12 ? 'pm' : 'am'}`
  return { from: h(BAG_WINDOW.fromHour), to: h(BAG_WINDOW.toHour), source: BAG_WINDOW.source }
}

// ---------------------------------------------------------------- D5-6: sail-away spot

export interface SailAway { placeId: string; name: string; deck: number; /** Ship time "HH:MM" to be there. */ beThere: string; departs: string }

const minus = (hhmm: string, minutes: number): string => {
  const [h, m] = hhmm.split(':').map(Number)
  const total = Math.max(0, h * 60 + m - minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Where to watch the ship leave, and when to be there (twenty minutes before the ship sails). Null if the sailing has no departure time on day one. */
export function sailAwaySpot(sailing: Sailing, lead = 20): SailAway | null {
  const day1 = itinerary(sailing).find((d) => d.day === 1)
  const spot = placeById('promenade') ?? placeById('sea-view')
  if (!day1?.depart || !spot) return null
  return { placeId: spot.id, name: spot.name, deck: spot.deck, beThere: minus(day1.depart, lead), departs: day1.depart }
}

// ---------------------------------------------------------------- D5-7: Wi-Fi by QR

/** The ship's guest network (authored). It is open until the sign-in page, so the QR has no password. */
export const WIFI_NETWORK = 'Princess-Guest'

const esc = (s: string): string => s.replace(/([\\;,:"])/g, '\\$1')
/** The text inside the QR code that phones read as "join this network". */
export const wifiQrText = (ssid: string = WIFI_NETWORK): string => `WIFI:T:nopass;S:${esc(clean(ssid, 32))};;`

// ---------------------------------------------------------------- D5-8: ticket stub

export const STUBS_MAX = 20
export interface Stub { id: string; /** Booking number. */ number: string; /** Sailing date "YYYY-MM-DD". */ date: string; terminal: string; guests: number; savedAt: number }

/** Adds a stub, or replaces the one for the same booking number. The newest 20 are kept. */
export function addStub(list: readonly Stub[], s: Stub): Stub[] {
  const number = clean(s.number, 24)
  if (!number || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return [...list]
  const next: Stub = { id: s.id, number, date: s.date, terminal: clean(s.terminal, 30), guests: Math.max(1, Math.min(20, Math.round(s.guests) || 1)), savedAt: s.savedAt }
  return [...list.filter((x) => x.number !== number), next].sort((a, b) => b.date.localeCompare(a.date)).slice(0, STUBS_MAX)
}
export const removeStub = (list: readonly Stub[], id: string): Stub[] => list.filter((x) => x.id !== id)
export const hasStub = (list: readonly Stub[], number: string): boolean => list.some((x) => x.number === number)

export interface EmbarkState { stubs: Stub[] }
export const EMPTY_EMBARK: EmbarkState = { stubs: [] }

export function normalizeEmbark(raw: unknown): EmbarkState {
  const stubs = (Array.isArray(raw === null || typeof raw !== 'object' ? null : rec(raw).stubs) ? (rec(raw).stubs as unknown[]) : []).flatMap((x): Stub[] => {
    const o = rec(x)
    if (typeof o.id !== 'string' || typeof o.number !== 'string' || typeof o.date !== 'string') return []
    const stub: Stub = { id: o.id.slice(0, 40), number: clean(o.number, 24), date: o.date, terminal: clean(o.terminal, 30), guests: typeof o.guests === 'number' ? o.guests : 1, savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0 }
    return addStub([], stub)
  })
  return { stubs: stubs.reduce<Stub[]>((acc, s) => addStub(acc, s), []) }
}
