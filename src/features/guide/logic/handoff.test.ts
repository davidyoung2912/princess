import { describe, expect, it } from 'vitest'
import { en } from '../../../shared/i18n/locales/en'
import { EMPTY_PROGRESS, markVisited, normalizeProgress, stepsAt } from '../../../app/routes/stageProgress'
import { guide, task } from './fixture'
import { HANDOFF_STEP, handoffFor, handoffKey } from './handoff'
import { OPTIONAL_FIRST_STEP } from './optionalVisits'

const view = () => guide('manage', [task('manage.pay'), task('manage.documents'), task('manage.readiness'), task('manage.extra', { optional: true }), task('manage.later', { state: 'waiting' })])

describe('hand-off at a stage change', () => {
  it('names the first two required open tasks and counts the rest', () => {
    expect(handoffFor(view(), EMPTY_PROGRESS, null)).toEqual({ stage: 'manage', first: ['manage.pay', 'manage.documents'], more: 1 })
  })

  it('is not shown again once dismissed, and a dismissal is a valid saved step', () => {
    const seen = markVisited(EMPTY_PROGRESS, handoffKey('manage', 's1'), 1)
    expect(normalizeProgress(seen)).toEqual(seen)
    expect(handoffFor(view(), seen, 's1')).toBeNull()
  })

  it('has nothing to say when nothing is open, and ignores tasks carried over or optional', () => {
    expect(handoffFor(guide('sea', [task('sea.today', { state: 'done' })]), EMPTY_PROGRESS, null)).toBeNull()
    expect(handoffFor(guide('sea', [task('sea.today', { carriedFrom: 'embark' }), task('sea.dinner', { optional: true })]), EMPTY_PROGRESS, null)).toBeNull()
  })

  it('uses a step no visit can set', () => {
    expect(HANDOFF_STEP).toBeGreaterThan(OPTIONAL_FIRST_STEP + 2)
    for (const path of ['/', '/plan', '/me/documents', '/book/pay']) expect(stepsAt('manage', path)).not.toContain(HANDOFF_STEP)
  })

  it('has the words', () => {
    for (const k of ['guide.handoff.title', 'guide.handoff.first', 'guide.handoff.more', 'guide.handoff.dismiss']) expect(k in en).toBe(true)
  })
})
