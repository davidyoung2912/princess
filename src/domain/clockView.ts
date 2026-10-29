import { hoursBetween, threeClocks, type ClockReading } from './clock'
import { PORTS, portAt, shipZoneAt, type Sailing } from './sailings'

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
