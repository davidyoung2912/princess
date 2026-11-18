import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shipExplorerFileText, shipExplorerRows } from '../../../scripts/ship-explorer-data'
import { ACCESS_FEATURES } from '../eventAccess'
import { isDayKind, isDayKindOn, type DayShape } from '../dayKinds'
import { resolveHours } from './hours'
import { dishKey, dishSlug } from './shortlist'
import { templateIndexFor } from './dayMapping'
import { EXPLORER_KINDS } from './types'
import { EVENTS as PROGRAMME_EVENTS } from '../program'

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
        // The plan takes the daily programme's event first when an id is in both, so an Explorer event must never reuse a programme id (it would be refused on the days it runs).
        const programme = new Set(PROGRAMME_EVENTS.map((e) => e.id))
        expect(events.filter((id) => programme.has(id))).toEqual([])
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

      it('gives events only access codes the app can say, and every restaurant its family facilities', () => {
        for (const e of content.events) for (const a of e.access ?? []) expect(ACCESS_FEATURES).toContain(a)
        for (const e of content.events) if (e.series) expect(e.series.length).toBeLessThanOrEqual(60)
        for (const v of content.venues) {
          expect(v.accessibility.length).toBeGreaterThan(0)
          const eats = v.explorer === 'dining' && v.kind !== 'bar'
          expect((v.family?.length ?? 0) > 0).toBe(eats)
          expect((v.kidsMenu?.length ?? 0) > 0).toBe(eats)
        }
      })

      it('gives every dish a saved-dish key that fits and names it alone at its venue', () => {
        for (const v of content.venues) {
          const names = [...new Set([...content.menus.filter((m) => m.venueId === v.id).flatMap((m) => m.courses.flatMap((c) => c.dishes.map((d) => d.name))), ...(v.kidsMenu ?? []).map((d) => d.name)])]
          const slugs = names.map(dishSlug)
          expect(new Set(slugs).size, v.id).toBe(names.length)
          for (const n of names) expect(dishKey(ship, v.id, n).length - 'dish:'.length, `${v.id} ${n}`).toBeLessThanOrEqual(70)
        }
      })

      it('marks every children\'s dish from what it contains, like any other menu', () => {
        for (const v of content.venues) for (const d of v.kidsMenu ?? []) {
          const animal = ['meat', 'pork', 'fish', 'shellfish'].some((c) => d.contains.includes(c))
          expect(d.marks?.includes('vegan') ?? false).toBe(!animal && !['dairy', 'egg'].some((c) => d.contains.includes(c)))
          if (animal) expect(d.marks).not.toContain('vegetarian')
        }
        const kids = content.venues.find((v) => (v.kidsMenu?.length ?? 0) > 0)?.kidsMenu ?? []
        expect(kids.find((d) => d.name === 'Fresh fruit plate')?.marks).toContain('vegan')
        expect(kids.find((d) => d.name === 'Macaroni and cheese')?.marks).toContain('vegetarian')
        expect(kids.find((d) => d.name === 'Chicken tenders and fries')?.marks ?? []).not.toContain('vegetarian')
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
        expect(dishes.find((d) => d.name === 'Aubergine Parmigiana')?.contains).not.toContain('egg')
      })

      it('flags alcohol, raw food and spice from the dish itself, never on a zero-proof drink', () => {
        const dishes = content.menus.flatMap((m) => m.courses.flatMap((c) => c.dishes))
        for (const d of dishes) {
          if (d.flags) expect(d.flags.length, d.name).toBeGreaterThan(0)
          if (/zero-proof|non-alcoholic/i.test(`${d.name} ${d.note ?? ''}`)) expect(d.flags ?? []).not.toContain('alcohol')
        }
      })

      it('marks the diets: every section of every menu has a vegan, a vegetarian and a no-added-sugar dish, and no meat or fish dish is marked vegan or vegetarian', () => {
        for (const m of content.menus) {
          for (const c of m.courses) {
            for (const d of c.dishes) {
              expect(d.marks, `${m.venueId} ${d.name}`).toBeDefined()
              if (d.contains.some((x) => ['meat', 'pork', 'fish', 'shellfish'].includes(x))) expect(d.marks).not.toEqual(expect.arrayContaining(['vegan']))
              if (d.contains.some((x) => ['meat', 'pork', 'fish', 'shellfish'].includes(x))) expect(d.marks).not.toEqual(expect.arrayContaining(['vegetarian']))
              if (d.contains.some((x) => ['dairy', 'egg'].includes(x))) expect(d.marks).not.toEqual(expect.arrayContaining(['vegan']))
            }
            if (c.name.startsWith('Chef')) continue
            const marks = c.dishes.flatMap((d) => d.marks ?? [])
            const label = `${m.venueId} ${m.meal} day ${m.templateDay} ${c.name}`
            expect(marks, label).toContain('vegan')
            expect(marks, label).toContain('vegetarian')
            expect(marks, label).toContain('nas')
          }
        }
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

      it('sells treatments only at spa venues that take appointments, on real kinds of day, that fit the hours of a day they run', () => {
        const bookable = new Map(content.venues.filter((v) => v.bookable === 'spa').map((v) => [v.id, v]))
        expect(content.venues.filter((v) => v.explorer === 'spa').length).toBeGreaterThanOrEqual(3)
        expect(content.treatments.length).toBeGreaterThan(5)
        expect(new Set(content.treatments.map((x) => x.id)).size).toBe(content.treatments.length)
        for (const x of content.treatments) {
          const v = bookable.get(x.venueId)
          expect(v, x.id).toBeDefined()
          expect(x.id.length).toBeLessThanOrEqual(40)
          expect(x.minutes).toBeGreaterThan(0)
          expect(x.price).toBeGreaterThan(0)
          expect(x.rooms).toBeGreaterThan(0)
          for (const k of x.when) expect(isDayKind(k)).toBe(true)
          const fits = week.some((_, i) => x.when.some((k) => isDayKindOn(week, i + 1, k as never)) && resolveHours(v!.hours, week, i + 1, '17:00').windows.some(([a, b]) => a <= '12:00' && b >= '20:00'))
          expect(fits, x.id).toBe(true)
        }
      })

      it('maps the sample week onto the authored week', () => {
        expect(week.map((_, i) => templateIndexFor(week, i + 1, content.menuTemplate))).toEqual([0, 1, 2, 3, 4, 5, 6, null])
      })
    })
  }
})
