import { describe, expect, it } from 'vitest'
import { goodTime, labelFor, levelAt, lineReading, LINES, NO_QUIET_FILTER, pulseAt, PULSE_VENUES, quietSpaces, type PulseEnv } from './pulse'

const MIN = 60_000
/** A clock where epoch 0 is midnight and every minute is a minute, and levels as a server might give them: busy from noon to 16:00, quiet otherwise. */
const hourOf = (at: number): number => ((at / MIN) % 1440) / 60
const day = (busy = 80): PulseEnv => ({ hour: hourOf, served: (_id, at) => (hourOf(at) >= 12 && hourOf(at) < 16 ? busy : 10) })
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

  it('reads only what the server gave, and nothing for an unknown venue', () => {
    expect(levelAt('lido-pool', at(13), day())).toBe(80)
    expect(levelAt('lido-pool', at(22), day())).toBe(10)
    expect(levelAt('lido-pool', at(13), { hour: hourOf, served: () => undefined })).toBe(0)
    expect(levelAt('nowhere' as never, at(13), day())).toBe(0)
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
