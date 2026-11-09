import { describe, expect, it } from 'vitest'
import { dueReminders, undismissed } from './localReminders'
import type { CountdownInput } from './countdowns'

const NOW = Date.UTC(2027, 0, 10, 15)
const trip = (over: Partial<CountdownInput> = {}): CountdownInput => ({
  payment: 'upcoming',
  plan: { finalDue: '2027-01-14' },
  checkin: { state: 'done', opensAt: NOW - 86_400_000 },
  daysToDeparture: 30,
  ...over,
})

// proves: MOB-23#1, MOB-23#2
describe('local reminders', () => {
  it('shows a payment reminder in the last week and not before', () => {
    expect(dueReminders({ trip: trip(), allAboardAt: null }, NOW).map((r) => r.kind)).toEqual(['pay'])
    expect(dueReminders({ trip: trip({ plan: { finalDue: '2027-02-20' } }), allAboardAt: null }, NOW)).toEqual([])
  })

  it('shows the all-aboard reminder at the nearest passed threshold, and none after the deadline', () => {
    const at = NOW + 25 * 60_000
    const r = dueReminders({ trip: null, allAboardAt: at }, NOW)
    expect(r).toHaveLength(1)
    expect(r[0].key).toBe(`allAboard:${at}:30`)
    expect(dueReminders({ trip: null, allAboardAt: NOW - 1 }, NOW)).toEqual([])
    expect(dueReminders({ trip: null, allAboardAt: NOW + 3 * 3_600_000 }, NOW)).toEqual([])
  })

  it('flags an overdue payment as urgent', () => {
    const r = dueReminders({ trip: trip({ payment: 'overdue' }), allAboardAt: null }, NOW)
    expect(r.some((x) => x.urgent && x.kind === 'pay')).toBe(true)
  })

  it('does not show a reminder the guest dismissed', () => {
    const all = dueReminders({ trip: trip(), allAboardAt: null }, NOW)
    expect(undismissed(all, [all[0].key])).toEqual([])
  })
})
