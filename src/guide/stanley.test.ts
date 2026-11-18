import { describe, expect, it } from 'vitest'
import { guide, task } from './fixture'
import { doItFor, helpScreenId, nowTask, remindDay, taskRemindArgs } from './stanley'

describe('nowTask', () => {
  it('is the guide primary, so Stanley and Home agree', () => {
    const v = guide('manage', [task('manage.pay', { state: 'done' }), task('manage.documents'), task('manage.readiness')])
    expect(nowTask(v)?.id).toBe('manage.documents')
  })
  it('is null with no guide or nothing to do', () => {
    expect(nowTask(null)).toBeNull()
    expect(nowTask(guide('manage', [task('manage.pay', { state: 'done' })]))).toBeNull()
  })
})

describe('helpScreenId', () => {
  it('finds the screen a task opens, ignoring a query', () => {
    expect(helpScreenId({ to: '/home/quiz' })).toBe('H02')
    expect(helpScreenId({ to: '/home/quiz?x=1' })).toBe('H02')
  })
  it('is null for an unknown path', () => expect(helpScreenId({ to: '/nowhere' })).toBeNull())
})

describe('remindDay', () => {
  it('reminds the day before a due date', () => expect(remindDay({ state: 'todo', due: '2026-12-10', opensAt: null }, '2026-12-01')).toBe('2026-12-09'))
  it('reminds on the due day when the day before is today', () => expect(remindDay({ state: 'todo', due: '2026-12-02', opensAt: null }, '2026-12-01')).toBe('2026-12-02'))
  it('gives nothing when due today, undated, done or past', () => {
    expect(remindDay({ state: 'todo', due: '2026-12-01', opensAt: null }, '2026-12-01')).toBeNull()
    expect(remindDay({ state: 'todo', due: null, opensAt: null }, '2026-12-01')).toBeNull()
    expect(remindDay({ state: 'done', due: '2026-12-10', opensAt: null }, '2026-12-01')).toBeNull()
    expect(remindDay({ state: 'todo', due: '2026-11-20', opensAt: null }, '2026-12-01')).toBeNull()
  })
  it('reminds on the day a waiting task opens', () => expect(remindDay({ state: 'waiting', due: null, opensAt: '2026-12-05' }, '2026-12-01')).toBe('2026-12-05'))
  it('gives nothing beyond the reminder limit', () => expect(remindDay({ state: 'todo', due: '2027-06-01', opensAt: null }, '2026-12-01')).toBeNull())
})

describe('taskRemindArgs', () => {
  it('is a clock reminder at 09:00 with words cut to 80', () => {
    const a = taskRemindArgs('2026-12-09', 'x'.repeat(100))
    expect(a).toMatchObject({ when: 'clock', at: '09:00', date: '2026-12-09' })
    expect(a.text).toHaveLength(80)
  })
})

describe('doItFor', () => {
  const open = task('getToShip.checkin', { doIt: 'checkin_prefill' })
  it('offers Do it for me on Home at Helpful and Chatty, never at Asked or Off', () => {
    expect(doItFor(open, 'chatty', 'home')).toBe('checkin_prefill')
    expect(doItFor(open, 'helpful', 'home')).toBe('checkin_prefill')
    expect(doItFor(open, 'asked', 'home')).toBeNull()
    expect(doItFor(open, 'off', 'home')).toBeNull()
  })
  it('also offers it at Asked when the guest asked Stanley what to do, but never at Off', () => {
    expect(doItFor(open, 'asked', 'asked')).toBe('checkin_prefill')
    expect(doItFor(open, 'off', 'asked')).toBeNull()
  })
  it('offers nothing the server did not mark, for a done task, or for an action this app does not know', () => {
    expect(doItFor(task('getToShip.checkin'), 'chatty', 'home')).toBeNull()
    expect(doItFor({ ...open, state: 'done' }, 'chatty', 'home')).toBeNull()
    expect(doItFor({ ...open, doIt: 'pay_bill' as never }, 'chatty', 'home')).toBeNull()
  })
})
