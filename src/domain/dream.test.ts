import { describe, expect, it } from 'vitest'
import { budgetSearch, soloView, decisionSummary, decisionText, FEARS, fitNotes, GLOSSARY, inviteText } from './dream'
import { REFERENCE_SAILING as S } from './sailings'

describe('dream and decide', () => {
  it('names who the cruise does not suit, and says the tender fear plainly', () => {
    expect(fitNotes(['tenders'])[0]).toMatch(/Belize City is a tender port/)
    expect(fitNotes([])).toEqual([])
  })
  it('answers the six real fears and defines the jargon', () => {
    expect(FEARS).toHaveLength(6)
    for (const t of ['Muster', 'Tender', 'Folio', 'Medallion', 'Port side']) expect(GLOSSARY.some((g) => g.term === t)).toBe(true)
  })
  it('splits options by budget and shows how far the rest stretches', () => {
    const r = budgetSearch(S, 600_000, 2)
    expect(r.fitting.every((o) => o.total <= 600_000 && o.left >= 0)).toBe(true)
    expect(r.fitting.every((o) => o.perPersonPerDay === Math.round(o.left / 2 / 7))).toBe(true)
    expect(r.nearMiss.every((o) => o.total > 600_000)).toBe(true)
    const none = budgetSearch(S, 1000, 2)
    expect(none.fitting).toEqual([])
    expect(none.nearMiss.length).toBeGreaterThan(0)
    expect(budgetSearch(S, 1000, 9).cheapest).toBeNull()
    expect(budgetSearch(S, -1, 2).fitting).toEqual([])
  })
  it('shows the solo supplement on its own line, cheapest first', () => {
    const rows = soloView(S)
    for (const r of rows) expect(r.supplement).toBe(r.fare)
    expect(rows.map((r) => r.total)).toEqual([...rows.map((r) => r.total)].sort((a, b) => a - b))
  })
  it('summarises what is decided, what is left and what could change', () => {
    const empty = decisionSummary({ sailing: null, category: null, fare: null, guests: 2, fitsChecked: false, budget: null })
    expect(empty.left).toContain('Choose a sailing')
    const done = decisionSummary({ sailing: S, category: 'balcony', fare: 'plus', guests: 2, fitsChecked: true, budget: 100_000 })
    expect(done.decided.join(' ')).toMatch(/All-in price/)
    expect(done.left.join(' ')).toMatch(/over your budget/)
    expect(decisionText(done)).toMatch(/Could change my mind/)
  })
  it('writes an invitation with only a first name', () => {
    const t = inviteText(S, '  Sam  ', 'Come!')
    expect(t).toMatch(/^Sam would like/)
    expect(inviteText(S, '', '')).toMatch(/^A friend/)
  })
})
