import { describe, expect, it } from 'vitest'
import type { TaskDef } from '../routes/nav'
import { MAX_VISITS, noteVisit, readVisits, taskFunnel, type TaskVisit } from './taskFunnel'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const v = (screen: string | null, at: number): TaskVisit => ({ screen, at })
const task = (id: string, taps: string[]): TaskDef => ({ id, labelKey: 'task.boardingPass', taps })

describe('task funnel', () => {
  const two = task('res', ['/plan', '/plan/reservations'])
  it('counts an attempt reached when the last screen follows the first', () => {
    const s = taskFunnel([v('plan', 0), v('plan/reservations', 4000), v(null, 5000), v('plan', 9000), v(null, 9500)], [two])[0]!
    expect(s).toEqual({ id: 'res', opened: 2, reached: 1, medianSeconds: 4 })
  })
  it('does not count a task reached after going Home or beyond the tap limit', () => {
    const s = taskFunnel([v('plan', 0), v('ship', 1), v('ship/map', 2), v('plan/reservations', 3)], [two])[0]!
    expect(s.reached).toBe(0)
    expect(s.opened).toBe(1)
  })
  it('treats a one-screen task as reached when it opens, and leaves out Help-only tasks', () => {
    const stats = taskFunnel([v('plan', 0)], [task('today', ['/plan']), task('help', ['help'])])
    expect(stats).toEqual([{ id: 'today', opened: 1, reached: 1, medianSeconds: 0 }])
  })
  it('has no median with nothing reached', () => { expect(taskFunnel([], [two])[0]).toEqual({ id: 'res', opened: 0, reached: 0, medianSeconds: null }) })
})

describe('noting visits', () => {
  it('stores a safe screen name, none for Home, and caps the list', () => {
    const s = memory()
    noteVisit(s, '/', 1)
    noteVisit(s, '/plan/reservations/abc123', 2)
    expect(readVisits(s)).toEqual([{ screen: null, at: 1 }, { screen: 'plan/reservations', at: 2 }])
    for (let i = 0; i < MAX_VISITS + 5; i++) noteVisit(s, '/ship', i)
    expect(readVisits(s)).toHaveLength(MAX_VISITS)
  })
  it('reads damaged storage as empty', () => {
    const s = memory()
    s.setItem('princess:task-visits', '{"nope":1}')
    expect(readVisits(s)).toEqual([])
  })
})
