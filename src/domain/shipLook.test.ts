import { describe, expect, it } from 'vitest'
import { aboardRingFraction, aboardTone, dayLook, heroEffect, nextCall, phaseOfDay, routePercent, sailAwayPhase, seaState } from './shipLook'
import { zonedToEpoch } from './timezones'

const Z = 'America/New_York'
const at = (time: string) => zonedToEpoch('2027-03-22', time, Z)
const sun = { sunrise: '06:14', sunset: '18:40' }

describe('phaseOfDay', () => {
  it('finds sunrise, day, sunset and night', () => {
    expect(phaseOfDay(at('06:00'), '2027-03-22', Z, sun)).toEqual({ phase: 'sunrise', minutes: 14 })
    expect(phaseOfDay(at('12:00'), '2027-03-22', Z, sun).phase).toBe('day')
    expect(phaseOfDay(at('18:20'), '2027-03-22', Z, sun)).toEqual({ phase: 'sunset', minutes: 20 })
    expect(phaseOfDay(at('23:30'), '2027-03-22', Z, sun).phase).toBe('night')
    expect(phaseOfDay(at('04:00'), '2027-03-22', Z, sun).phase).toBe('night')
  })
  it('treats exactly 45 minutes as still the twilight', () => {
    expect(phaseOfDay(at('05:29'), '2027-03-22', Z, sun).phase).toBe('sunrise')
    expect(phaseOfDay(at('05:28'), '2027-03-22', Z, sun).phase).toBe('night')
  })
})

describe('seaState and heroEffect', () => {
  it('steps the sea by wave height', () => {
    expect([0.2, 0.8, 1.8, 3].map(seaState)).toEqual(['calm', 'slight', 'moderate', 'rough'])
  })
  it('picks one effect, rain first', () => {
    expect(heroEffect('storm', 'rough', true)).toBe('rain')
    expect(heroEffect('sunny', 'rough', true)).toBe('spray')
    expect(heroEffect('partlyCloudy', 'calm', true)).toBe('cloud')
    expect(heroEffect('sunny', 'calm', true)).toBe('glint')
    expect(heroEffect('sunny', 'calm', false)).toBe('none')
    expect(heroEffect('sunny', 'slight', true)).toBe('none')
  })
})

describe('day look', () => {
  it('names the kind of day', () => {
    expect(dayLook(1, 8, 'miami')).toBe('embark')
    expect(dayLook(8, 8, 'miami')).toBe('disembark')
    expect(dayLook(3, 8, 'sea')).toBe('sea')
    expect(dayLook(4, 8, 'cozumel')).toBe('port')
  })
  it('finds the next call and the route percent', () => {
    const days = [{ day: 1, port: 'a' }, { day: 2, port: 'sea' }, { day: 3, port: 'b' }, { day: 4, port: 'a' }]
    expect(nextCall(days, 2)).toBe('b')
    expect(nextCall(days, 3)).toBeNull()
    expect(routePercent(1, 4)).toBe(0)
    expect(routePercent(4, 4)).toBe(100)
    expect(routePercent(1, 1)).toBe(0)
  })
})

describe('all-aboard tone and sail-away', () => {
  it('turns amber then red', () => {
    expect([200, 120, 31, 30, 0].map(aboardTone)).toEqual(['calm', 'amber', 'amber', 'red', 'red'])
    expect(aboardRingFraction(120)).toBe(0)
    expect(aboardRingFraction(60)).toBe(0.5)
    expect(aboardRingFraction(-5)).toBe(1)
  })
  it('shows the sail-away card an hour before and two hours after', () => {
    const s = at('15:00')
    expect(sailAwayPhase(s - 90 * 60_000, s)).toBeNull()
    expect(sailAwayPhase(s - 30 * 60_000, s)).toBe('soon')
    expect(sailAwayPhase(s + 10 * 60_000, s)).toBe('underway')
    expect(sailAwayPhase(s + 130 * 60_000, s)).toBeNull()
    expect(sailAwayPhase(s, null)).toBeNull()
  })
})
