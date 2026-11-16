import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shipExplorerFileText, shipExplorerRows } from '../../../scripts/ship-explorer-data'
import { isDayKind, isDayKindOn, type DayShape } from '../dayKinds'
import { resolveHours } from './hours'
import { templateIndexFor } from './dayMapping'
import { EXPLORER_KINDS } from './types'

// The sample week: embark, sea, port, port, sea, port, sea, then the morning of disembarkation.
const week: DayShape[] = ['home', 'sea', 'a', 'b', 'sea', 'c', 'sea', 'home'].map((port, i) => ({ port, date: `2027-03-${String(21 + i).padStart(2, '0')}` }))
const rows = shipExplorerRows()

describe('the Explorer content of the ships', () => {
  it('matches the file the server embeds (run npm run shipexplorer:gen when this fails)', () => {
    expect(readFileSync(new URL('../../../server/Princess.Api/Content/ship-explorer.json', import.meta.url), 'utf8')).toBe(shipExplorerFileText())
  })

  it('covers the three ships', () => {
    expect(Object.keys(rows)).toEqual(['sun-princess', 'sky-princess', 'sapphire-princess'])
  })

  for (const [ship, content] of Object.entries(rows)) {
    describe(ship, () => {
      it('has unique venue and event ids that fit the plan and pin columns', () => {
        const venues = content.venues.map((v) => v.id)
        const events = content.events.map((e) => e.id)
        expect(new Set(venues).size).toBe(venues.length)
        expect(new Set(events).size).toBe(events.length)
        for (const id of [...venues, ...events]) expect(id.length).toBeLessThanOrEqual(40)
        // A pin is `venue:<ship>.<venue>` and must fit the 80 characters a saved item may have.
        for (const id of venues) expect(`venue:${ship}.${id}`.length).toBeLessThanOrEqual(80)
      })

      it('puts every venue in a real Explorer, with text and a place', () => {
        for (const v of content.venues) {
          expect(EXPLORER_KINDS).toContain(v.explorer)
          expect(v.title).not.toBe('')
          expect(v.short).not.toBe('')
          expect(v.long.length).toBeGreaterThanOrEqual(v.short.length)
          expect(v.placeId).not.toBe('')
        }
      })

      it('names a venue of the ship and real kinds of day for every event and menu', () => {
        const ids = new Set(content.venues.map((v) => v.id))
        for (const e of content.events) {
          expect(ids.has(e.venueId)).toBe(true)
          expect(e.when.length).toBeGreaterThan(0)
          for (const k of e.when) expect(isDayKind(k)).toBe(true)
          expect(e.start).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
        }
        for (const m of content.menus) {
          expect(ids.has(m.venueId)).toBe(true)
          expect(m.templateDay).toBeGreaterThanOrEqual(0)
          expect(m.templateDay).toBeLessThanOrEqual(content.menuTemplate.length)
        }
      })

      it('gives every venue hours on every night of the sample week', () => {
        for (const v of content.venues) {
          for (let day = 1; day < week.length; day++) {
            const h = resolveHours(v.hours, week, day, '17:00')
            expect(h.windows.length, `${v.id} day ${day}`).toBeGreaterThan(0)
          }
        }
      })

      it('gives every main dining room a dinner menu for each night of the authored week, formal on the two formal nights', () => {
        for (const v of content.venues.filter((x) => x.kind === 'main')) {
          const dinners = content.menus.filter((m) => m.venueId === v.id && m.meal === 'dinner')
          expect(dinners.map((m) => m.templateDay).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
          expect(dinners.filter((m) => m.formal).map((m) => m.templateDay).sort()).toEqual([2, 6])
        }
      })

      it('tags every dish and keeps eggplant from counting as egg', () => {
        const dishes = content.menus.flatMap((m) => m.courses.flatMap((c) => c.dishes))
        expect(dishes.length).toBeGreaterThan(50)
        expect(dishes.find((d) => d.name === 'Eggplant Parmigiana')?.contains).not.toContain('egg')
      })

      it('starts every event inside the hours of its venue on a day it runs', () => {
        for (const e of content.events) {
          const v = content.venues.find((x) => x.id === e.venueId)!
          const inside = week.some((_, i) => {
            if (!e.when.some((k) => isDayKindOn(week, i + 1, k as never))) return false
            return resolveHours(v.hours, week, i + 1, '17:00').windows.some(([a, b]) => a <= e.start && e.start < b)
          })
          expect(inside, `${e.id} at ${e.start}`).toBe(true)
        }
      })

      it('maps the sample week onto the authored week', () => {
        expect(week.map((_, i) => templateIndexFor(week, i + 1, content.menuTemplate))).toEqual([0, 1, 2, 3, 4, 5, 6, null])
      })
    })
  }
})
