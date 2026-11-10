import { describe, expect, it } from 'vitest'
import { accessRows, relationshipOf } from './access'
import { EMPTY_HOME } from './homeLink'
import { EMPTY_PARTY } from './party'
import { NOTHING_SHARED } from './partyShare'
import { TASKS, TASKS_NEVER_SHARED, TASKS_NOT_OFFERED, taskOf, tasksFor } from './relationships'
import { PERMISSIONS } from './account'

describe('relationships and tasks (IDN-04, IDN-05)', () => {
  it('maps every helper permission to a task or deliberately to none', () => {
    expect(PERMISSIONS.map((p) => [p, taskOf(p)])).toEqual([
      ['view', 'itinerary'], ['documents', 'documents'], ['payments', 'pay'], ['profile', null], ['folio', 'folio'], ['checkin', 'checkin'], ['trip', 'itinerary'], ['stanley', null],
    ])
  })
  it('lists the distinct tasks in the fixed order', () => {
    expect(tasksFor(['folio', 'view', 'trip', 'payments'])).toEqual(['itinerary', 'pay', 'folio'])
    expect(tasksFor([])).toEqual([])
  })
  it('never offers location, and says which tasks nothing grants yet', () => {
    expect(TASKS_NEVER_SHARED).toEqual(['location'])
    const granted = new Set(PERMISSIONS.map(taskOf))
    for (const t of TASKS) if (!granted.has(t)) expect([...TASKS_NOT_OFFERED, ...TASKS_NEVER_SHARED]).toContain(t)
  })
  it('names the family link the household and puts tasks and stoppable on each row', () => {
    expect(relationshipOf('home')).toBe('household')
    expect(relationshipOf('helper')).toBe('helper')
    const helper = { name: 'Sam', relationship: 'Son', permissions: ['view' as const, 'payments' as const], status: 'active' as const, at: 1, linked: true, inviteCode: null, inviteExpires: null }
    const party = { invites: [{ id: 'i1', email: 'a@b.co', at: 1 }], notes: [] }
    const rows = accessRows({ helper, home: EMPTY_HOME, party, sharing: NOTHING_SHARED, now: 0 })
    expect(rows.find((r) => r.kind === 'helper')).toMatchObject({ tasks: ['itinerary', 'pay'], stoppable: true })
    expect(rows.find((r) => r.kind === 'invite')).toMatchObject({ tasks: [], stoppable: true })
    expect(rows.find((r) => r.kind === 'party')).toMatchObject({ stoppable: false })
    expect(EMPTY_PARTY.invites).toEqual([])
  })
})
