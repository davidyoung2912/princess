import { describe, expect, it } from 'vitest'
import { spendForecast } from './spendForecast'

describe('spendForecast', () => {
  const lines = [
    { category: 'packages', cents: 20_000, planned: false },
    { category: 'excursions', cents: 10_000, planned: false },
    { category: 'excursions', cents: 10_000, planned: true },
    { category: 'dining', cents: 0, planned: false },
    { category: 'dining', cents: -5, planned: false },
  ] as const

  it('totals by category and splits bought from planned', () => {
    const f = spendForecast(lines, null)
    expect(f.total).toBe(40_000)
    expect(f.bought).toBe(30_000)
    expect(f.planned).toBe(10_000)
    expect(f.categories.map((c) => c.category)).toEqual(['packages', 'excursions'])
    expect(f.categories[1]).toMatchObject({ bought: 10_000, planned: 10_000, share: 50 })
    expect(f.status.state).toBe('none')
  })

  it('warns near and over the budget and says what is left', () => {
    expect(spendForecast(lines, 100_000).status).toMatchObject({ state: 'ok', left: 60_000 })
    expect(spendForecast(lines, 45_000).status.state).toBe('near')
    expect(spendForecast(lines, 30_000).status.state).toBe('over')
  })

  it('handles nothing bought', () => {
    const f = spendForecast([], 50_000)
    expect(f.total).toBe(0)
    expect(f.categories).toEqual([])
    expect(f.status.left).toBe(50_000)
  })
})
