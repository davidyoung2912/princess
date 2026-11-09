import { describe, expect, it } from 'vitest'
import { countdowns, type CountdownInput } from './countdowns'

const at = (date: string) => Date.parse(`${date}T15:00:00Z`)
const trip = (over: Partial<CountdownInput> = {}): CountdownInput => ({
  payment: 'upcoming', plan: { finalDue: '2027-01-20' }, checkin: { state: 'notOpen', opensAt: at('2027-03-18') }, daysToDeparture: 40, ...over,
})

describe('countdowns', () => {
  it('counts days to boarding, to the final payment and to check-in from now', () => {
    expect(countdowns(trip(), at('2027-01-10'))).toEqual([
      { id: 'boarding', days: 40, date: '2027-02-19', zone: 'America/New_York', source: 'sailing' },
      { id: 'pay', days: 10, date: '2027-01-20', zone: 'America/New_York', source: 'booking' },
      { id: 'checkin', days: 67, date: '2027-03-18', zone: 'America/New_York', source: 'schedule' },
    ])
  })
  it('moves with the date', () => {
    expect(countdowns(trip(), at('2027-01-19')).find((c) => c.id === 'pay')?.days).toBe(1)
  })
  it('drops the payment countdown once paid or overdue', () => {
    expect(countdowns(trip({ payment: 'paid' }), at('2027-01-10')).some((c) => c.id === 'pay')).toBe(false)
    expect(countdowns(trip({ payment: 'overdue' }), at('2027-01-25')).some((c) => c.id === 'pay')).toBe(false)
  })
  it('drops check-in once it is open, and boarding once sailed', () => {
    const open = countdowns(trip({ checkin: { state: 'open', opensAt: at('2027-03-18') } }), at('2027-03-19'))
    expect(open.some((c) => c.id === 'checkin')).toBe(false)
    expect(countdowns(trip({ daysToDeparture: -1 }), at('2027-03-22')).some((c) => c.id === 'boarding')).toBe(false)
  })
})
