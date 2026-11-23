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
    expect(normalizeTrialDay({ days: [{ day: 42, port: 'sea', place: 'x' }], plan })).toBeNull()
    expect(normalizeTrialDay({ days: [{ day: 2, port: 'sea', place: '' }], plan })).toBeNull()
    expect(normalizeTrialDay({ days, plan: { day: 3 } })).toBeNull()
  })

  it('offers tours only on a port day, not at sea or at the home port', () => {
    const week = [{ day: 1, port: 'fll', place: 'Fort Lauderdale' }, { day: 2, port: 'sea', place: 'At sea' }, { day: 3, port: 'cozumel', place: 'Cozumel' }, { day: 4, port: 'fll', place: 'Fort Lauderdale' }]
    expect(hasTours(week[2], week)).toBe(true)
    expect(hasTours(week[1], week)).toBe(false)
    expect(hasTours(week[0], week)).toBe(false)
    expect(hasTours(week[3], week)).toBe(false)
    expect(hasTours(undefined)).toBe(false)
  })
})
