import { describe, expect, it } from 'vitest'
import type { PlanDay } from './plan'
import { boardDays, canJoin, withGuest } from './groupBoard'

const day: PlanDay = {
  day: 3, date: '2027-03-23', port: 'cozumel' as never, place: 'Cozumel', gaps: [],
  entries: [
    { kind: 'allAboard', time: '16:00', name: '', guests: [] },
    { kind: 'tour', time: '09:30', name: 'Snorkel', id: 't1', guests: ['ann', 'bo'] },
    { kind: 'tour', time: '11:00', name: 'Beach', id: 't2', guests: ['bo', 'cy'] },
    { kind: 'dinner', time: '19:00', name: 'Crown Grill', id: 'd1', guests: ['ann'] },
  ],
}
const hours = (id: string) => (id === 't1' ? 3 : id === 't2' ? 2 : null)

describe('group plan board', () => {
  const [d] = boardDays([day], hours)

  it('lists only booked tours and dinners', () => {
    expect(d.items.map((i) => i.bookingId)).toEqual(['t1', 't2', 'd1'])
  })

  it('flags each person who is on two things at once', () => {
    expect(d.items[0].clashing).toEqual(['bo'])
    expect(d.items[1].clashing).toEqual(['bo'])
    expect(d.items[2].clashing).toEqual([])
  })

  it('offers Join on a tour they are free for, not one that clashes, one they are on, or a dinner', () => {
    const [snorkel, beach, dinner] = d.items
    expect(canJoin(snorkel, d, 'cy', ['ann', 'bo', 'cy'])).toBe(false)
    expect(canJoin(beach, d, 'ann', ['ann', 'bo', 'cy'])).toBe(false)
    expect(canJoin(beach, d, 'bo', ['ann', 'bo', 'cy'])).toBe(false)
    expect(canJoin(dinner, d, 'cy', ['ann', 'bo', 'cy'])).toBe(false)
    expect(canJoin(snorkel, d, 'dee', ['ann', 'bo', 'cy'])).toBe(false)
    const free = boardDays([{ ...day, entries: [day.entries[1]] }], hours)[0]
    expect(canJoin(free.items[0], free, 'cy', ['ann', 'bo', 'cy'])).toBe(true)
  })

  it('adds a guest once', () => {
    expect(withGuest(['a'], 'b')).toEqual(['a', 'b'])
    expect(withGuest(['a'], 'a')).toEqual(['a'])
  })
})
