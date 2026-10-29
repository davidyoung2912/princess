import { clockTime } from './syncAge'
import { dayLabel, isZone, offsetMinutes } from './timezones'

/**
 * The demo clock: one source of "now" for the whole app. It is a point on the demo timeline pinned to a moment of real
 * time, plus a speed, so a page reload carries on from where it was. Speed 0 holds the clock still.
 */
export interface ClockState {
  anchorDemo: number
  anchorReal: number
  speed: number
}

/** Speeds the controls offer: stopped, real time, one minute, ten minutes, one hour per second. */
export const CLOCK_SPEEDS: readonly number[] = [0, 1, 60, 600, 3600]

export const clockNow = (c: ClockState, realNow: number): number => c.anchorDemo + (realNow - c.anchorReal) * c.speed

export const clockAt = (demoNow: number, realNow: number, speed = 1): ClockState => ({ anchorDemo: demoNow, anchorReal: realNow, speed })

export const stepClock = (c: ClockState, deltaMs: number, realNow: number): ClockState => clockAt(clockNow(c, realNow) + deltaMs, realNow, c.speed)

export const setClockSpeed = (c: ClockState, speed: number, realNow: number): ClockState => clockAt(clockNow(c, realNow), realNow, speed)

/** A clock from untrusted stored data. */
export function normalizeClock(raw: unknown, fallback: ClockState): ClockState {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const demo = num(o.anchorDemo)
  const real = num(o.anchorReal)
  const speed = num(o.speed)
  if (demo === null || real === null || speed === null || !CLOCK_SPEEDS.includes(speed)) return { ...fallback }
  return { anchorDemo: demo, anchorReal: real, speed }
}

export type ClockKind = 'ship' | 'port' | 'phone'

export interface ClockReading {
  kind: ClockKind
  zone: string
  /** "9:14 am". */
  time: string
  /** "Wed 24 Mar". */
  day: string
  /** Minutes ahead of UTC. */
  offset: number
}

export interface Zones {
  ship: string
  /** Null when the ship is at sea. */
  port: string | null
  phone: string
}

/** Ship time, local port time and phone time side by side (POR-11). Port is left out at sea. */
export function threeClocks(at: number, zones: Zones): ClockReading[] {
  const read = (kind: ClockKind, zone: string): ClockReading => ({ kind, zone, time: clockTime(new Date(at), zone), day: dayLabel(at, zone), offset: offsetMinutes(at, zone) })
  const out = [read('ship', zones.ship)]
  if (zones.port) out.push(read('port', zones.port))
  out.push(read('phone', zones.phone))
  return out
}

/** Whole hours (or half) between two readings, e.g. -1 when the port is an hour behind the ship. */
export const hoursBetween = (from: ClockReading, to: ClockReading): number => (to.offset - from.offset) / 60

/** Phone zones the demo offers: home time for a US guest, and the zones the ship passes through. */
export const PHONE_ZONES: readonly string[] = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Cancun', 'America/Belize']
export const DEFAULT_PHONE_ZONE = 'America/Chicago'

export const normalizePhoneZone = (z: unknown): string => (isZone(z) && PHONE_ZONES.includes(z) ? z : DEFAULT_PHONE_ZONE)
