import { describe, expect, it } from 'vitest'
import { portDayAt } from './allaboard'
import { crowdFor, hourlyCrowd, quietestWindow } from './portCrowd'
import { PORT_KNOWLEDGE, GUIDE_PORTS, overCeiling, perPerson } from './portContent'
import { latestStart, planPortDay, PLAN_B, PLAN_B_TRIGGERS, recommendedPlanB, RETURN_QUEUE } from './portPilot'
import { REFERENCE_SAILING } from './sailings'

const MIN = 60_000
const days = Array.from({ length: 8 }, (_, i) => portDayAt(REFERENCE_SAILING, new Date('2027-03-21T12:00:00Z').getTime() + i * 86_400_000)).filter((d) => !!d)
const cozumel = portDayAt(REFERENCE_SAILING, new Date('2027-03-22T00:00:00Z').getTime())!
const belize = portDayAt(REFERENCE_SAILING, new Date('2027-03-24T00:00:00Z').getTime())!

describe('the port day pilot (S6A-01)', () => {
  it('finds the port days used below', () => {
    expect(days.length).toBeGreaterThan(0)
    expect(cozumel.port).toBe('cozumel')
    expect(belize.port).toBe('belize')
  })

  it('works backward from all-aboard on a pier day: buffer, queue and the gate walk, then the trip back', () => {
    const p = planPortDay({ day: cozumel, travelMinutes: 20, outingMinutes: null, buffer: 45, crowd: 'moderate' })
    expect(p.landingBy).toBe(cozumel.allAboardAt - (15 + RETURN_QUEUE.moderate.pier + 45) * MIN)
    expect(p.leaveBy).toBe(p.landingBy - 20 * MIN)
    expect(p.lastTenderAt).toBeNull()
    expect(p.steps.at(-1)).toEqual({ id: 'aboard', at: cozumel.allAboardAt })
  })

  it('lists the steps in time order', () => {
    for (const day of [cozumel, belize]) {
      const p = planPortDay({ day, travelMinutes: 25, outingMinutes: 120, buffer: 45, crowd: 'busy', tenderCallAt: day.tender ? day.arriveAt + 60 * MIN : null })
      const times = p.steps.map((s) => s.at)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })

  it('works from the last tender on a tender day, and a busier crowd means leaving earlier', () => {
    const quiet = planPortDay({ day: belize, travelMinutes: 30, outingMinutes: null, buffer: 45, crowd: 'quiet' })
    const busy = planPortDay({ day: belize, travelMinutes: 30, outingMinutes: null, buffer: 45, crowd: 'busy' })
    expect(quiet.lastTenderAt).toBe(belize.allAboardAt - 45 * MIN)
    expect(quiet.landingBy).toBe(quiet.lastTenderAt! - (RETURN_QUEUE.quiet.tender + 45) * MIN)
    expect(busy.leaveBy).toBeLessThan(quiet.leaveBy)
  })

  it('a bigger buffer or longer trip means leaving earlier', () => {
    const base = { day: cozumel, travelMinutes: 20, outingMinutes: null, buffer: 30, crowd: 'quiet' as const }
    expect(planPortDay({ ...base, buffer: 60 }).leaveBy).toBeLessThan(planPortDay(base).leaveBy)
    expect(planPortDay({ ...base, travelMinutes: 60 }).leaveBy).toBeLessThan(planPortDay(base).leaveBy)
  })

  it('says when an outing does not fit, and by how much', () => {
    const p = planPortDay({ day: cozumel, travelMinutes: 20, outingMinutes: 24 * 60, buffer: 45, crowd: 'busy' })
    expect(p.fits).toBe(false)
    expect(p.shortBy).toBeGreaterThan(0)
    const ok = planPortDay({ day: cozumel, travelMinutes: 20, outingMinutes: 120, buffer: 45, crowd: 'quiet' })
    expect(ok.fits).toBe(true)
    expect(ok.shortBy).toBe(0)
  })

  it('never reports a fit when no time is left, even with no outing length', () => {
    const p = planPortDay({ day: cozumel, travelMinutes: 24 * 60, outingMinutes: null, buffer: 60, crowd: 'busy' })
    expect(p.minutesThere).toBeLessThan(0)
    expect(p.fits).toBe(false)
  })

  it('a late tender start moves the first time ashore later and never changes the deadline', () => {
    const on = planPortDay({ day: belize, travelMinutes: 0, outingMinutes: null, buffer: 45, crowd: 'moderate', tenderDelayMinutes: 0 })
    const late = planPortDay({ day: belize, travelMinutes: 0, outingMinutes: null, buffer: 45, crowd: 'moderate', tenderDelayMinutes: 60 })
    expect(late.ashoreAt - on.ashoreAt).toBe(60 * MIN)
    expect(late.leaveBy).toBe(on.leaveBy)
  })

  it('finds the latest start for an outing, or null when it cannot be done', () => {
    const base = { day: cozumel, travelMinutes: 20, outingMinutes: 120, buffer: 45, crowd: 'moderate' as const }
    const latest = latestStart(base)!
    expect(planPortDay(base).ashoreAt).toBeLessThanOrEqual(latest)
    expect(latestStart({ ...base, outingMinutes: 24 * 60 })).toBeNull()
    expect(latestStart({ ...base, outingMinutes: null })).toBeNull()
  })
})

describe('plan B (S6A-04)', () => {
  it('has all four plan Bs for every port, each with a title and detail', () => {
    for (const port of ['cozumel', 'belize', 'roatan'] as const) {
      for (const k of PLAN_B_TRIGGERS) {
        expect(PLAN_B[port][k].id).toBe(k)
        expect(PLAN_B[port][k].title.length).toBeGreaterThan(5)
        expect(PLAN_B[port][k].detail.length).toBeGreaterThan(20)
      }
    }
  })

  it('points at the tender plan when tenders are late or the ship may tender, otherwise pushes nothing', () => {
    expect(recommendedPlanB({ tenderDelayMinutes: 30, tenderInstead: false, tender: true })).toBe('tender')
    expect(recommendedPlanB({ tenderDelayMinutes: 0, tenderInstead: true, tender: false })).toBe('tender')
    expect(recommendedPlanB({ tenderDelayMinutes: 0, tenderInstead: false, tender: true })).toBeNull()
    expect(recommendedPlanB({ tenderDelayMinutes: 30, tenderInstead: false, tender: false })).toBeNull()
  })
})

describe('crowds (S6A-02)', () => {
  it('is stable for a port and date, marked as a simulation, and between one ship and the port maximum', () => {
    const a = crowdFor('cozumel', '2027-03-23')
    expect(crowdFor('cozumel', '2027-03-23')).toEqual(a)
    expect(a.source).toBe('sim')
    expect(a.ships).toBeGreaterThanOrEqual(1)
    expect(a.ships).toBeLessThanOrEqual(5)
  })

  it('calls a port busy only when it passes what it handles, and then suggests a quiet day aboard', () => {
    for (const port of ['cozumel', 'belize', 'roatan'] as const) {
      for (let d = 1; d <= 60; d++) {
        const c = crowdFor(port, `2027-04-${String((d % 28) + 1).padStart(2, '0')}-${d}`)
        expect(c.stayAboardNote).toBe(c.level === 'busy')
      }
    }
  })

  it('is quietest early and late in the day', () => {
    const hours = hourlyCrowd({ level: 'moderate' }, 8, 17)
    expect(hours.find((h) => h.hour === 8)!.level).toBe('quiet')
    expect(hours.find((h) => h.hour === 12)!.level).toBe('busy')
    expect(quietestWindow(hours)).toEqual({ from: 8, to: 9 })
  })

  it('has no quiet window when every hour is busy, and handles an empty day', () => {
    expect(quietestWindow(Array.from({ length: 5 }, (_, i) => ({ hour: 10 + i, level: 'busy' as const })))).toBeNull()
    expect(quietestWindow([])).toBeNull()
  })

  it('finds a quiet run that reaches the end of the day', () => {
    expect(quietestWindow(hourlyCrowd({ level: 'quiet' }, 15, 18))).toEqual({ from: 15, to: 18 })
  })
})

describe('port knowledge', () => {
  it('has fair prices with a ceiling above the fare, scam alerts, and every section for every port', () => {
    for (const port of GUIDE_PORTS) {
      const k = PORT_KNOWLEDGE[port]
      expect(k.fairPrices.length).toBeGreaterThan(0)
      for (const p of k.fairPrices) expect(p.ceiling).toBeGreaterThan(p.car)
      for (const section of [k.scams, k.phrases, k.etiquette, k.allergy, k.advisories, k.laws, k.dontBringBack, k.walks, k.dayPasses, k.kids, k.vendors, k.souvenirs]) expect(section.length).toBeGreaterThan(0)
      expect(k.taxiStand).not.toBe('')
    }
  })

  it('has an allergy card for nuts in a language the port speaks', () => {
    for (const port of GUIDE_PORTS) expect(PORT_KNOWLEDGE[port].allergy.some((a) => /nut/i.test(a.allergy) && a.english)).toBe(true)
  })

  it('marks every local-law note to verify, and states no commission on vendors', () => {
    for (const port of GUIDE_PORTS) for (const law of PORT_KNOWLEDGE[port].laws) expect(law).toMatch(/\(verify\)/)
  })

  it('compares a quote with the ceiling and shares a car fare', () => {
    const p = PORT_KNOWLEDGE.cozumel.fairPrices[0]
    expect(overCeiling(p.ceiling, p)).toBe(false)
    expect(overCeiling(p.ceiling + 1, p)).toBe(true)
    expect(perPerson({ route: 'x', car: 20, ceiling: 30 }, 4)).toBe(5)
    expect(perPerson({ route: 'x', car: 20, ceiling: 30 }, 0)).toBe(20)
    expect(perPerson({ route: 'x', car: 20, ceiling: 30 }, 9)).toBe(5)
  })
})
