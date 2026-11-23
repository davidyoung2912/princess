import { describe, expect, it } from 'vitest'
import { normalizeWalkingPlan } from './walkingPlan'

const good = { plan: { stops: [{ name: 'Old Town', tier: 'Walk-Off', lat: 42.4, lng: 18.7, arriveAt: '08:20', leaveAt: '09:05', walkFromPrevious: 0 }], usable: 430, walking: 20, visiting: 45, meal: 0, spare: 230, returnWalk: 3, headBackBy: '11:32', allAboard: '16:30', reason: null } }

describe('walking plan feed', () => {
  it('reads a good plan into the planner shape', () => {
    const p = normalizeWalkingPlan(good)!
    expect(p.stops[0]).toMatchObject({ id: 'Old Town', at: { lat: 42.4, lng: 18.7 }, arriveAt: '08:20' })
    expect(p.headBackBy).toBe('11:32')
  })
  it('refuses anything malformed', () => {
    expect(normalizeWalkingPlan(null)).toBeNull()
    expect(normalizeWalkingPlan({ plan: { ...good.plan, headBackBy: '11.32' } })).toBeNull()
    expect(normalizeWalkingPlan({ plan: { ...good.plan, reason: 'bad' } })).toBeNull()
    expect(normalizeWalkingPlan({ plan: { ...good.plan, stops: [{ ...good.plan.stops[0], lat: 99 }] } })).toBeNull()
    expect(normalizeWalkingPlan({ plan: { ...good.plan, stops: [{ ...good.plan.stops[0], arriveAt: 'soon' }] } })).toBeNull()
  })
})
