import type { CompassPoint } from './navigation'
import type { Units } from './readiness'

/**
 * The weather at the ship and the forecast for the rest of the sailing. Every figure comes from the server (`/feeds/ship-weather`); this module
 * holds the shapes and the plain conversions into a guest's units. Metric on the wire: Celsius, knots, metres, hectopascals, kilometres.
 */
export const CONDITIONS = ['sunny', 'partlyCloudy', 'cloudy', 'showers', 'rain', 'storm'] as const
export type Condition = (typeof CONDITIONS)[number]

export interface WeatherNow {
  condition: Condition
  daylight: boolean
  tempC: number
  feelsLikeC: number
  humidityPercent: number
  windKnots: number
  gustKnots: number
  windFrom: CompassPoint
  pressureHpa: number
  visibilityKm: number
  uvIndex: number
  cloudPercent: number
  rainChancePercent: number
}

export interface WeatherDay {
  /** The cruise day. */
  day: number
  /** The ship's date, "YYYY-MM-DD". */
  date: string
  /** A port id, or "sea". */
  place: string
  condition: Condition
  highC: number
  lowC: number
  rainChancePercent: number
  windKnots: number
  windFrom: CompassPoint
  waveM: number
  uvIndex: number
  cloudPercent: number
}

export interface ShipWeather {
  now: number
  lat: number
  lon: number
  day: number | null
  place: string
  current: WeatherNow
  forecast: WeatherDay[]
}

export const toF = (c: number): number => (c * 9) / 5 + 32

/** A temperature in the guest's unit, whole degrees: "28°C" or "82°F". */
export const tempText = (c: number, units: Units): string => (units === 'metric' ? `${Math.round(c)}°C` : `${Math.round(toF(c))}°F`)

/** The temperature as a bare number in the guest's unit, for drawing. */
export const tempValue = (c: number, units: Units): number => (units === 'metric' ? c : toF(c))

const KMH_PER_KNOT = 1.852
const MPH_PER_KNOT = 1.15078
const MI_PER_KM = 0.621371
const INHG_PER_HPA = 0.02953

export const windText = (knots: number, units: Units): string => `${knots} kn (${units === 'metric' ? `${Math.round(knots * KMH_PER_KNOT)} km/h` : `${Math.round(knots * MPH_PER_KNOT)} mph`})`

export const visibilityText = (km: number, units: Units): string => (units === 'metric' ? `${Math.round(km)} km` : `${Math.round(km * MI_PER_KM)} mi`)

export const pressureText = (hpa: number, units: Units): string => (units === 'metric' ? `${hpa} hPa` : `${(hpa * INHG_PER_HPA).toFixed(2)} inHg`)

/** How strong the sun is: the standard bands of the UV index. */
export const uvBand = (uv: number): 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme' =>
  uv <= 2 ? 'low' : uv <= 5 ? 'moderate' : uv <= 7 ? 'high' : uv <= 10 ? 'veryHigh' : 'extreme'

/** The weekday of a ship date ("Tue"), read as a calendar date so the guest's own zone never moves it. */
export const weekdayOf = (date: string, locale?: string): string => new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })

/** The scale of a temperature chart: the lowest and highest values, padded so the lines do not touch the edges, in the guest's unit. */
export function chartRange(days: readonly WeatherDay[], units: Units): { min: number; max: number } {
  if (days.length === 0) return { min: 0, max: 1 }
  const lows = days.map((d) => tempValue(d.lowC, units))
  const highs = days.map((d) => tempValue(d.highC, units))
  const min = Math.floor(Math.min(...lows)) - 1
  const max = Math.ceil(Math.max(...highs)) + 1
  return { min, max: max > min ? max : min + 1 }
}
