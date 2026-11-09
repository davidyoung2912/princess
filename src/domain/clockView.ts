import { hoursBetween, threeClocks, type ClockReading } from './clock'
import { PORTS, portAt, shipClockChanges, shipZoneAt, type Sailing } from './sailings'

export interface ClockView {
  readings: ClockReading[]
  /** Port minus ship, in hours, or null at sea. */
  portVsShip: number | null
  phoneVsShip: number
}

/** The three clocks for a sailing at a moment: ship time, local port time (in port only) and the phone's zone (POR-11). */
export function clockView(sailing: Sailing, at: number, phoneZone: string): ClockView {
  const { port } = portAt(sailing, at)
  const portZone = port === 'sea' ? null : PORTS[port].zone
  const readings = threeClocks(at, { ship: shipZoneAt(sailing, at), port: portZone, phone: phoneZone })
  const ship = readings[0]
  const portReading = readings.find((r) => r.kind === 'port')
  const phone = readings.find((r) => r.kind === 'phone')!
  return { readings, portVsShip: portReading ? hoursBetween(ship, portReading) : null, phoneVsShip: hoursBetween(ship, phone) }
}

const DAY = 24 * 3_600_000

/** A ship clock change within a day either side of now (MOB-14): the hours the clocks moved, and whether it is still to come. Null when none is near. */
export function zoneChangeNear(sailing: Sailing, at: number): { hours: number; upcoming: boolean } | null {
  const c = shipClockChanges(sailing).find((x) => Math.abs(x.at - at) <= DAY)
  return c ? { hours: c.hours, upcoming: c.at > at } : null
}
