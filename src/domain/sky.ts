import { HEADINGS, sunSide } from './cabinScore'
import { itinerary, PORTS, shipZoneOnDate, type PortId, type Sailing } from './sailings'
import { timeIn, zonedToEpoch } from './timezones'

/**
 * Sun, moon and stars guide (S6-07). The sun and moon are worked out from the date and an authored position for each day, so they are close,
 * not survey-grade; every reading says `source: 'sim'`. Planets are not shown (there is no ephemeris feed). Pure.
 */
export const POSITIONS: Record<number, { lat: number; lon: number }> = {
  1: { lat: 26.1, lon: -80.1 }, 2: { lat: 24.5, lon: -84.5 }, 3: { lat: 20.5, lon: -86.9 }, 4: { lat: 17.5, lon: -88.2 },
  5: { lat: 16.3, lon: -86.5 }, 6: { lat: 20.5, lon: -85 }, 7: { lat: 24.5, lon: -82 }, 8: { lat: 26.1, lon: -80.1 },
}

const RAD = Math.PI / 180
const dayOfYear = (date: string): number => Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${date.slice(0, 4)}-01-01T00:00:00Z`)) / 86_400_000) + 1

/** Sunrise and sunset as epoch ms for a date at a position (approximate solar formulae). */
export function sunTimes(date: string, lat: number, lon: number): { sunrise: number; sunset: number } {
  const n = dayOfYear(date)
  const decl = 23.44 * Math.sin(RAD * (360 / 365) * (n - 81))
  const b = RAD * (360 / 364) * (n - 81)
  const eotMin = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  const h = Math.acos(Math.max(-1, Math.min(1, (Math.sin(RAD * -0.833) - Math.sin(RAD * lat) * Math.sin(RAD * decl)) / (Math.cos(RAD * lat) * Math.cos(RAD * decl))))) / RAD / 15
  const noonUtcH = 12 - lon / 15 - eotMin / 60
  const base = Date.parse(`${date}T00:00:00Z`)
  return { sunrise: Math.round(base + (noonUtcH - h) * 3_600_000), sunset: Math.round(base + (noonUtcH + h) * 3_600_000) }
}

const SYNODIC = 29.530588853
const NEW_MOON = Date.parse('2000-01-06T18:14:00Z')

export type MoonPhase = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent'
export const PHASE_NAMES: Record<MoonPhase, string> = {
  new: 'New moon', waxingCrescent: 'Waxing crescent', firstQuarter: 'First quarter', waxingGibbous: 'Waxing gibbous',
  full: 'Full moon', waningGibbous: 'Waning gibbous', lastQuarter: 'Last quarter', waningCrescent: 'Waning crescent',
}

/** Age in days since the new moon, and the phase name, at a moment. */
export function moonAt(epoch: number): { age: number; phase: MoonPhase; lit: number } {
  const age = (((epoch - NEW_MOON) / 86_400_000) % SYNODIC + SYNODIC) % SYNODIC
  const f = age / SYNODIC
  const phase: MoonPhase = (['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'] as const)[Math.floor(f * 8 + 0.5) % 8]
  return { age, phase, lit: Math.round(((1 - Math.cos(2 * Math.PI * f)) / 2) * 100) }
}

/** Constellations that are easy to find after dark in the northern tropics, by month (0 = January). Authored. */
const SEASON: readonly (readonly string[])[] = [
  ['Orion', 'Taurus', 'Gemini'], ['Orion', 'Gemini', 'Leo'], ['Leo', 'Gemini', 'Ursa Major'], ['Leo', 'Virgo', 'Ursa Major'],
  ['Virgo', 'Bootes', 'Scorpius'], ['Scorpius', 'Sagittarius', 'Southern Cross low in the south'], ['Scorpius', 'Sagittarius', 'Cygnus'], ['Sagittarius', 'Cygnus', 'Aquila'],
  ['Cygnus', 'Pegasus', 'Aquila'], ['Pegasus', 'Andromeda', 'Cassiopeia'], ['Taurus', 'Pegasus', 'Cassiopeia'], ['Orion', 'Taurus', 'Gemini'],
]

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

export function skyNight(sailing: Sailing, day: number): SkyNight {
  const d = itinerary(sailing)[day - 1]
  const pos = POSITIONS[day]
  const zone = shipZoneOnDate(sailing, d.date)
  const { sunrise, sunset } = sunTimes(d.date, pos.lat, pos.lon)
  const moon = moonAt(sunset)
  const sail = d.depart ?? null
  const sailAt = sail ? zonedToEpoch(d.date, sail, d.port === 'sea' || d.port === 'fll' ? zone : PORTS[d.port].zone) : null
  return {
    day, port: d.port, sunrise: timeIn(sunrise, zone), sunset: timeIn(sunset, zone), sunsetAt: sunset,
    moon: { phase: moon.phase, name: PHASE_NAMES[moon.phase], lit: moon.lit },
    // Sun azimuth near sunset is about 255 to 290 degrees; the 'afternoon' side is the same side as the evening.
    sunsetSide: sunSide(HEADINGS[day].heading, 'afternoon'),
    sailAway: sail, sailAwayAtSunset: sailAt !== null && sailAt <= sunset + 45 * 60_000 && sailAt >= sunset - 90 * 60_000,
    stars: SEASON[Number(d.date.slice(5, 7)) - 1],
    darkSky: moon.lit < 70,
    source: 'sim',
  }
}

/** The best place to watch from, in words. */
export function bestSpot(n: SkyNight): string {
  const side = n.sunsetSide === 'neither' ? 'either side, the sun sets behind or ahead of the ship' : `the ${n.sunsetSide} side`
  const stars = n.darkSky ? ' For stars, the darkest places are the top open decks, away from deck lights, after the last show.' : ' The moon is bright tonight, so fewer stars; the moon on the water is the sight.'
  return `For the sunset, ${side}, on an open deck.${stars}`
}
