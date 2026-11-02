import { type FlightState, type FlightStatus } from '../domain/journey'
import { createFeed } from './feed'

const STATES: readonly FlightState[] = ['onTime', 'delayed', 'cancelled']

/** Reads the server's answer; anything wrong in it gives null. */
export function normalizeFlightStatus(raw: unknown): FlightStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!(STATES as readonly unknown[]).includes(r.state)) return null
  const minutes = typeof r.delayMinutes === 'number' && Number.isFinite(r.delayMinutes) ? Math.max(0, Math.round(r.delayMinutes)) : 0
  return { state: r.state as FlightState, delayMinutes: r.state === 'delayed' ? minutes : 0 }
}

/** A flight's status by normalised flight number and date. */
export const flightFeed = createFeed<[number: string, date: string], FlightStatus>((n, d) => `${n}|${d}`, normalizeFlightStatus, 'flight')
