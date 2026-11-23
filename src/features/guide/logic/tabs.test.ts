import { describe, expect, it } from 'vitest'
import { guide, task } from './fixture'
import { startHerePath, tabsHoldingUrgent } from './tabs'

const tabs = [{ key: 'home', paths: ['/'] }, { key: 'plan', paths: ['/plan/a', '/me/payments'] }, { key: 'me', paths: ['/me/payments'] }, { key: 'ship', paths: ['/plan/a'] }]

describe('tab hints', () => {
  it('marks only the first tab holding an urgent open task', () => {
    const v = guide('manage', [task('manage.pay', { to: '/me/payments', urgency: 'now' }), task('manage.b', { to: '/plan/a', urgency: 'none' })])
    expect([...tabsHoldingUrgent(v, tabs)]).toEqual(['plan'])
  })
  it('ignores done, waiting and calm tasks', () => {
    const v = guide('manage', [task('manage.pay', { to: '/me/payments', urgency: 'soon', state: 'done' }), task('manage.b', { to: '/plan/a', urgency: 'later' })])
    expect(tabsHoldingUrgent(v, tabs).size).toBe(0)
  })
  it('says where to start, except Home', () => {
    expect(startHerePath(guide('manage', [task('manage.pay', { to: '/me/payments?x=1' })]))).toBe('/me/payments')
    expect(startHerePath(guide('manage', [task('manage.pay', { to: '/' })]))).toBeNull()
    expect(startHerePath(guide('manage', [task('manage.pay', { state: 'done' })]))).toBeNull()
  })
})
