import { describe, expect, it } from 'vitest'
import { hasTours, normalizeTrialDay } from './trialDay'

const plan = { day: 3, items: [{ id: 'x', title: 'Snorkel', start: '09:00', minutes: 120, kind: 'tour', outdoor: true, path: '/plan/excursions', why: 'matches what you like' }], empty: false, backBy: '15:30', alternatives: [], shipChanges: [] }
const days = [{ day: 2, port: 'sea', place: 'At sea' }, { day: 3, port: 'cozumel', place: 'Cozumel, Mexico' }]

describe('a day on this ship for someone not signed in (N6.1)', () => {
  it('reads the days to choose from and the plan', () => {
    const t = normalizeTrialDay({ days, plan })!
    expect(t.days).toHaveLength(2)
    expect(t.plan.items[0].title).toBe('Snorkel')
    expect(t.plan.backBy).toBe('15:30')
  })

  it('ignores an answer in the wrong shape rather than drawing half a page', () => {
    expect(normalizeTrialDay(null)).toBeNull()
    expect(normalizeTrialDay({ days: [], plan })).toBeNull()
    expect(normalizeTrialDay({ days: [{ day: 9, port: 'sea', place: 'x' }], plan })).toBeNull()
    expect(normalizeTrialDay({ days: [{ day: 2, port: 'sea', place: '' }], plan })).toBeNull()
    expect(normalizeTrialDay({ days, plan: { day: 3 } })).toBeNull()
  })

  it('offers tours only on a port day, not at sea or at the home port', () => {
    expect(hasTours({ day: 3, port: 'cozumel', place: 'Cozumel' })).toBe(true)
    expect(hasTours({ day: 2, port: 'sea', place: 'At sea' })).toBe(false)
    expect(hasTours({ day: 1, port: 'fll', place: 'Fort Lauderdale' })).toBe(false)
    expect(hasTours(undefined)).toBe(false)
  })
})
