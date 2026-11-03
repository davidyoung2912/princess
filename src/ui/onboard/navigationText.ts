import { PORTS } from '../../domain/sailings'
import { degrees, speedParts } from '../../domain/navigation'
import type { ShipPosition, StopId } from '../../domain/navigation'
import type { Units } from '../../domain/readiness'
import { t, type StringKey } from '../../i18n'

export const portName = (id: StopId): string => PORTS[id].name

export const compassWord = (p: string): string => t(`nav.compass.${p}` as StringKey)

/** Latitude and longitude in degrees with the hemisphere in the guest's language. */
export function coordinates(lat: number, lon: number): string {
  return t('nav.coords', { lat: degrees(lat), ns: lat >= 0 ? t('nav.n') : t('nav.s'), lon: degrees(lon), ew: lon >= 0 ? t('nav.e') : t('nav.w') })
}

/** One line for the ship, used on the Where screen and in the ship news summary. */
export function positionLine(p: ShipPosition, units: Units): string {
  if (p.inPort) return p.nextPort ? t('nav.where.alongside', { port: portName(p.inPort) }) : t('nav.where.ended')
  return t('nav.where.atSea', { compass: compassWord(p.compass), knots: speedParts(p.speedKnots, units).knots })
}

