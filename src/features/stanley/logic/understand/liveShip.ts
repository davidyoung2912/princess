/** The live facts the direct answers may use: the ship clock, the kind of day and the events still to come. Null whenever the sailing is not under way, so nothing is claimed about "now" then. */
import { eventsOn } from '../../../../domain/program'
import { portAt, shipZoneAt, type Sailing } from '../../../../domain/sailings'
import { clockHhmm } from '../stanleyAction'
import type { LiveShip } from './answers'

export function liveShip(sailing: Sailing, now: number): LiveShip | null {
  const at = portAt(sailing, now)
  if (at.day === null) return null
  const upcoming = eventsOn(sailing, at.day, true).filter((e) => e.endAt > now && e.status !== 'cancelled').slice(0, 3).map((e) => ({ title: e.title, start: e.start }))
  return { time: clockHhmm(now, shipZoneAt(sailing, now)), day: at.port === 'sea' ? 'sea' : 'port', upcoming }
}
