import { describe, expect, it } from 'vitest'
import { carbonRange, childStory, companionWeek, dressNights, guaranteeOdds, moneyPlan, parsePlan } from './prepMore'
import { REFERENCE_SAILING } from './sailings'

describe('prepMore', () => {
  it('has one companion week from eight weeks out, none before or after', () => {
    expect(companionWeek(100)).toBeNull()
    expect(companionWeek(56)).toBe(8)
    expect(companionWeek(57)).toBeNull()
    expect(companionWeek(7)).toBe(1)
    expect(companionWeek(0)).toBeNull()
  })
  it('names two dress nights and odds that add to 100', () => {
    expect(dressNights(7)).toEqual([2, 7])
    for (const c of ['interior', 'balcony', 'signatureSuite']) { const o = guaranteeOdds(c)!; expect(o.same + o.up).toBe(100) }
    expect(guaranteeOdds('nope')).toBeNull()
  })
  it('gives a carbon range, low under high', () => {
    const r = carbonRange(7, 2)
    expect(r.lowKg).toBe(1680)
    expect(r.highKg).toBeGreaterThan(r.lowKg)
  })
  it('plans money by day type and adds up', () => {
    const p = moneyPlan(REFERENCE_SAILING, 2)
    expect(p.days).toHaveLength(7)
    expect(p.cash + p.card).toBe(p.total)
    expect(p.days.filter((d) => d.kind === 'port')).toHaveLength(3)
  })
  it('tells the week in one line a day', () => {
    const s = childStory('Mia!', REFERENCE_SAILING)
    expect(s[0]).toBe('Mia is going on a big ship!')
    expect(s.length).toBe(10)
  })
  it('reads a pasted plan, drops links and repeats, and caps line length', () => {
    const p = parsePlan('**Day 3:** Snorkel at 9am\n- Day 3: snorkel at 9am\nhttps://x.example\n\n1. Day 4 - Market walk\nPack sunscreen')
    expect(p).toEqual([{ day: 3, text: 'Snorkel at 9am' }, { day: 4, text: 'Market walk' }, { day: null, text: 'Pack sunscreen' }])
  })
})
