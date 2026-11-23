import { describe, expect, it } from 'vitest'
import { coordinatorProblem, isCoordinable, mayCoordinate, reminderReason, remainingLine } from './chatCoordinator'

describe('the group coordinator helpers', () => {
  it('offers the buttons only to an admin of a group that let Stanley help', () => {
    expect(mayCoordinate({ on: true, canChange: true })).toBe(true)
    expect(mayCoordinate({ on: true, canChange: false })).toBe(false)
    expect(mayCoordinate({ on: false, canChange: true })).toBe(false)
    expect(mayCoordinate(null)).toBe(false)
  })

  it('tallies only a poll or a plan that has not been deleted', () => {
    expect(isCoordinable({ kind: 'poll' })).toBe(true)
    expect(isCoordinable({ kind: 'plan' })).toBe(true)
    expect(isCoordinable({ kind: 'poll', deleted: true })).toBe(false)
    expect(isCoordinable({ kind: 'card' })).toBe(false)
    expect(isCoordinable({})).toBe(false)
  })

  it('maps a refusal to one sentence', () => {
    expect(coordinatorProblem('forbidden', 'notAdmin')).toBe('notAdmin')
    expect(coordinatorProblem('conflict', 'tooSoon')).toBe('tooSoon')
    expect(coordinatorProblem('tooMany', 'busy')).toBe('busy')
    expect(coordinatorProblem('network', undefined)).toBe('offline')
    expect(coordinatorProblem('server', 'boom')).toBe('other')
  })

  it('says why a reminder cannot go, and nothing when it can', () => {
    expect(reminderReason({ canRemind: true })).toBeNull()
    expect(reminderReason({ canRemind: false, reason: 'tooSoon' })).toBe('tooSoon')
    expect(reminderReason({ canRemind: false })).toBe('none')
  })

  it('reads an item as counts and never a name', () => {
    expect(remainingLine({ messageId: 'a', kind: 'poll', title: 'Dinner?', answered: 3, total: 5, closed: false })).toBe('Dinner?: 3 of 5 answered')
  })
})
