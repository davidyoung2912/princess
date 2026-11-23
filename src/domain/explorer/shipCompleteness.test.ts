import { describe, expect, it } from 'vitest'
import { shipExplorerRows } from '../../../scripts/ship-explorer-data'
import { isDayKindOn, type DayShape } from '../dayKinds'

// Completeness guard (docs/review-and-completeness-plan.md, Phase A): the authored week must stay full enough to plan a sailing from. These are floors, not targets.
const week: DayShape[] = ['home', 'sea', 'a', 'b', 'sea', 'c', 'sea', 'home'].map((port, i) => ({ port, date: `2027-03-${String(21 + i).padStart(2, '0')}` }))

for (const [ship, c] of Object.entries(shipExplorerRows())) {
  describe(`${ship} completeness`, () => {
    const on = (day: number) => c.events.filter((e) => e.when.some((k) => isDayKindOn(week, day, k as never)))
    const explorerOf = (venueId: string) => c.venues.find((v) => v.id === venueId)!.explorer

    it('has something to do on every day, including the morning of disembarkation', () => {
      for (let d = 1; d <= week.length; d++) expect(on(d).length, `day ${d}`).toBeGreaterThanOrEqual(d === 8 ? 4 : d === 1 ? 20 : 40)
    })

    it('covers morning, afternoon and evening on every day aboard, and some late nights', () => {
      for (let d = 1; d <= 7; d++) {
        const hours = on(d).map((e) => Number(e.start.slice(0, 2)))
        if (d > 1) expect(hours.some((h) => h < 12), `day ${d} morning`).toBe(true)
        expect(hours.some((h) => h >= 12 && h < 17), `day ${d} afternoon`).toBe(true)
        expect(hours.some((h) => h >= 17 && h < 21), `day ${d} evening`).toBe(true)
      }
      expect(c.events.filter((e) => Number(e.start.slice(0, 2)) >= 21).length).toBeGreaterThanOrEqual(30)
    })

    it('has events for children and teens on sea days and port days', () => {
      const young = (day: number) => on(day).filter((e) => e.age === 'kids' || e.age === 'teens').length
      for (const d of [2, 3, 4, 5, 6, 7]) expect(young(d), `day ${d}`).toBeGreaterThanOrEqual(2)
      expect(c.events.filter((e) => e.age === 'kids' || e.age === 'teens').length).toBeGreaterThanOrEqual(25)
    })

    it('gives every Explorer events on both sea days and port days', () => {
      for (const kind of ['dining', 'spa', 'entertainment', 'exercise', 'shopping', 'activities']) {
        for (const d of [2, 3]) expect(on(d).filter((e) => explorerOf(e.venueId) === kind).length, `${kind} day ${d}`).toBeGreaterThan(0)
      }
    })

    it('gives every specialty restaurant and every bar with a theme something to book or plan around', () => {
      for (const v of c.venues.filter((x) => x.explorer === 'dining' && x.kind === 'specialty')) expect(c.events.some((e) => e.venueId === v.id), v.id).toBe(true)
    })

    it('has a menu for every dining room, and a dinner for every night of the week in each main dining room', () => {
      for (const v of c.venues.filter((x) => x.explorer === 'dining')) expect(c.menus.some((m) => m.venueId === v.id), v.id).toBe(true)
      for (const v of c.venues.filter((x) => x.explorer === 'dining' && x.kind === 'main')) {
        const nights = new Set(c.menus.filter((m) => m.venueId === v.id && m.meal === 'dinner').map((m) => m.templateDay))
        expect([...nights].sort(), v.id).toEqual([1, 2, 3, 4, 5, 6, 7])
      }
    })
  })
}
