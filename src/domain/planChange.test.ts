import { describe, expect, it } from 'vitest'
import {
  acceptChange, addProposal, applyChanges, canUndo, changeLog, programmeDiff, programmeEffects, declineChange, parseTime, proposeReflow, requestChange, shipChangesFor, undoChange, visibleRows,
  type Change, type PlanEntry,
} from './planChange'

const MIN = 60_000
const NOW = 1_000_000
const DAY_END = NOW + 600 * MIN
const ctx = { now: NOW, day: 2, dayEndAt: DAY_END }
const entry = (id: string, start: string, minutes: number, extra: Partial<PlanEntry> = {}): PlanEntry => ({ id, title: id, start, minutes, kind: 'event', outdoor: false, path: '/plan', ...extra })
const rowsOf = (list: PlanEntry[]) => applyChanges(list, [])

describe('reflow is only ever a proposal', () => {
  const plan = [entry('show', '20:30', 60), entry('dinner', '18:30', 90, { kind: 'dinner' }), entry('talk', '15:00', 45)]

  it('proposes and does not touch the plan until accepted', () => {
    const c = proposeReflow(rowsOf(plan), { kind: 'moved', id: 'show', to: '21:15' }, [], ctx)
    expect(c?.status).toBe('proposed')
    expect(applyChanges(plan, c ? [c] : []).find((r) => r.entry.id === 'show')?.entry.start).toBe('20:30')
  })

  it('moves a show and shows the start it had', () => {
    const c = proposeReflow(rowsOf(plan), { kind: 'moved', id: 'show', to: '21:15' }, [], ctx)!
    const done = acceptChange(plan, [c], c.id, NOW + 1)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const row = applyChanges(plan, done.changes).find((r) => r.entry.id === 'show')!
    expect(row.entry.start).toBe('21:15')
    expect(row.state).toBe('moved')
    expect(row.was).toBe('20:30')
  })

  it('drops rather than crossing dinner, and says so', () => {
    const c = proposeReflow(rowsOf(plan), { kind: 'moved', id: 'talk', to: '18:45' }, [], ctx)!
    expect(c.edits).toEqual([{ op: 'drop', id: 'talk' }])
    expect(c.why).toContain('dinner')
  })

  it('shifts a later event the move would cross', () => {
    const two = [entry('a', '20:00', 60), entry('b', '21:30', 60)]
    const c = proposeReflow(rowsOf(two), { kind: 'moved', id: 'a', to: '21:00' }, [], ctx)!
    expect(c.edits).toEqual([{ op: 'move', id: 'a', to: '21:00' }, { op: 'move', id: 'b', to: '22:15' }])
  })

  it('swaps a cancelled event for one that fits, else just drops it', () => {
    const alt = entry('alt', '14:00', 45)
    const swap = proposeReflow(rowsOf(plan), { kind: 'cancelled', id: 'talk' }, [alt], ctx)!
    expect(swap.edits).toEqual([{ op: 'drop', id: 'talk' }, { op: 'add', entry: { ...alt, kind: 'added' } }])
    const clash = entry('alt2', '20:45', 45)
    const plain = proposeReflow(rowsOf(plan), { kind: 'cancelled', id: 'talk' }, [clash], ctx)!
    expect(plain.edits).toEqual([{ op: 'drop', id: 'talk' }])
  })

  it('moves outdoor events indoors in the rain but leaves a shore tour to its operator', () => {
    const wet = [entry('pool', '14:00', 60, { outdoor: true }), entry('tour', '09:00', 300, { kind: 'tour', outdoor: true })]
    const inside = entry('indoor', '14:00', 60)
    const c = proposeReflow(rowsOf(wet), { kind: 'rain', from: '13:00', to: '17:00' }, [inside], ctx)!
    expect(c.edits.map((e) => e.op)).toEqual(['drop', 'add'])
    expect(c.edits.some((e) => 'id' in e && e.id === 'tour')).toBe(false)
    expect(c.why).toContain('operator')
    expect(proposeReflow(rowsOf([entry('x', '10:00', 60)]), { kind: 'rain', from: '13:00', to: '17:00' }, [], ctx)).toBeNull()
  })

  it('moves a tour for a late tender and warns when the margin is thin', () => {
    const t = [entry('tour', '08:30', 420, { kind: 'tour' })]
    const c = proposeReflow(rowsOf(t), { kind: 'tender', delayMinutes: 40, allAboard: '16:30' }, [], ctx)!
    expect(c.edits).toEqual([{ op: 'move', id: 'tour', to: '09:10' }])
    expect(c.warning).toContain('16:30')
    expect(proposeReflow(rowsOf(t), { kind: 'tender', delayMinutes: 0, allAboard: '16:30' }, [], ctx)).toBeNull()
  })

  it('names the cause and the day in the id, so one cause is offered once', () => {
    const a = proposeReflow(rowsOf(plan), { kind: 'moved', id: 'show', to: '21:15' }, [], ctx)!
    const b = proposeReflow(rowsOf(plan), { kind: 'moved', id: 'show', to: '21:15' }, [], { ...ctx, now: NOW + 5 })!
    expect(a.id).toBe(b.id)
    expect(a.day).toBe(2)
  })

  it('finds the real ship changes on a day', () => {
    const served = [{ id: 'stage-show', kind: 'moved' as const, start: '21:15', reason: 'Weather' }, { id: 'trivia', kind: 'cancelled' as const, start: null, reason: null }, { id: 'gone', kind: 'cancelled' as const, start: null, reason: null }]
    const causes = shipChangesFor(served, rowsOf([entry('trivia', '10:30', 45), entry('stage-show', '20:30', 60)]))
    expect(causes.map((c) => c.kind).sort()).toEqual(['cancelled', 'moved'])   // a change to an event that is not in the plan is left out
  })
})

