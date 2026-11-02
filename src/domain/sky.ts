import type { PortId } from './sailings'

/**
 * Sun, moon and stars guide (S6-07): the shapes the server answers with (`GET /feeds/sky-night`) and the words for where to watch.
 * The sun, moon and stars are worked out on the server; nothing here calculates them.
 */

export type MoonPhase = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent'
export const PHASE_NAMES: Record<MoonPhase, string> = {
  new: 'New moon', waxingCrescent: 'Waxing crescent', firstQuarter: 'First quarter', waxingGibbous: 'Waxing gibbous',
  full: 'Full moon', waningGibbous: 'Waning gibbous', lastQuarter: 'Last quarter', waningCrescent: 'Waning crescent',
}

export interface SkyNight {
  day: number
  port: PortId
  /** Local ship time, "HH:MM". */
  sunrise: string
  sunset: string
  /** Epoch ms of the sunset. */
  sunsetAt: number
  moon: { phase: MoonPhase; name: string; lit: number }
  /** Which side of the ship faces the sunset, or none when it is behind. */
  sunsetSide: 'port' | 'starboard' | 'neither'
  /** Sail-away time that day, in the port's local time, when the ship leaves a port. */
  sailAway: string | null
  /** True when the sun sets after the ship has left, so sail-away is a sunset show. */
  sailAwayAtSunset: boolean
  stars: readonly string[]
  /** Dark enough for stars: the moon is not near full. */
  darkSky: boolean
  source: 'sim'
}

/** The best place to watch from, in words. */
export function bestSpot(n: SkyNight): string {
  const side = n.sunsetSide === 'neither' ? 'either side, the sun sets behind or ahead of the ship' : `the ${n.sunsetSide} side`
  const stars = n.darkSky ? ' For stars, the darkest places are the top open decks, away from deck lights, after the last show.' : ' The moon is bright tonight, so fewer stars; the moon on the water is the sight.'
  return `For the sunset, ${side}, on an open deck.${stars}`
}
