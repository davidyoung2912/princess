import { describe, expect, it } from 'vitest'
import { meetingProblem, normalizeGuardianCopies, normalizeHelperCopies } from './stanleyGroup'

describe('guardian copies', () => {
  it('keeps the agreed shape and drops bad rows', () => {
    const r = normalizeGuardianCopies({
      hasChildren: true, children: ['Sam', 4], asOf: '2027-03-22T09:00:00Z', waiting: ['later'], notChecked: ['x'],
      made: [{ key: 'grp:aboard:a:2027-03-22', child: 'Sam', text: 'Sam: all aboard in Cozumel is in an hour.', dueAt: '2027-03-22T15:00:00Z' }, { key: '', text: 'no key', dueAt: '2027-03-22T15:00:00Z' }, { key: 'k', text: 't', dueAt: 'nope' }, 5],
    })
    expect(r?.children).toEqual(['Sam'])
    expect(r?.made).toHaveLength(1)
    expect(r?.made[0]?.child).toBe('Sam')
  })
  it('refuses a shape it does not know', () => {
    expect(normalizeGuardianCopies(null)).toBeNull()
    expect(normalizeGuardianCopies({ children: [] })).toBeNull()
  })
})

describe('helper copies choice', () => {
  it('reads on or off and refuses another shape', () => {
    expect(normalizeHelperCopies({ on: true, since: '2027-03-01T00:00:00Z', notChecked: ['a', 3] })).toEqual({ on: true, since: '2027-03-01T00:00:00Z', notChecked: ['a'] })
    expect(normalizeHelperCopies({ on: 'yes' })).toBeNull()
    expect(normalizeHelperCopies(null)).toBeNull()
  })
})

describe('meetingProblem', () => {
  it('keeps the codes it knows and calls the rest other', () => {
    expect(meetingProblem('notGoing')).toBe('notGoing')
    expect(meetingProblem('boom')).toBe('other')
  })
})