describe('accept, decline, undo and the log', () => {
  const plan = [entry('a', '10:00', 60), entry('b', '12:00', 60)]
  const prop = (id: string, edits: Change['edits'], extra: Partial<Change> = {}): Change => ({ id, day: 2, source: 'autopilot', cause: 'x', title: id, why: '', edits, status: 'proposed', proposedAt: NOW, undoUntil: DAY_END, ...extra })

  it('refuses a change that would make the day cross itself', () => {
    const bad = prop('bad', [{ op: 'move', id: 'b', to: '10:30' }])
    expect(acceptChange(plan, [bad], 'bad', NOW + 1)).toEqual({ ok: false, reason: 'conflict' })
  })

  it('refuses after the period is over and when nothing is waiting', () => {
    const c = prop('c', [{ op: 'drop', id: 'a' }])
    expect(acceptChange(plan, [c], 'c', DAY_END)).toEqual({ ok: false, reason: 'closed' })
    expect(acceptChange(plan, [c], 'zzz', NOW)).toEqual({ ok: false, reason: 'missing' })
    expect(acceptChange(plan, [{ ...c, status: 'declined' }], 'c', NOW)).toEqual({ ok: false, reason: 'missing' })
  })

  it('undoes inside the period and not after', () => {
    const c = prop('c', [{ op: 'drop', id: 'a' }])
    const acc = acceptChange(plan, [c], 'c', NOW + 1)
    if (!acc.ok) throw new Error('expected accept')
    expect(canUndo(acc.changes[0], NOW + 2)).toBe(true)
    const back = undoChange(acc.changes, 'c', NOW + 2)
    expect(back[0].status).toBe('undone')
    expect(applyChanges(plan, back).every((r) => r.state === 'planned')).toBe(true)
    expect(undoChange(acc.changes, 'c', DAY_END)[0].status).toBe('accepted')
  })

  it('declines only what is waiting, and logs newest first', () => {
    const c1 = prop('c1', [], { proposedAt: 1 })
    const c2 = prop('c2', [], { proposedAt: 2, status: 'accepted', decidedAt: 9 })
    expect(declineChange([c1, c2], 'c2', 5)[1].status).toBe('accepted')
    expect(declineChange([c1, c2], 'c1', 5)[0].status).toBe('declined')
    expect(changeLog([c1, c2]).map((c) => c.id)).toEqual(['c2', 'c1'])
  })

  it('offers a change once', () => {
    const c = prop('c', [])
    expect(addProposal(addProposal([], c), c)).toHaveLength(1)
  })

  it('keeps a dropped item visible until the day ends', () => {
    const rows = applyChanges(plan, [prop('d', [{ op: 'drop', id: 'a' }], { status: 'accepted' })])
    expect(visibleRows(rows, NOW, DAY_END)).toHaveLength(2)
    expect(visibleRows(rows, DAY_END, DAY_END)).toHaveLength(1)
  })
})

