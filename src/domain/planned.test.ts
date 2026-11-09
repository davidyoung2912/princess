import { describe, expect, it } from 'vitest'
import { plannedForDay, type PlanDay } from './plan'
import type { Change } from './planChange'

const day = (entries: PlanDay['entries'] = []): PlanDay => ({ day: 3, date: '2027-03-01', port: 'sea', place: '', entries, gaps: [] })
const add = (id: string, start: string, kind: 'tour' | 'dinner' | 'added' = 'added') => ({ op: 'add' as const, entry: { id, title: id, start, minutes: 60, kind, outdoor: false, path: '/plan' } })
const change = (over: Partial<Change>): Change => ({ id: 'c', day: 3, source: 'autopilot', cause: '', title: '', why: '', edits: [], status: 'accepted', proposedAt: 1, undoUntil: 2, ...over })

describe('planned but not booked (PRE-01)', () => {
  it('lists entries added by accepted changes only, in time order', () => {
    const list = plannedForDay([change({ edits: [add('b', '15:00'), add('a', '09:00')] }), change({ id: 'p', status: 'proposed', edits: [add('x', '10:00')] }), change({ id: 'u', status: 'undone', edits: [add('y', '11:00')] })], day())
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
  })
  it('honours later drops and moves, and ignores other days', () => {
    const list = plannedForDay([
      change({ proposedAt: 1, edits: [add('a', '09:00'), add('b', '10:00')] }),
      change({ id: 'd', proposedAt: 5, edits: [{ op: 'drop', id: 'a' }, { op: 'move', id: 'b', to: '12:00' }] }),
      change({ id: 'o', day: 4, edits: [add('z', '08:00')] }),
    ], day())
    expect(list).toEqual([{ id: 'b', time: '12:00', title: 'b', kind: 'added' }])
  })
  it('leaves out what is already a confirmed booking at the same time', () => {
    const d = day([{ kind: 'dinner', time: '19:00', name: 'Horizon', id: 't', guests: [] }])
    expect(plannedForDay([change({ edits: [add('dn', '19:00', 'dinner'), add('t2', '15:00', 'tour')] })], d).map((p) => p.id)).toEqual(['t2'])
  })
})
