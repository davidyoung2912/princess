import { describe, expect, it } from 'vitest'
import type { DayShape } from '../../../domain/dayKinds'
import { templateIndexFor, type TemplateDayKind } from './dayMapping'

const mk = (ports: string[]): DayShape[] => ports.map((port, i) => ({ port, date: `2027-03-${String(10 + i).padStart(2, '0')}` }))
// The doc's 7-day week: embark, sea, port, port, sea, port, last night.
const T: TemplateDayKind[] = ['embark', 'sea', 'port', 'port', 'sea', 'port', 'last']
const map = (days: DayShape[]) => days.map((_, i) => templateIndexFor(days, i + 1, T))

describe('templateIndexFor', () => {
  it('maps the 7-night reference week onto itself, and the disembark morning to nothing', () => {
    const week = mk(['home', 'sea', 'a', 'b', 'sea', 'c', 'sea', 'home'])
    // Day 7 is the last night (a sea day in this week): it takes the template's last day. Day 8 is the morning of arrival.
    expect(map(week)).toEqual([0, 1, 2, 3, 4, 5, 6, null])
  })
  it('uses embarkation, the last night and disembarkation the same way on a 3-night sailing', () => {
    expect(map(mk(['home', 'sea', 'a', 'home']))).toEqual([0, 1, 6, null])
  })
  it('wraps round on a long sailing, taking sea days and port days in turn', () => {
    const long = mk(['home', 'sea', 'a', 'b', 'sea', 'c', 'd', 'sea', 'e', 'f', 'sea', 'g', 'sea', 'home'])
    // Sea days (2, 5, 8, 11) take template sea days 1, 4, 1, 4; port days (3, 4, 6, 7, 9, 10) take 2, 3, 5, 2, 3, 5; day 12 is the last night.
    expect(map(long)).toEqual([0, 1, 2, 3, 4, 5, 2, 1, 3, 5, 4, 2, 6, null])
  })
  it('borrows the other kind when the template has none of one', () => {
    const seaOnly: TemplateDayKind[] = ['embark', 'sea', 'last']
    const days = mk(['home', 'a', 'b', 'sea', 'home'])
    expect(templateIndexFor(days, 2, seaOnly)).toBe(1)
    expect(templateIndexFor(days, 3, seaOnly)).toBe(1)
  })
  it('returns null for days outside the sailing or an empty template', () => {
    const days = mk(['home', 'sea', 'home'])
    expect(templateIndexFor(days, 0, T)).toBeNull()
    expect(templateIndexFor(days, 4, T)).toBeNull()
    expect(templateIndexFor(days, 1, [])).toBeNull()
  })
  it('gives embarkation priority on a one-night sailing', () => {
    expect(map(mk(['home', 'home']))).toEqual([0, null])
  })
})
