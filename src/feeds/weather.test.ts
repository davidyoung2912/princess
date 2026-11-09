import { describe, expect, it } from 'vitest'
import { normalizeWeather } from './weather'
import { chartRange, pressureText, tempText, uvBand, weekdayOf } from '../domain/weather'

const day = (n: number) => ({ day: n, date: `2027-03-${20 + n}`, place: 'sea', condition: 'sunny', highC: 30, lowC: 26, rainChancePercent: 10, windKnots: 12, windFrom: 'E', waveM: 1.1, uvIndex: 11, cloudPercent: 10 })
const good = {
  now: 1_800_000_000_000, lat: 24.5, lon: -81, day: 2, place: 'sea',
  current: { condition: 'partlyCloudy', daylight: true, tempC: 28.5, feelsLikeC: 31, humidityPercent: 70, windKnots: 12, gustKnots: 16, windFrom: 'ENE', pressureHpa: 1014, visibilityKm: 26, uvIndex: 9, cloudPercent: 40, rainChancePercent: 15 },
  forecast: [day(2), day(3)],
}

describe('weather feed', () => {
  it('reads a good answer', () => {
    const w = normalizeWeather(good)
    expect(w?.forecast).toHaveLength(2)
    expect(w?.current.condition).toBe('partlyCloudy')
  })
  it('rejects a bad condition, a repeated day, too many days and a bad figure', () => {
    expect(normalizeWeather({ ...good, current: { ...good.current, condition: 'snow' } })).toBeNull()
    expect(normalizeWeather({ ...good, forecast: [day(2), day(2)] })).toBeNull()
    expect(normalizeWeather({ ...good, forecast: [1, 2, 3, 4, 5, 6, 7, 8].map(day) })).toBeNull()
    expect(normalizeWeather({ ...good, current: { ...good.current, humidityPercent: 140 } })).toBeNull()
    expect(normalizeWeather(null)).toBeNull()
  })
  it('accepts a sailing with no days left', () => {
    expect(normalizeWeather({ ...good, forecast: [] })?.forecast).toEqual([])
  })
})

describe('weather units and bands', () => {
  it('shows temperature and pressure in the guest unit', () => {
    expect(tempText(30, 'metric')).toBe('30°C')
    expect(tempText(30, 'imperial')).toBe('86°F')
    expect(pressureText(1013, 'metric')).toBe('1013 hPa')
    expect(pressureText(1013, 'imperial')).toBe('29.91 inHg')
  })
  it('bands the UV index', () => {
    expect([0, 3, 6, 9, 12].map(uvBand)).toEqual(['low', 'moderate', 'high', 'veryHigh', 'extreme'])
  })
  it('names the weekday of a ship date whatever zone the guest is in', () => {
    expect(weekdayOf('2027-03-22', 'en')).toBe('Mon')
  })
  it('pads the chart range and copes with no days', () => {
    expect(chartRange([], 'metric')).toEqual({ min: 0, max: 1 })
    expect(chartRange([{ ...day(1), highC: 30, lowC: 25 } as never], 'metric')).toEqual({ min: 24, max: 31 })
  })
})
