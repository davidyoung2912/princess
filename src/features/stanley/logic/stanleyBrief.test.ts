import { describe, expect, it } from 'vitest'
import { normalizeBrief, normalizeBriefState, timeOk } from './stanleyBrief'

const state = (over: Record<string, unknown> = {}) => ({ settings: { morning: true, morningAt: '07:30', evening: false, eveningAt: '19:00' }, allowed: true, nextMorning: 1800000000000, nextEvening: null, ...over })

describe('stanley briefs', () => {
  it('reads a 24-hour time only', () => {
    expect(timeOk('07:30')).toBe(true)
    expect(timeOk('24:00')).toBe(false)
    expect(timeOk('7:30')).toBe(false)
    expect(timeOk(730)).toBe(false)
  })

  it('reads the state and refuses a shape it does not know', () => {
    expect(normalizeBriefState(state())).toMatchObject({ allowed: true, nextMorning: 1800000000000, nextEvening: null })
    expect(normalizeBriefState(state({ settings: { morning: true, morningAt: 'soon', evening: false, eveningAt: '19:00' } }))).toBeNull()
    expect(normalizeBriefState(state({ nextMorning: 'x' }))!.nextMorning).toBeNull()
    expect(normalizeBriefState(null)).toBeNull()
  })

  it('keeps app routes on brief lines and drops any other', () => {
    const b = normalizeBrief({ kind: 'morning', date: '2027-03-21', title: 'Today at a glance', lines: [{ text: 'Day 2: Cozumel.', route: null }, { text: 'Dinner', route: '/plan/dining' }, { text: 'Bad', route: 'https://x.test' }, 'junk', { text: '' }] })!
    expect(b.lines.map((l) => l.route)).toEqual([null, '/plan/dining', null])
    expect(normalizeBrief({ kind: 'noon', lines: [], title: 'x' })).toBeNull()
    expect(normalizeBrief({ kind: 'evening', lines: [], title: '' })).toBeNull()
  })
})
