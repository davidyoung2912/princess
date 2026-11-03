import { describe, expect, it } from 'vitest'
import { dressCode, materialiseSailing, nightsOf, q, renderCatalogueSql, validateCatalogue, zoneOffsetMinutes, type CatalogueSource } from '../../scripts/catalogue'
import { loadCatalogue } from '../../scripts/catalogue-io'

const base = (): CatalogueSource => ({
  regions: [{ id: 'caribbean', name: 'Caribbean' }],
  ships: [{ id: 'sun-princess', name: 'Sun Princess', class: 'Sphere', grossTonnage: 177882, decks: 21, guests: 4300, crew: 1600, intro: 'A ship.', highlights: [], depth: 'aboard' }],
  ports: [
    { id: 'fll', name: 'Fort Lauderdale', country: 'United States', countryCode: 'US', region: 'caribbean', zone: 'America/New_York', lat: 26.1, lon: -80.1, currency: 'USD', languages: ['en'], tier: 'A' },
    { id: 'cozumel', name: 'Cozumel', country: 'Mexico', countryCode: 'MX', region: 'caribbean', zone: 'America/Cancun', lat: 20.5, lon: -86.9, currency: 'MXN', languages: ['es'], tier: 'A' },
  ],
  patterns: [{ id: 'carib-west-a', name: 'Mini', region: 'caribbean', nights: 1, startPort: 'fll', endPort: 'fll', description: '', days: [{ day: 1, port: 'fll' }, { day: 2, port: 'fll' }] }],
  sailings: [{ id: 'sun-2027-01-24-1', ship: 'sun-princess', departure: '2027-01-24', title: 'Mini', legs: [{ pattern: 'carib-west-a' }], dataStatus: 'sample' }],
  fares: [{ ship: 'sun-princess', category: 'interior', perNightCents: 9900 }],
})

describe('catalogue source validation (X0a)', () => {
  it('accepts a consistent source and an empty one', () => {
    expect(validateCatalogue(base())).toEqual([])
    expect(validateCatalogue({ regions: [], ships: [], ports: [], patterns: [], sailings: [], fares: [] })).toEqual([])
  })
  it('catches unknown references, bad dates, wrong day counts and clashes', () => {
    const c = base()
    c.sailings.push({ ...c.sailings[0], id: 'sun-2027-01-24-1b' }) // same ship and day
    c.sailings.push({ id: 'x', ship: 'nope', departure: '2027-13-40', title: '', legs: [{ pattern: 'ghost' }], dataStatus: 'sample' })
    c.patterns[0].days.pop()
    c.ports[1].region = 'mars'
    const e = validateCatalogue(c).join('\n')
    expect(e).toContain('already sails on 2027-01-24')
    expect(e).toContain('id must be sun-2027-01-24-1')
    expect(e).toContain('unknown ship "nope"')
    expect(e).toContain('bad departure')
    expect(e).toContain('unknown pattern "ghost"')
    expect(e).toContain('needs 2 days, has 1')
    expect(e).toContain('unknown region "mars"')
  })
})

describe('catalogue rules (X0b)', () => {
  it('refuses a Sun Princess sailing on a seeded date, and a pattern that does not join its neighbour', () => {
    const c = base()
    c.patterns[0] = { ...c.patterns[0], nights: 7, days: ['fll', 'sea', 'sea', 'sea', 'sea', 'sea', 'sea', 'fll'].map((port, i) => ({ day: i + 1, port })) }
    c.sailings = [{ id: 'sun-2027-03-21-7', ship: 'sun-princess', departure: '2027-03-21', title: '', legs: [{ pattern: 'carib-west-a' }], dataStatus: 'sample' }]
    expect(validateCatalogue(c).join('\n')).toContain('is a seeded Sun Princess sailing')
    const d = base()
    d.patterns.push({ id: 'x-oneway', name: 'One way', region: 'caribbean', nights: 1, startPort: 'cozumel', endPort: 'cozumel', description: '', days: [{ day: 1, port: 'cozumel' }, { day: 2, port: 'cozumel' }] })
    d.sailings = [{ id: 'sun-2027-01-24-2', ship: 'sun-princess', departure: '2027-01-24', title: '', legs: [{ pattern: 'carib-west-a' }, { pattern: 'x-oneway' }], dataStatus: 'sample' }]
    expect(validateCatalogue(d).join('\n')).toContain('leg 1 ends in fll but leg 2 starts in cozumel')
  })
  it('the same departure can be offered as 7, 14 and 21 nights', () => {
    const c = loadCatalogue()
    const on = c.sailings.filter((s) => s.ship === 'sun-princess' && s.departure === '2027-04-11').map((s) => nightsOf(c, s)).sort((a, b) => a - b)
    expect(on).toEqual([7, 14, 21])
  })
  it('works out dress nights by length', () => {
    const week = Array.from({ length: 9 }, (_, i) => dressCode(7, i + 1))
    expect(week).toEqual(['casual', 'elegant', 'smart', 'smart', 'smart', 'smart', 'elegant', 'casual', 'casual'])
    expect(Array.from({ length: 6 }, (_, i) => dressCode(5, i + 1))).toEqual(['casual', 'elegant', 'smart', 'smart', 'smart', 'casual'])
    expect(Array.from({ length: 5 }, (_, i) => dressCode(3, i + 1))).toEqual(['casual', 'smart', 'smart', 'casual', 'casual'])
    const long = Array.from({ length: 14 }, (_, i) => i + 2).filter((d) => dressCode(14, d) === 'elegant')
    expect(long).toEqual([2, 7, 9, 14])
  })
  it('quotes strings in plain ASCII', () => {
    expect(q("It's")).toBe("N'It''s'")
    expect(q('Roatán')).toBe("N'Roat' + NCHAR(225) + N'n'")
    expect(q('')).toBe("N''")
  })
  it('reads zone offsets from the date, daylight saving included', () => {
    expect(zoneOffsetMinutes('America/New_York', '2027-01-24')).toBe(-300)
    expect(zoneOffsetMinutes('America/New_York', '2027-07-01')).toBe(-240)
    expect(zoneOffsetMinutes('Asia/Tokyo', '2027-01-24')).toBe(540)
    expect(zoneOffsetMinutes('Atlantic/Reykjavik', '2027-07-01')).toBe(0)
  })
})

