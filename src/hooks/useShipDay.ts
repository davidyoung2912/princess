import { useNow, useSailing } from './useDemo'
import { portAt, shipZoneAt } from '../domain/sailings'
import type { DayType } from '../domain/menus'

/** Whether the ship is at a port or at sea decides which hours apply, plus the ship's clock as "HH:MM". */
export function useShipDay(): { day: DayType; time: string } {
  const sailing = useSailing()
  const now = useNow()
  const time = new Date(now).toLocaleTimeString('en-GB', { timeZone: shipZoneAt(sailing, now), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return { day: portAt(sailing, now).port === 'sea' ? 'sea' : 'port', time }
}
