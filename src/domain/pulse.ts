import { placeById } from './deck'
import { portAt, shipZoneAt, type Sailing } from './sailings'
import { timeIn } from './timezones'

/**
 * Ship Pulse (S6-01), the quiet-space finder (S6-04) and standby and shortest line (S6-05).
 * Every number here is a simulation over a stable seed and the demo clock (`source: 'sim'`), so the same moment always gives the same answer
 * and a real feed can replace `pulseAt` later. Nothing is ever shown without its age and how sure it is.
 */
const MIN = 60_000
export const PULSE_STEP_MIN = 5

export type PulseId = 'lido-pool' | 'lido' | 'arena' | 'lotus' | 'guest-services' | 'eatery' | 'promenade'
export type PulseKind = 'pool' | 'buffet' | 'theatre' | 'spa' | 'service' | 'dining' | 'deck'
export type PulseLabel = 'quiet' | 'moderate' | 'busy'
export type Confidence = 'low' | 'medium'

export interface PulseVenue { id: PulseId; kind: PulseKind; confidence: Confidence; path: string }

export const PULSE_VENUES: readonly PulseVenue[] = [
  { id: 'lido-pool', kind: 'pool', confidence: 'medium', path: '/ship/venues' },
  { id: 'lido', kind: 'buffet', confidence: 'medium', path: '/ship/venues' },
  { id: 'eatery', kind: 'dining', confidence: 'low', path: '/ship/venues' },
  { id: 'arena', kind: 'theatre', confidence: 'medium', path: '/ship/venues' },
  { id: 'lotus', kind: 'spa', confidence: 'low', path: '/ship/spa' },
  { id: 'guest-services', kind: 'service', confidence: 'low', path: '/ship/help-now' },
  { id: 'promenade', kind: 'deck', confidence: 'low', path: '/ship/map' },
]

export const pulseVenueById = (id: unknown): PulseVenue | undefined => PULSE_VENUES.find((v) => v.id === id)

/** The usual busyness by hour of the day (0 to 23), 0 to 100, authored per kind. */
const SHAPE: Record<PulseKind, readonly number[]> = {
  pool: [0, 0, 0, 0, 0, 0, 5, 10, 15, 25, 45, 70, 80, 85, 85, 80, 65, 40, 20, 10, 5, 5, 0, 0],
  buffet: [0, 0, 0, 0, 0, 5, 30, 75, 80, 55, 25, 45, 85, 80, 40, 25, 30, 55, 80, 70, 40, 15, 5, 0],
  dining: [0, 0, 0, 0, 0, 0, 10, 40, 60, 40, 20, 50, 70, 55, 30, 25, 30, 45, 60, 55, 35, 20, 10, 0],
  theatre: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 15, 15, 10, 10, 15, 20, 25, 35, 55, 80, 90, 90, 50, 20],
  spa: [0, 0, 0, 0, 0, 0, 0, 10, 30, 55, 70, 75, 70, 70, 75, 70, 55, 35, 15, 0, 0, 0, 0, 0],
  service: [0, 0, 0, 0, 0, 0, 0, 20, 70, 85, 70, 50, 40, 40, 50, 60, 80, 60, 30, 15, 10, 5, 0, 0],
  deck: [5, 0, 0, 0, 0, 5, 25, 40, 30, 20, 25, 30, 25, 25, 30, 35, 40, 30, 20, 10, 5, 5, 5, 5],
}

/** What the venue kinds lose when most guests are ashore. */
const ASHORE_DROP: Record<PulseKind, number> = { pool: 40, buffet: 35, dining: 25, theatre: 15, spa: 30, service: -10, deck: 20 }

/** The ship's clock and whether guests are ashore, at any moment. Built from a sailing, or by hand in tests. */
export interface PulseEnv {
  /** Ship hour of the day as a fraction, 0 to 24. */
  hour(at: number): number
  ashore(at: number): boolean
}

export function envFor(s: Sailing): PulseEnv {
  return {
    hour: (at) => {
      const hhmm = timeIn(at, shipZoneAt(s, at))
      return Number(hhmm.slice(0, 2)) + Number(hhmm.slice(3, 5)) / 60
    },
    ashore: (at) => {
      const { port } = portAt(s, at)
      const h = Number(timeIn(at, shipZoneAt(s, at)).slice(0, 2))
      return (port === 'cozumel' || port === 'belize' || port === 'roatan') && h >= 9 && h < 16
    },
  }
}

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

export interface Pulse {
  id: PulseId
  /** 0 (empty) to 100 (full). */
  level: number
  label: PulseLabel
  /** The reading was taken at this moment, never later than now. */
  observedAt: number
  ageMinutes: number
  confidence: Confidence
  source: 'sim'
}

export const labelFor = (level: number): PulseLabel => (level < 35 ? 'quiet' : level < 65 ? 'moderate' : 'busy')

/** The level at a moment: the usual shape for the hour, less when guests are ashore, with a steady wobble from the seed. */
export function levelAt(id: PulseId, at: number, env: PulseEnv): number {
  const venue = pulseVenueById(id)
  if (!venue) return 0
  const hour = env.hour(at)
  const base = SHAPE[venue.kind]
  const lo = Math.floor(hour) % 24
  const next = base[(lo + 1) % 24]
  const shape = base[lo] + (next - base[lo]) * (hour - Math.floor(hour))
  const wobble = (hash(`${id}|${Math.floor(at / (15 * MIN))}`) % 21) - 10
  const drop = env.ashore(at) ? ASHORE_DROP[venue.kind] : 0
  return Math.max(0, Math.min(100, Math.round(shape + wobble - drop)))
}