describe('assistant requests', () => {
  const plan = [entry('trivia', '10:30', 45, { title: 'Team trivia' }), entry('dinner', '18:30', 90, { kind: 'dinner', title: 'Dinner in the Eclipse Dining Room' })]
  const rows = rowsOf(plan)
  const alt = entry('movie', '20:00', 120, { title: 'Movie under the stars' })

  it('reads times the way a person says them', () => {
    expect(parseTime('at 8')).toBe('20:00')
    expect(parseTime('7:30 pm')).toBe('19:30')
    expect(parseTime('11am')).toBe('11:00')
    expect(parseTime('12 am')).toBe('00:00')
    expect(parseTime('nothing')).toBeNull()
  })

  it('proposes moving dinner, with a stated undo period', () => {
    const r = requestChange('Move dinner to 8', rows, [alt], NOW, 2)
    expect(r.ok && r.change.edits).toEqual([{ op: 'move', id: 'dinner', to: '20:00' }])
    expect(r.ok && r.change.status).toBe('proposed')
    expect(r.ok && r.change.undoUntil - NOW).toBe(120 * MIN)
  })

  it('proposes dropping and adding, and says when it cannot tell', () => {
    expect(requestChange('skip team trivia', rows, [], NOW, 2).ok).toBe(true)
    const add = requestChange('add the movie under the stars', rows, [alt], NOW, 2)
    expect(add.ok && add.change.edits[0].op).toBe('add')
    expect(requestChange('add karaoke', rows, [alt], NOW, 2)).toEqual({ ok: false, reason: 'nothing' })
    expect(requestChange('make it nicer', rows, [], NOW, 2)).toEqual({ ok: false, reason: 'unclear' })
    expect(requestChange('move the thing', rows, [], NOW, 2)).toEqual({ ok: false, reason: 'unclear' })
  })

  it('runs an assistant change through the same conflict rule', () => {
    const r = requestChange('move trivia to 6:45 pm', rows, [], NOW, 2)
    if (!r.ok) throw new Error('expected a proposal')
    expect(acceptChange(plan, [r.change], r.change.id, NOW + 1)).toEqual({ ok: false, reason: 'conflict' })
  })
})

describe('what a change does to the programme on the account', () => {
  const base = [entry('bingo', '14:00', 60), entry('jazz', '21:30', 90), entry('tour1', '09:00', 240, { kind: 'tour' }), entry('dinner1', '19:00', 90, { kind: 'dinner' })]
  const change = (edits: Change['edits'], status: Change['status'] = 'accepted'): Change => ({ id: 'c1', day: 2, source: 'autopilot', cause: '', title: '', why: '', edits, status, proposedAt: NOW, undoUntil: NOW + MIN })

  it('takes a dropped event out and puts an added one in, and leaves tours, dinners, moves and pasted lines alone', () => {
    const c = change([{ op: 'drop', id: 'bingo' }, { op: 'add', entry: entry('jazz', '21:30', 90) }, { op: 'drop', id: 'tour1' }, { op: 'drop', id: 'dinner1' }, { op: 'move', id: 'jazz', to: '22:00' }, { op: 'add', entry: entry('mine', '10:00', 30, { kind: 'added' }) }])
    expect(programmeEffects(c, base)).toEqual([{ eventId: 'bingo', on: false }, { eventId: 'jazz', on: true }])
    expect(programmeEffects(c, base, true)).toEqual([{ eventId: 'bingo', on: true }, { eventId: 'jazz', on: false }])
  })
  it('keeps the last word when a change touches an event twice', () => {
    expect(programmeEffects(change([{ op: 'drop', id: 'bingo' }, { op: 'add', entry: entry('bingo', '14:00', 60) }]), base)).toEqual([{ eventId: 'bingo', on: true }])
  })
  it('acts only on the step from proposed to accepted, and from accepted to undone', () => {
    const baseFor = () => base
    const drop = [{ op: 'drop' as const, id: 'bingo' }]
    expect(programmeDiff([change(drop, 'proposed')], [change(drop, 'accepted')], baseFor)).toEqual([{ day: 2, effects: [{ eventId: 'bingo', on: false }] }])
    expect(programmeDiff([change(drop, 'accepted')], [change(drop, 'accepted')], baseFor)).toEqual([])
    expect(programmeDiff([change(drop, 'accepted')], [change(drop, 'undone')], baseFor)).toEqual([{ day: 2, effects: [{ eventId: 'bingo', on: true }] }])
    expect(programmeDiff([change(drop, 'proposed')], [change(drop, 'declined')], baseFor)).toEqual([])
    expect(programmeDiff([], [change(drop, 'accepted')], baseFor)).toHaveLength(1)   // a change made and accepted in one step (the assistant)
  })
})
