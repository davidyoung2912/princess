import { describe, expect, it } from 'vitest'
import { buildBriefing, kindAt, MAX_LINES, spoken, type BriefingFacts } from './briefing'
import type { SkyNight } from './sky'
import type { PlanRow } from './planChange'

const row = (id: string, start: string, state: PlanRow['state'] = 'planned'): PlanRow => ({ state, entry: { id, title: `Item ${id}`, start, minutes: 60, kind: 'event', outdoor: false, path: '/plan' } })
const SKY: SkyNight = { day: 3, port: 'cozumel', sunrise: '06:30', sunset: '18:40', sunsetAt: Date.parse('2027-03-23T23:40:00Z'), moon: { phase: 'full', name: 'Full moon', lit: 99 }, sunsetSide: 'port', sailAway: '17:00', sailAwayAtSunset: false, stars: ['Orion'], darkSky: false, firstLight: '06:05', lastLight: '19:05', darkAt: '19:30' }
const facts = (over: Partial<BriefingFacts> = {}): BriefingFacts => ({
  nowHhmm: '07:30', plan: [row('a', '09:00'), row('b', '19:00')], weather: { uv: 9, tempF: 84, rainFrom: '14:00', rainTo: '17:00' },
  sky: SKY, deadlines: [{ label: 'Upload documents', path: '/me/documents' }], allAboard: '16:30', tomorrowFirst: { start: '08:00', title: 'Yoga', path: '/plan' }, ...over,
})

describe('briefing (XA-04)', () => {
  it('is morning before four and evening after', () => {
    expect(kindAt('11:59')).toBe('morning')
    expect(kindAt('16:00')).toBe('evening')
  })

  it('stays short and every line that links says where it came from', () => {
    for (const kind of ['morning', 'evening'] as const) {
      const b = buildBriefing(kind, facts({ plan: [row('a', '09:00', 'moved'), row('b', '10:00', 'dropped'), row('c', '19:00')] }))
      expect(b.lines.length).toBeLessThanOrEqual(MAX_LINES)
      expect(b.lines.length).toBeGreaterThan(0)
    }
    const m = buildBriefing('morning', facts({ plan: [row('a', '09:00', 'moved')] }))
    expect(m.lines.find((l) => l.id === 'changed')?.path).toBe('/plan/day')
  })

  it('leaves out lines with nothing to say, and says nothing about a list that has not loaded', () => {
    const b = buildBriefing('morning', facts({ plan: [], allAboard: null, deadlines: null }))
    expect(b.lines.map((l) => l.id)).toEqual(['weather'])
  })

  it('skips dropped items when naming the next thing', () => {
    const b = buildBriefing('morning', facts({ plan: [row('a', '09:00', 'dropped'), row('b', '10:00')] }))
    expect(b.lines.find((l) => l.id === 'next')?.text).toContain('Item b')
  })

  it('previews tomorrow in the evening and reads aloud as plain text', () => {
    const b = buildBriefing('evening', facts({ nowHhmm: '18:00' }))
    expect(b.lines.some((l) => l.id === 'tomorrow')).toBe(true)
    expect(spoken(b)).toMatch(/^Your evening\. /)
  })
})
