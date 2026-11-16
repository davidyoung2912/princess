import { itinerary, portById, type PortId, type Sailing } from './sailings'
import { clockTime } from './syncAge'
import { zonedToEpoch } from './timezones'
import type { DayOfStage } from './journeyPosition'

/** Where the ship is on a cruise day: at sea, or at a port with the hours it is open to guests (local port time, "8:00 am"). */
export type TripWhere = { kind: 'sea' } | { kind: 'port'; id: PortId; name: string; from: string | null; to: string | null }

export interface TripStatus {
  /** The cruise day, while on board (boarding or at sea or in port). */
  day: number | null
  where: TripWhere | null
  /** Days to boarding or since the cruise, outside the cruise. */
  count: { kind: 'to' | 'since'; days: number } | null
}

/**
 * What the status line under the date says: on board, the cruise day and where the ship is that day; before the cruise, how many days to boarding;
 * after it, how many days since. Nothing for a guest with no trip. Pure, so it is tested in node.
 */
export function tripStatus(sailing: Sailing, day: DayOfStage | null): TripStatus {
  if (!day) return { day: null, where: null, count: null }
  if (day.kind === 'daysToDeparture') return { day: null, where: null, count: { kind: 'to', days: day.days } }
  if (day.kind === 'daysSinceReturn') return { day: null, where: null, count: { kind: 'since', days: day.days } }
  const today = itinerary(sailing).find((d) => d.day === day.day)
  const port = today && today.port !== 'sea' ? portById(today.port) : undefined
  if (!today || !port) return { day: day.day, where: today?.port === 'sea' ? { kind: 'sea' } : null, count: null }
  const at = (hhmm: string | undefined) => (hhmm ? clockTime(new Date(zonedToEpoch(today.date, hhmm, port.zone)), port.zone) : null)
  return { day: day.day, where: { kind: 'port', id: port.id, name: port.name, from: at(today.arrive), to: at(today.depart) }, count: null }
}
