import { describe, expect, it } from 'vitest'
import { ageLabel, chipKind, clockTime } from './syncAge'

const at = (iso: string) => new Date(iso)

describe('clockTime', () => {
  it('formats morning, afternoon, noon and midnight in a given zone', () => {
    expect(clockTime(at('2027-03-21T09:14:00Z'), 'UTC')).toBe('9:14 am')
    expect(clockTime(at('2027-03-21T15:05:00Z'), 'UTC')).toBe('3:05 pm')
    expect(clockTime(at('2027-03-21T12:00:00Z'), 'UTC')).toBe('12:00 pm')
    expect(clockTime(at('2027-03-21T00:00:00Z'), 'UTC')).toBe('12:00 am')
  })

  it('shifts with the time zone (Florida is on daylight time from 14 March 2027)', () => {
    expect(clockTime(at('2027-03-21T13:00:00Z'), 'America/New_York')).toBe('9:00 am')
    expect(clockTime(at('2027-03-21T13:00:00Z'), 'America/Belize')).toBe('7:00 am')
  })
})

describe('ageLabel', () => {
  const updated = at('2027-03-21T09:14:00Z')

  it('says just now within a minute', () => {
    expect(ageLabel(updated, at('2027-03-21T09:14:50Z'), 'live', 'UTC')).toEqual({ kind: 'justNow' })
  })

  it('gives the update time when older', () => {
    expect(ageLabel(updated, at('2027-03-21T10:00:00Z'), 'live', 'UTC')).toEqual({ kind: 'updatedAt', time: '9:14 am' })
  })

  it('says the copy is saved when offline, however recent', () => {
    expect(ageLabel(updated, at('2027-03-21T09:14:10Z'), 'offline', 'UTC')).toEqual({ kind: 'offlineSince', time: '9:14 am' })
  })
})

describe('chipKind (MNG-03)', () => {
  const base = { state: 'live' as const, updated: new Date(0), now: new Date(0), pending: 0 }
  // proves: MNG-03#1, MNG-03#2
  it('tells current, stale, pending, unavailable and not linked apart', () => {
    expect(chipKind(base)).toBe('current')
    expect(chipKind({ ...base, state: 'offline' })).toBe('stale')
    expect(chipKind({ ...base, pending: 2 })).toBe('pending')
    expect(chipKind({ ...base, lookup: 'unavailable' })).toBe('unavailable')
    expect(chipKind({ ...base, lookup: 'notLinked' })).toBe('notLinked')
  })
  it('never shows a failed lookup as no cruise, even with changes waiting', () => {
    expect(chipKind({ ...base, pending: 3, lookup: 'unavailable' })).toBe('unavailable')
  })
})
