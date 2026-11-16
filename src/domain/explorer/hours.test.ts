import { describe, expect, it } from 'vitest'
import type { DayShape } from '../dayKinds'
import { hoursStatus, isAllDay, resolveHours } from './hours'
import type { HoursRule } from './types'

// A 7-night week: embark, sea, port, port, sea, port, sea, then disembark.
const days: DayShape[] = ['home', 'sea', 'a', 'b', 'sea', 'c', 'sea', 'home'].map((port, i) => ({ port, date: `2027-03-${String(21 + i).padStart(2, '0')}` }))

const shop: HoursRule[] = [
  { kind: 'sailaway', when: ['port', 'embark'], afterMinutes: 45, until: '22:00' },
  { kind: 'fixed', when: ['sea'], windows: [['09:30', '22:00']] },
]
const gym: HoursRule[] = [{ kind: 'fixed', when: ['night'], windows: [['00:00', '24:00']], staffed: [['07:00', '20:00']] }]

describe('resolveHours', () => {
  it('opens a shop 45 minutes after sailaway on a port day', () => {
    expect(resolveHours(shop, days, 3, '17:00').windows).toEqual([['17:45', '22:00']])
  })
  it('opens on embarkation day after sailaway too, and a sea day by the fixed windows', () => {
    expect(resolveHours(shop, days, 1, '16:00').windows).toEqual([['16:45', '22:00']])
    expect(resolveHours(shop, days, 2, null).windows).toEqual([['09:30', '22:00']])
  })
  it('is closed all day alongside when no sailing time is known', () => {
    expect(resolveHours(shop, days, 3, null)).toEqual({ windows: [], staffed: [], closedBecause: 'alongside' })
  })
  it('is closed when sailing is too late for the venue to open', () => {
    expect(resolveHours(shop, days, 3, '21:30').windows).toEqual([])
  })
  it('is closed, never open, when no rule matches', () => {
    expect(resolveHours(shop, days, 8, null)).toEqual({ windows: [], staffed: [], closedBecause: 'none' })
  })
  it('carries staffed hours for a 24-hour gym', () => {
    const r = resolveHours(gym, days, 4, '17:00')
    expect(isAllDay(r.windows)).toBe(true)
    expect(r.staffed).toEqual([['07:00', '20:00']])
  })
  it('puts windows in time order', () => {
    const rule: HoursRule[] = [{ kind: 'fixed', when: ['night'], windows: [['17:30', '21:30'], ['07:00', '09:30']] }]
    expect(resolveHours(rule, days, 2, null).windows[0][0]).toBe('07:00')
  })
  it('honours an explicit closed rule', () => {
    expect(resolveHours([{ kind: 'closed', when: ['port'] }], days, 3, '17:00').closedBecause).toBe('alongside')
  })
})

describe('hoursStatus', () => {
  const w = [['07:00', '09:30'], ['17:30', '21:30']] as const
  it('is open inside a window, with when it closes', () => {
    expect(hoursStatus(w, '08:00')).toEqual({ state: 'open', closesAt: '09:30' })
  })
  it('opens at the start and closes at the end of a window', () => {
    expect(hoursStatus(w, '07:00').state).toBe('open')
    expect(hoursStatus(w, '09:30').state).toBe('closed')
  })
  it('says when it next opens today', () => {
    expect(hoursStatus(w, '12:00')).toEqual({ state: 'closed', opensAt: '17:30' })
    expect(hoursStatus(w, '22:00')).toEqual({ state: 'closed' })
  })
  it('is unavailable whatever the hours say', () => {
    expect(hoursStatus(w, '08:00', true)).toEqual({ state: 'unavailable' })
  })
})
