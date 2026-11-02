import { describe, expect, it } from 'vitest'
import { AWAY_ITEMS, awayList, awayText, cleanExtra, EXTRA_MAX } from './awayHome'

describe('away-from-home checklist', () => {
  it('has unique ids and puts the earliest date first', () => {
    expect(new Set(AWAY_ITEMS.map((i) => i.id)).size).toBe(AWAY_ITEMS.length)
    const l = awayList('2027-03-20', '2027-01-01', [])
    expect(l.map((e) => e.due)).toEqual([...l.map((e) => e.due)].sort())
    expect(l.every((e) => !e.late)).toBe(true)
  })

  it('marks an item late only when its date has passed, it is not done and sailing has not started', () => {
    const pets = (today: string, ticked: string[]) => awayList('2027-03-20', today, ticked).find((e) => e.id === 'pets')!
    expect(pets('2027-03-10', []).late).toBe(true)
    expect(pets('2027-03-10', ['pets']).late).toBe(false)
    expect(pets('2027-03-20', []).late).toBe(false)
  })

  it('writes a list to share with done items marked and own items kept', () => {
    const e = awayList('2027-03-20', '2027-03-01', ['pets'])
    const text = awayText('Away', e, (id) => id, [{ id: 'x', text: 'Water the fern', done: false }])
    expect(text).toMatch(/\[x\] pets \(by 2027-03-06\)/)
    expect(text).toMatch(/\[ \] mail/)
    expect(text).toMatch(/MY OWN\n\[ \] Water the fern/)
  })

  it('cleans and limits own items', () => {
    expect(cleanExtra('  a   b ')).toBe('a b')
    expect(cleanExtra('x'.repeat(500))).toHaveLength(EXTRA_MAX)
  })
})
