import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shipExplorerFileText, shipExplorerRows } from '../../../scripts/ship-explorer-data'
import { isDayKind, type DayShape } from '../dayKinds'
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

      it('maps the sample week onto the authored week', () => {
        expect(week.map((_, i) => templateIndexFor(week, i + 1, content.menuTemplate))).toEqual([0, 1, 2, 3, 4, 5, 6, null])
      })
    })
  }
})