describe('the authored catalogue (X0b)', () => {
  const c = loadCatalogue()
  it('is consistent and covers three ships, with Sun Princess aboard and the others browse', () => {
    expect(validateCatalogue(c)).toEqual([])
    expect(c.ships.map((s) => [s.id, s.depth])).toEqual([['sun-princess', 'aboard'], ['sky-princess', 'browse'], ['sapphire-princess', 'browse']])
    expect(c.ports.length).toBeGreaterThanOrEqual(90)
    expect(c.ports.filter((p) => p.tier === 'A').length).toBe(25)
  })
  it('labels every sailing as a sample', () => {
    expect(new Set(c.sailings.map((s) => s.dataStatus))).toEqual(new Set(['sample']))
  })
  it('keeps the seeded port ids', () => {
    for (const id of ['fll', 'cozumel', 'belize', 'roatan']) expect(c.ports.some((p) => p.id === id)).toBe(true)
  })
  it('expands the Western A route like the seeded sailings, with the Belize clock change', () => {
    const m = materialiseSailing(c, c.sailings.find((s) => s.id === 'sun-2027-01-24-7')!)
    expect(m.days.map((d) => d.port)).toEqual(['fll', 'sea', 'cozumel', 'belize', 'roatan', 'sea', 'sea', 'fll'])
    expect(m.days[3]).toMatchObject({ clockChange: -1, arrive: '07:00' })
    expect(m.days[6].clockChange).toBe(1)
    expect(m.days[0]).toMatchObject({ depart: '15:00', date: '2027-01-24' })
    expect(m.days[7]).toMatchObject({ arrive: '06:00', date: '2027-01-31' })
  })
  it('joins legs on a shared turnaround day', () => {
    const m = materialiseSailing(c, c.sailings.find((s) => s.id === 'sun-2027-01-24-14')!)
    expect(m.nights).toBe(14)
    expect(m.days).toHaveLength(15)
    expect(m.legs).toEqual([{ legNo: 1, pattern: 'carib-west-a', startDay: 1 }, { legNo: 2, pattern: 'carib-east-a', startDay: 8 }])
    expect(m.days[7]).toMatchObject({ port: 'fll', arrive: '06:00', depart: '15:00', date: '2027-01-31' })
    expect(m.days[6].clockChange).toBe(1)
  })
  it('gives every sailing one day per night plus one, consecutive dates, and a fare for each category', () => {
    for (const s of c.sailings) {
      const m = materialiseSailing(c, s)
      expect(m.days).toHaveLength(m.nights + 1)
      m.days.forEach((d, i) => expect(d.day).toBe(i + 1))
      expect(Date.parse(m.days[m.nights].date) - Date.parse(m.days[0].date)).toBe(m.nights * 86_400_000)
    }
    const perShip = (id: string) => c.fares.filter((f) => f.ship === id).length
    expect([perShip('sun-princess'), perShip('sky-princess'), perShip('sapphire-princess')]).toEqual([6, 4, 4])
  })
  it('renders SQL that stays in ASCII, chunks big inserts and ends with the backfill', () => {
    const sql = renderCatalogueSql(c)
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7f]*$/.test(sql)).toBe(true)
    expect(sql).toContain('MERGE ref.Sailings AS t')
    expect(sql).toContain('-- ref.ItineraryDays: continued')
    expect(sql.indexOf('MERGE ref.Regions')).toBeLessThan(sql.indexOf('MERGE ref.Ports'))
    expect(sql.indexOf('MERGE ref.ItineraryPatterns')).toBeLessThan(sql.indexOf('MERGE ref.Sailings'))
    expect(sql.trimEnd().endsWith('GO')).toBe(true)
  })
})

