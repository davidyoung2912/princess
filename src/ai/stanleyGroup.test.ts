import { describe, expect, it } from 'vitest'
import { normalizeGuardianCopies } from './stanleyGroup'

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
