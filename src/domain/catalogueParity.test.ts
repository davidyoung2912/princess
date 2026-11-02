import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VENUES } from './dining'
import { EXCURSIONS } from './excursions'

/**
 * The server holds a C# copy of the authored catalogue (`ExcursionRules.Catalogue`, `DiningRules.Venues`) that the concierge, booking and
 * reference routes use. Until the client reads its catalogue from the server, this keeps the two from drifting apart.
 */
const cs = (file: string): string => readFileSync(`server/Princess.Api/Domain/${file}`, 'utf8')

describe('catalogue parity with the server', () => {
  it('has the same excursions with the same port, name, hours, price, activity, wheelchair, family, rating, start and capacity', () => {
    const rows = [...cs('ExcursionRules.cs').matchAll(/new\("([a-z-]+)", "([a-z]+)", "([^"]+)", "[^"]*", ([\d.]+), (\d+), "([a-z]+)", (true|false), (true|false), \[([^\]]*)\],\s*([\d.]+), (\d+), "[^"]*", "(\d\d:\d\d)", (\d+)\)/g)]
    expect(rows).toHaveLength(EXCURSIONS.length)
    for (const m of rows) {
      const x = EXCURSIONS.find((e) => e.id === m[1])
      expect(x, m[1]).toBeDefined()
      expect([x!.port, x!.name, x!.hours, x!.price, x!.activity, x!.wheelchair, x!.family, x!.interests.map((i) => `"${i}"`).join(', '), x!.rating, x!.reviews, x!.start, x!.capacity]).toEqual(
        [m[2], m[3], Number(m[4]), Number(m[5]), m[6], m[7] === 'true', m[8] === 'true', m[9], Number(m[10]), Number(m[11]), m[12], Number(m[13])],
      )
    }
  })
  it('has the same dining venues with the same kind, cover charge, deck, cuisine, dress code and menu', () => {
    const rows = [...cs('DiningRules.cs').matchAll(/new\("([a-z]+)", "([^"]+)", "([a-z]+)", ([\d_]+), (true|false), "([^"]+)", "([^"]+)", "([a-z]+)", "([^"]+)"\)/g)]
    expect(rows).toHaveLength(VENUES.length)
    for (const m of rows) {
      const v = VENUES.find((e) => e.id === m[1])
      expect(v, m[1]).toBeDefined()
      expect([v!.name, v!.kind, v!.cover, !!v!.walkIn, v!.deck, v!.cuisine, v!.dress, v!.menu]).toEqual([m[2], m[3], Number(m[4].replace(/_/g, '')), m[5] === 'true', m[6], m[7], m[8], m[9]])
    }
  })
})
