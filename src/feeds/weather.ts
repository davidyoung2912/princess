import { CONDITIONS, type Condition, type ShipWeather, type WeatherDay, type WeatherNow } from '../domain/weather'
import { COMPASS_POINTS, type CompassPoint } from '../domain/navigation'
import { MAX_PLAN_DAY } from '../domain/nightsRules'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const compass = (v: unknown): v is CompassPoint => oneOf(v, COMPASS_POINTS)
const condition = (v: unknown): v is Condition => oneOf(v, CONDITIONS)
const DATE = /^\d{4}-\d{2}-\d{2}$/

function normalizeNow(r: unknown): WeatherNow | null {
  if (!isRecord(r)) return null
  if (!condition(r.condition) || typeof r.daylight !== 'boolean' || !num(r.tempC, -60, 60) || !num(r.feelsLikeC, -80, 80) || !isInt(r.humidityPercent, 0, 100)) return null
  if (!isInt(r.windKnots, 0, 150) || !isInt(r.gustKnots, 0, 200) || !compass(r.windFrom) || !isInt(r.pressureHpa, 850, 1100) || !num(r.visibilityKm, 0, 100)) return null
  if (!isInt(r.uvIndex, 0, 16) || !isInt(r.cloudPercent, 0, 100) || !isInt(r.rainChancePercent, 0, 100)) return null
  return {
    condition: r.condition, daylight: r.daylight, tempC: r.tempC, feelsLikeC: r.feelsLikeC, humidityPercent: r.humidityPercent, windKnots: r.windKnots, gustKnots: r.gustKnots,
    windFrom: r.windFrom, pressureHpa: r.pressureHpa, visibilityKm: r.visibilityKm, uvIndex: r.uvIndex, cloudPercent: r.cloudPercent, rainChancePercent: r.rainChancePercent,
  }
}

function normalizeDay(r: unknown): WeatherDay | null {
  if (!isRecord(r)) return null
  if (!isInt(r.day, 1, MAX_PLAN_DAY) || typeof r.date !== 'string' || !DATE.test(r.date) || typeof r.place !== 'string' || r.place.length === 0 || r.place.length > 40) return null
  if (!condition(r.condition) || !isInt(r.highC, -60, 60) || !isInt(r.lowC, -60, 60) || !isInt(r.rainChancePercent, 0, 100) || !isInt(r.windKnots, 0, 150)) return null
  if (!compass(r.windFrom) || !num(r.waveM, 0, 30) || !isInt(r.uvIndex, 0, 16) || !isInt(r.cloudPercent, 0, 100)) return null
  return {
    day: r.day, date: r.date, place: r.place, condition: r.condition, highC: r.highC, lowC: r.lowC, rainChancePercent: r.rainChancePercent, windKnots: r.windKnots,
    windFrom: r.windFrom, waveM: r.waveM, uvIndex: r.uvIndex, cloudPercent: r.cloudPercent,
  }
}

/** Reads the server's weather: all or nothing, at most seven forecast days and no repeated day. */
export function normalizeWeather(raw: unknown): ShipWeather | null {
  if (!isRecord(raw) || !num(raw.now, 0, 5e12) || !num(raw.lat, -90, 90) || !num(raw.lon, -180, 180)) return null
  if (raw.day !== null && !isInt(raw.day, 1, MAX_PLAN_DAY)) return null
  if (typeof raw.place !== 'string' || raw.place.length === 0 || raw.place.length > 40) return null
  const current = normalizeNow(raw.current)
  if (!current || !Array.isArray(raw.forecast) || raw.forecast.length > 7) return null
  const forecast: WeatherDay[] = []
  for (const r of raw.forecast) {
    const d = normalizeDay(r)
    if (!d || forecast.some((x) => x.day === d.day)) return null
    forecast.push(d)
  }
  return { now: raw.now, lat: raw.lat, lon: raw.lon, day: raw.day as number | null, place: raw.place, current, forecast }
}

type Key = [sailing: string, hour: number]

/** The weather at the ship and the days ahead, for a sailing at a whole hour (it changes slowly). Not kept on the device. */
export const weatherFeed = createFeed<Key, ShipWeather>((d, h) => `${d}|${h}`, normalizeWeather)
