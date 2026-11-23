import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { portExcursions, portExcursionsFileText } from '../../scripts/port-excursions-data'

const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')) as T
const tours = portExcursions()
const guides = read<{ id: string }[]>('server/Princess.Api/Content/port-guides.json')
const sailings = read<{ ship: string; legs: { pattern: string }[] }[]>('db/seed/catalogue/sailings-2027.json')
const patterns = new Map(read<{ id: string; days: { port: string }[] }[]>('db/seed/catalogue/patterns.json').map((p) => [p.id, p]))

/** The ports each ship calls at on its 2027 sailings, excluding the home port Fort Lauderdale (no tours needed there). */
const portsOf = (ship: string): Set<string> => new Set(sailings.filter((s) => s.ship === ship).flatMap((s) => s.legs.flatMap((l) => patterns.get(l.pattern)!.days.map((d) => d.port))).filter((p) => p !== 'sea' && p !== 'fll'))

describe('the candidate shore-excursion catalogue (docs/review-and-completeness-plan.md, Phase B)', () => {
  it('matches the file in the repo (run npm run portexcursions:gen when this fails)', () => {
    expect(readFileSync(new URL('../../server/Princess.Api/Content/port-excursions.json', import.meta.url), 'utf8')).toBe(portExcursionsFileText())
  })

  it('has unique ids that fit the ref.Excursions column, at ports that have a guide', () => {
    expect(new Set(tours.map((t) => t.id)).size).toBe(tours.length)
    const ports = new Set(guides.map((g) => g.id))
    for (const t of tours) {
      expect(t.id.length, t.id).toBeLessThanOrEqual(40)
      expect(t.id, t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(ports.has(t.port), t.id).toBe(true)
      expect(t.name.length).toBeLessThanOrEqual(120)
    }
  })

  it('has sensible hours, prices, start times and capacities that leave room to spare', () => {
    for (const t of tours) {
      expect(t.hours, t.id).toBeGreaterThanOrEqual(3)
      expect(t.hours, t.id).toBeLessThanOrEqual(9)
      expect(t.price % 100, t.id).toBe(0)
      expect(t.price, t.id).toBeGreaterThanOrEqual(4000)
      expect(t.start, t.id).toMatch(/^\d\d:\d\d$/)
      expect(t.capacity - 4, t.id).toBeGreaterThan(0)
      expect(t.interests.length, t.id).toBeGreaterThan(0)
      if (t.wheelchair) expect(t.activity, t.id).toBe('easy')
    }
  })

  for (const [ship, floor] of [['sun-princess', 0.85], ['sky-princess', 0.75], ['sapphire-princess', 0.8]] as const) {
    it(`covers a good portion of the ports ${ship} calls at (at least ${floor * 100}%)`, () => {
      const ports = [...portsOf(ship)]
      const covered = ports.filter((p) => tours.some((t) => t.port === p))
      expect(covered.length / ports.length, `missing: ${ports.filter((p) => !covered.includes(p)).join(', ')}`).toBeGreaterThanOrEqual(floor)
    })
  }
})
