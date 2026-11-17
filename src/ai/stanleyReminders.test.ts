import { describe, expect, it } from 'vitest'
import { defaultLeadMin, editTime, groupReminders, normalizeReminder, normalizeReminders, reminderContext, reminderProblem, remindMeArgs } from './stanleyReminders'

const raw = (over: Record<string, unknown> = {}) => ({ id: 'r1', text: 'Be back', dueAt: '2027-03-22T20:15:00Z', when: 'Today, Mon 22 Mar, 4:15 PM ship time', kind: 'clock', anchor: null, lead: null, state: 'scheduled', note: null, private: false, past: false, ...over })

describe('reminders from the server', () => {
  it('reads the agreed shape and nothing else', () => {
    expect(normalizeReminder(raw())).toMatchObject({ id: 'r1', text: 'Be back', dueAt: Date.parse('2027-03-22T20:15:00Z'), kind: 'clock', state: 'scheduled', anchor: null })
    expect(normalizeReminder(raw({ kind: 'odd' }))).toBeNull()
    expect(normalizeReminder(raw({ dueAt: 'soon' }))).toBeNull()
    expect(normalizeReminder(raw({ id: '' }))).toBeNull()
    expect(normalizeReminder(null)).toBeNull()
    expect(normalizeReminder(raw({ text: 'x'.repeat(500) }))?.text).toHaveLength(80)
  })

  it('lists soonest first and drops what it cannot read', () => {
    const list = normalizeReminders([raw({ id: 'b', dueAt: '2027-03-23T10:00:00Z' }), 'junk', raw({ id: 'a' })])
    expect(list.map((r) => r.id)).toEqual(['a', 'b'])
    expect(normalizeReminders({})).toEqual([])
  })

  it('separates the ones waiting from the ones that ended or have gone', () => {
    const list = normalizeReminders([raw({ id: 'w' }), raw({ id: 'c', state: 'cancelled', note: 'It is off.' }), raw({ id: 'p', past: true })])
    const g = groupReminders(list)
    expect(g.upcoming.map((r) => r.id)).toEqual(['w'])
    expect(g.ended.map((r) => r.id).sort()).toEqual(['c', 'p'])
    expect(normalizeReminder(raw({ state: 'cancelled', note: 'It is off.' }))?.note).toBe('It is off.')
  })
})

describe('the Remind me button', () => {
  it('follows a plan item or all aboard with the lead for its kind', () => {
    expect(defaultLeadMin('plan')).toBe(30)
    expect(defaultLeadMin('allAboard')).toBe(60)
    expect(remindMeArgs({ kind: 'plan', id: 'show1', title: 'Evening Show', start: '20:00' }, 30, 'Evening Show')).toEqual({ when: 'anchored', anchor: 'show1', offset: '30', at: '20:00', text: 'Evening Show' })
    expect(remindMeArgs({ kind: 'allAboard', at: '16:30' }, 60, 'All aboard')).toEqual({ when: 'anchored', anchor: 'allAboard', offset: '60', at: '16:30', text: 'All aboard' })
  })

  it('keeps the lead and the words inside what the server takes', () => {
    expect(remindMeArgs({ kind: 'plan', id: 'trivia', title: 'Trivia', start: '11:00' }, 30, 'Trivia', '2027-03-24')).toEqual({ when: 'anchored', anchor: 'trivia', offset: '30', at: '11:00', text: 'Trivia', date: '2027-03-24' })
    expect(remindMeArgs({ kind: 'allAboard', at: '16:30' }, 30, 'x', 'tomorrow')).not.toHaveProperty('date')
    expect(remindMeArgs({ kind: 'allAboard', at: '16:30' }, -5, 'x').offset).toBe('0')
    expect(remindMeArgs({ kind: 'allAboard', at: '16:30' }, 99999, 'x').offset).toBe('1440')
    expect(remindMeArgs({ kind: 'allAboard', at: '16:30' }, 30, 'y'.repeat(200)).text).toHaveLength(80)
  })

  it('sends the plan, and an all aboard time only when there is one', () => {
    expect(reminderContext([], null, 'S1')).toEqual({ plan: [], sailingId: 'S1' })
    expect(reminderContext(undefined, '16:30', 'S1')).toEqual({ plan: [], allAboard: { at: '16:30', label: 'ship' }, sailingId: 'S1' })
  })
})

describe('editing', () => {
  it('takes only a clock time and a date', () => {
    expect(editTime('17:00', '2027-03-23')).toEqual({ at: '17:00', date: '2027-03-23' })
    expect(editTime('5pm', '2027-03-23')).toBeNull()
    expect(editTime('17:00', 'tomorrow')).toBeNull()
  })

  it('names the refusals the server gives', () => {
    expect(['past', 'tooFar', 'time', 'text', 'tooMany', 'forbidden'].map(reminderProblem)).toEqual(['past', 'tooFar', 'time', 'text', 'tooMany', 'forbidden'])
    expect(reminderProblem('boom')).toBe('other')
  })
})
