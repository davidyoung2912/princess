import { describe, expect, it } from 'vitest'
import { cleanNote, groupRequest, hardConflicts, isReady, normalizeDay, normalizeEvening, normalizeGroupStatus, normalizeHour, normalizeMeeting, normalizePreview, normalizeTourCompare } from './stanleyPlanner'

describe('Stanley planner (device side)', () => {
  it('reads a day defensively and never trusts ready over a hard conflict', () => {
    const d = normalizeDay({
      day: 3, scenario: 'mixed', ready: true, backBy: '15:45',
      segments: [{ id: 'coz-snorkel', title: 'Snorkel', kind: 'tour', source: 'reserved', start: '08:30', end: '12:00', clock: 'port', cost: 'paid', cents: 7900 }, { nope: 1 }],
      conflicts: [{ severity: 'hard', code: 'overlap', ids: ['a', 'b'], text: 'x' }, { severity: 'soft' }],
      windows: [{ start: '13:00', end: '14:00', minutes: 60 }], notes: ['n', 4],
      traveller: { name: 'Dad', source: 'weird', changes: [{ id: 'a', severity: 'change', text: 't' }], humanCheck: true, note: 'n' },
    })!
    expect(d.segments).toHaveLength(1)
    expect(d.segments[0]).toMatchObject({ source: 'reserved', clock: 'port', cost: 'paid' })
    expect(d.traveller).toMatchObject({ source: 'unknown', humanCheck: true })
    expect(hardConflicts(d)).toHaveLength(1)
    expect(isReady(d)).toBe(false)
    expect(normalizeDay({})).toBeNull()
  })

  it('reads an hour with at most three options and unknown costs as included', () => {
    const h = normalizeHour({ from: '10:00', to: '11:00', occupancy: 'none', options: Array.from({ length: 5 }, (_, i) => ({ kind: 'place', id: 'p' + i, title: 'P', cost: 'weird', walk: 2, meets: ['quiet'] })) })!
    expect(h.options).toHaveLength(3)
    expect(h.options[0].cost).toBe('included')
    expect(normalizeHour(null)).toBeNull()
  })

  it('reads an evening and drops a route that is not a path of the app', () => {
    const e = normalizeEvening({ steps: [{ kind: 'dinner', title: 'D', start: '18:30', end: '20:00', route: '/plan/dining' }, { kind: 'show', title: 'S', route: 'https://x.test' }], complete: false })!
    expect(e.steps.map((s) => s.route)).toEqual(['/plan/dining', null])
    expect(e.complete).toBe(false)
  })

  it('reads a meeting, a preview and a tour comparison', () => {
    expect(normalizeMeeting({ text: 'Meet', placeName: 'P', deck: 7, section: 'midship' })).toMatchObject({ deck: 7 })
    expect(normalizeMeeting({ text: '' })).toBeNull()
    expect(normalizePreview({ excursion: 'X', problem: 'soldOut', freeCancelOpen: true, lost: ['a'], newConflicts: [{ code: 'overlap', severity: 'hard', ids: [], text: 't' }] })).toMatchObject({ problem: 'soldOut', freeCancelOpen: true })
    expect(normalizePreview({})).toBeNull()
    const c = normalizeTourCompare({ nameA: 'A', nameB: 'B', rows: [{ key: 'price', a: '$1', b: '$2', differs: true }, {}], risks: ['r'], missing: [] })!
    expect(c.rows).toHaveLength(1)
  })

  it('reads a group status', () => {
    const g = normalizeGroupStatus({ state: 'odd', answered: 1, silent: 2, tally: [{ id: 'a', label: 'A', yes: 1, maybe: 0, no: 0 }], suggestion: { kind: 'leading', optionIds: ['a'], text: 't' }, reminderDue: true, reminderText: 'r', controls: ['remind'] })!
    expect(g.state).toBe('open')
    expect(g.suggestion.kind).toBe('leading')
    expect(g.reminderDue).toBe(true)
    expect(normalizeGroupStatus({})).toBeNull()
  })

  it('turns a poll into a request where a vote is a yes and silence is an empty answer', () => {
    const r = groupRequest({ question: 'Q', options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }], votes: { p1: 'o2', p3: 'gone' }, closedAt: undefined }, [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }], true)
    expect(r.members).toEqual([{ name: 'Ann', answers: { o2: 'yes' } }, { name: 'Bo', answers: {} }, { name: 'Cy', answers: {} }])
    expect(r.closed).toBe(false)
    expect(JSON.stringify(r)).not.toContain('reason')
  })

  it('cuts a meeting note to the limit', () => {
    expect(cleanNote('  ' + 'x'.repeat(300))).toHaveLength(100)
  })
})