/** What to show for a venue now: the reading from the last five-minute mark, with how old it is. */
export function pulseAt(id: PulseId, now: number, env: PulseEnv): Pulse {
  const observedAt = Math.floor(now / (PULSE_STEP_MIN * MIN)) * PULSE_STEP_MIN * MIN
  const level = levelAt(id, observedAt, env)
  return { id, level, label: labelFor(level), observedAt, ageMinutes: Math.max(0, Math.floor((now - observedAt) / MIN)), confidence: pulseVenueById(id)?.confidence ?? 'low', source: 'sim' }
}

export interface GoodTime { at: number; level: number; label: PulseLabel; /** The venue is quiet right now, so go now. */ now: boolean }

/** The quietest half hour in the next `hours` hours (the earliest one on a tie). Starts with now. */
export function goodTime(id: PulseId, now: number, env: PulseEnv, hours = 4): GoodTime {
  let best: { at: number; level: number } | null = null
  for (let i = 0; i <= hours * 2; i++) {
    const at = now + i * 30 * MIN
    const level = levelAt(id, at, env)
    if (!best || level < best.level) best = { at, level }
  }
  const pick = best ?? { at: now, level: levelAt(id, now, env) }
  const nowLevel = levelAt(id, now, env)
  return { at: pick.at, level: pick.level, label: labelFor(pick.level), now: pick.at === now || labelFor(nowLevel) === 'quiet' }
}

/** Quiet spaces (S6-04). Authored concept values on places that exist on the deck map. */
export interface QuietSpace {
  id: string
  placeId: string
  /** 1 (very calm) to 3 (some background noise). */
  noise: 1 | 2 | 3
  shade: boolean
  seating: boolean
  /** Open hours as ship-time hours, [from, to). */
  open: readonly [number, number]
  /** The pulse venue whose crowd it follows, when it has one. */
  follows?: PulseId
}

export const QUIET_SPACES: readonly QuietSpace[] = [
  { id: 'promenade', placeId: 'promenade', noise: 1, shade: true, seating: true, open: [6, 22], follows: 'promenade' },
  { id: 'coffee', placeId: 'coffee-currents', noise: 2, shade: true, seating: true, open: [6, 23] },
  { id: 'cafe', placeId: 'intl-cafe', noise: 2, shade: true, seating: true, open: [6, 23] },
  { id: 'dome', placeId: 'dome', noise: 1, shade: true, seating: true, open: [9, 20] },
  { id: 'seaview', placeId: 'sea-view', noise: 3, shade: false, seating: true, open: [10, 24] },
]

export interface QuietFilter { stepFree: boolean; shade: boolean; seating: boolean }
export const NO_QUIET_FILTER: QuietFilter = { stepFree: false, shade: false, seating: false }

export interface QuietResult extends QuietSpace {
  name: string
  deck: number
  stepFree: boolean
  openNow: boolean
  level: number
  label: PulseLabel
}

/** Quiet spaces that are open now first, then the calmest, then those with the fewest people. */
export function quietSpaces(now: number, env: PulseEnv, f: QuietFilter = NO_QUIET_FILTER): QuietResult[] {
  const hour = env.hour(now)
  const out: QuietResult[] = []
  for (const q of QUIET_SPACES) {
    const place = placeById(q.placeId)
    if (!place) continue
    if ((f.stepFree && !place.stepFree) || (f.shade && !q.shade) || (f.seating && !q.seating)) continue
    const level = q.follows ? levelAt(q.follows, now, env) : Math.min(60, Math.round(levelAt('promenade', now, env) + (hash(q.id) % 15)))
    out.push({ ...q, name: place.name, deck: place.deck, stepFree: place.stepFree, openNow: hour >= q.open[0] && hour < q.open[1], level, label: labelFor(level) })
  }
  return out.sort((a, b) => Number(b.openNow) - Number(a.openNow) || a.noise - b.noise || a.level - b.level || a.id.localeCompare(b.id))
}

/** Standby and shortest line (S6-05). */
export type LineKind = 'show' | 'dining' | 'service'

export interface LineDef { kind: LineKind; venue: PulseId; maxWait: number; /** The venue offers a virtual queue in the app. */ virtual: boolean; path: string }

export const LINES: readonly LineDef[] = [
  { kind: 'show', venue: 'arena', maxWait: 25, virtual: false, path: '/ship/venues' },
  { kind: 'dining', venue: 'eatery', maxWait: 30, virtual: true, path: '/plan/dining' },
  { kind: 'service', venue: 'guest-services', maxWait: 20, virtual: false, path: '/ship/help-now' },
]

export interface LineReading { kind: LineKind; waitMinutes: number; virtual: boolean; path: string; pulse: Pulse; shortest: { at: number; waitMinutes: number } }

const waitFor = (l: LineDef, at: number, env: PulseEnv): number => Math.round((levelAt(l.venue, at, env) / 100) * l.maxWait)

/** The wait now and the likeliest short window in the next three hours. */
export function lineReading(kind: LineKind, now: number, env: PulseEnv): LineReading {
  const l = LINES.find((x) => x.kind === kind) ?? LINES[0]
  let best = { at: now, waitMinutes: waitFor(l, now, env) }
  for (let i = 1; i <= 6; i++) {
    const at = now + i * 30 * MIN
    const w = waitFor(l, at, env)
    if (w < best.waitMinutes) best = { at, waitMinutes: w }
  }
  return { kind: l.kind, waitMinutes: waitFor(l, now, env), virtual: l.virtual, path: l.path, pulse: pulseAt(l.venue, now, env), shortest: best }
}
