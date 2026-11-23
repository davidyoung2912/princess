import { describe, expect, it } from 'vitest'
import type { DayShape } from '../../../domain/dayKinds'
import { resolveHours } from './hours'
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
    expect(r.windows).toEqual([['00:00', '24:00']])
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
