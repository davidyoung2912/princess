import { describe, expect, it } from 'vitest'
import { flowAt } from './flow'
import { guide, task } from './fixture'

const view = guide('manage', [
  task('manage.pay', { to: '/me/payments' }),
  task('manage.documents', { to: '/me/documents' }),
  task('manage.readiness', { to: '/plan/readiness', state: 'done' }),
  task('manage.late', { to: '/plan/late', carriedFrom: 'book' }),
])

describe('flowAt', () => {
  it('finds the task a path belongs to, with its place and what is next', () => {
    const f = flowAt(view, '/me/payments')!
    expect(f.task.id).toBe('manage.pay')
    expect([f.n, f.total, f.left]).toEqual([1, 3, 2])
    expect(f.next?.id).toBe('manage.documents')
  })
  it('has no next task when the rest is done, and counts only what is open', () => {
    const f = flowAt(guide('manage', [task('manage.pay', { to: '/me/payments', state: 'done' })]), '/me/payments')!
    expect(f.next).toBeNull()
    expect(f.left).toBe(0)
  })
  it('does not match a screen that is no task, ignores a query, and prefers the task opened from', () => {
    expect(flowAt(view, '/me/profile')).toBeNull()
    expect(flowAt(view, '/me/documents?x=1')?.task.id).toBe('manage.documents')
    expect(flowAt(view, '/plan/late', 'manage.late')?.task.id).toBe('manage.late')
  })
})
