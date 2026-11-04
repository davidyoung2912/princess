import { type MoonPhase, type SkyNight, PHASE_NAMES } from '../domain/sky'
import type { PortId } from '../domain/sailings'
import { createFeed, isInt, isRecord, oneOf } from './feed'
import { MAX_PLAN_DAY } from '../domain/nightsRules'

const PHASES = Object.keys(PHASE_NAMES) as MoonPhase[]
const PORT_IDS: readonly PortId[] = ['fll', 'sea', 'cozumel', 'belize', 'roatan']
const SIDES = ['port', 'starboard', 'neither'] as const
const HHMM = /^\d{2}:\d{2}$/

/** Reads the server's sun, moon and stars for a day; anything wrong in it gives null so nothing is shown. */
export function normalizeSkyNight(raw: unknown): SkyNight | null {
  if (!isRecord(raw) || !isInt(raw.day, 1, MAX_PLAN_DAY) || !oneOf(raw.port, PORT_IDS) || !oneOf(raw.sunsetSide, SIDES)) return null
  const m = raw.moon
  if (typeof raw.sunrise !== 'string' || !HHMM.test(raw.sunrise) || typeof raw.sunset !== 'string' || !HHMM.test(raw.sunset) || !Number.isFinite(raw.sunsetAt)) return null
  if (!isRecord(m) || !oneOf(m.phase, PHASES) || !isInt(m.lit, 0, 100)) return null
  const sail = raw.sailAway
  if (sail !== null && (typeof sail !== 'string' || !HHMM.test(sail))) return null
  for (const k of ['firstLight', 'lastLight', 'darkAt'] as const) if (typeof raw[k] !== 'string' || !HHMM.test(raw[k] as string)) return null
  if (typeof raw.sailAwayAtSunset !== 'boolean' || typeof raw.darkSky !== 'boolean') return null
  if (!Array.isArray(raw.stars) || raw.stars.length === 0 || raw.stars.length > 6 || !raw.stars.every((s) => typeof s === 'string' && s.length > 0 && s.length < 60)) return null
  return {
    day: raw.day, port: raw.port, sunrise: raw.sunrise, sunset: raw.sunset, sunsetAt: raw.sunsetAt as number,
    moon: { phase: m.phase, name: PHASE_NAMES[m.phase], lit: m.lit }, sunsetSide: raw.sunsetSide, sailAway: sail as string | null,
    sailAwayAtSunset: raw.sailAwayAtSunset, stars: raw.stars as string[], darkSky: raw.darkSky,
    firstLight: raw.firstLight as string, lastLight: raw.lastLight as string, darkAt: raw.darkAt as string,
  }
}

/** The sun, moon and stars for a cruise day on a sailing (by departure date). */
export const skyNightFeed = createFeed<[departure: string, day: number], SkyNight>((d, n) => `${d}|${n}`, normalizeSkyNight, 'sky-night')
