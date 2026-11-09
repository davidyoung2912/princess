import { describe, expect, it } from 'vitest'
import { stampBook, stampBookCard } from './stamps'
import { dailyTrivia, PORT_TRIVIA } from './games'
import type { TripEntry } from './tripDiary'

const days = [
  { day: 1, date: '2027-03-21', port: 'home' },
  { day: 2, date: '2027-03-22', port: 'sea' },
  { day: 3, date: '2027-03-23', port: 'portA' },
  { day: 4, date: '2027-03-24', port: 'portB' },
  { day: 5, date: '2027-03-25', port: 'portA' },
]
const line = (kind: TripEntry['kind'], at: number): TripEntry => ({ id: kind, sailingId: 's', day: 0, at, kind, text: kind, mood: null, auto: true, key: kind })

describe('stamp book', () => {
  it('is empty before anything has happened', () => {
    expect(stampBook(days, 0, [])).toEqual({ earned: [], waiting: expect.any(Array) })
    expect(stampBook(days, 0, []).waiting.map((s) => s.ref)).toEqual(['home', 'portA', 'portB'])
  })
  it('stamps stages from the diary and dates them', () => {
    const b = stampBook(days, 0, [line('checkedIn', Date.parse('2027-03-10T12:00:00Z'))])
    expect(b.earned).toEqual([{ id: 'stage:checkedIn', kind: 'stage', ref: 'checkedIn', date: '2027-03-10' }])
  })
  it('stamps aboard and each port reached once, never a sea day', () => {
    const b = stampBook(days, 4, [])
    expect(b.earned.map((s) => s.id)).toEqual(['stage:aboard', 'port:home', 'port:portA', 'port:portB'])
    expect(b.waiting).toEqual([])
  })
  it('keeps a port ahead waiting until its first day', () => {
    expect(stampBook(days, 3, []).waiting.map((s) => s.ref)).toEqual(['portB'])
  })
  it('makes a plain card', () => {
    expect(stampBookCard({ title: 'T', dates: 'D', lines: ['a'], footer: 'F' })).toMatchObject({ id: 'stamp-book', lines: ['a'] })
  })
})

describe('daily trivia', () => {
  it('asks about ports still ahead only, three at most, the same for the same day', () => {
    const a = dailyTrivia(['Cozumel', 'Belize City'], '2027-03-22')
    expect(a).toHaveLength(3)
    expect(a.every((q) => q.port === 'Cozumel' || q.port === 'Belize')).toBe(true)
    expect(dailyTrivia(['Cozumel', 'Belize City'], '2027-03-22')).toEqual(a)
  })
  it('gives nothing when no port is ahead, and fewer when the pool is small', () => {
    expect(dailyTrivia([], 'x')).toEqual([])
    expect(dailyTrivia(['Amber Cove'], 'x')).toHaveLength(1)
  })
  it('has a valid answer index and unique ids for every question', () => {
    expect(new Set(PORT_TRIVIA.map((q) => q.id)).size).toBe(PORT_TRIVIA.length)
    expect(PORT_TRIVIA.every((q) => q.answer >= 0 && q.answer < q.options.length)).toBe(true)
  })
})
