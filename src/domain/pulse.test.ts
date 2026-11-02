import { describe, expect, it } from 'vitest'
import { goodTime, labelFor, levelAt, lineReading, LINES, NO_QUIET_FILTER, pulseAt, PULSE_VENUES, quietSpaces, type PulseEnv } from './pulse'

const MIN = 60_000
/** A clock where epoch 0 is midnight and every minute is a minute. */
const day = (ashore = false): PulseEnv => ({ hour: (at) => ((at / MIN) % 1440) / 60, ashore: () => ashore })
const at = (h: number, m = 0): number => (h * 60 + m) * MIN

describe('ship pulse', () => {
  it('gives the same reading for the same moment, within 0 to 100', () => {
    for (const v of PULSE_VENUES) for (let h = 0; h < 24; h++) {
      const a = levelAt(v.id, at(h), day())
      expect(a).toBe(levelAt(v.id, at(h), day()))
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(100)
    }
  })

  it('labels levels plainly', () => {
    expect([labelFor(0), labelFor(34), labelFor(35), labelFor(64), labelFor(65)]).toEqual(['quiet', 'quiet', 'moderate', 'moderate', 'busy'])
  })

  it('is always labelled with its age, a confidence and that it is simulated', () => {
    const p = pulseAt('lido-pool', at(12, 3), day())
    expect(p.ageMinutes).toBe(3)
    expect(p.observedAt).toBe(at(12))
    expect(p.observedAt).toBeLessThanOrEqual(at(12, 3))
    expect(['low', 'medium']).toContain(p.confidence)
    expect(p.source).toBe('sim')
  })

  it('makes the pool busier at midday than at night, and lighter when guests are ashore', () => {
    const noon = (e: PulseEnv) => levelAt('lido-pool', at(13), e)
    expect(noon(day())).toBeGreaterThan(levelAt('lido-pool', at(22), day()))
    expect(noon(day(true))).toBeLessThan(noon(day()))
  })

  it('finds the quietest half hour, starting with now, and says when to go now', () => {
    const g = goodTime('lido-pool', at(12), day())
    expect(g.at).toBeGreaterThanOrEqual(at(12))
    expect(g.level).toBeLessThanOrEqual(levelAt('lido-pool', at(12), day()))
    const night = goodTime('lido-pool', at(22), day())
    expect(night.now).toBe(true)
  })

  it('lists quiet spaces open now first and honours the filters', () => {
    const night = quietSpaces(at(21), day())
    const firstClosed = night.findIndex((q) => !q.openNow)
    expect(night.slice(firstClosed).every((q) => !q.openNow)).toBe(true)
    expect(night.length).toBe(5)
    const shaded = quietSpaces(at(12), day(), { ...NO_QUIET_FILTER, shade: true })
    expect(shaded.every((q) => q.shade)).toBe(true)
    expect(quietSpaces(at(12), day(), { ...NO_QUIET_FILTER, stepFree: true }).every((q) => q.stepFree)).toBe(true)
  })

  it('reads a line with its wait, its shortest window and whether a virtual queue exists', () => {
    for (const l of LINES) {
      const r = lineReading(l.kind, at(19), day())
      expect(r.waitMinutes).toBeGreaterThanOrEqual(0)
      expect(r.waitMinutes).toBeLessThanOrEqual(l.maxWait)
      expect(r.shortest.waitMinutes).toBeLessThanOrEqual(r.waitMinutes)
      expect(r.shortest.at).toBeGreaterThanOrEqual(at(19))
    }
    expect(lineReading('dining', at(19), day()).virtual).toBe(true)
    expect(lineReading('show', at(19), day()).virtual).toBe(false)
  })
})
