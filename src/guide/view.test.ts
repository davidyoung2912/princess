import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { guide, task } from './fixture'
import { OPTIONAL_STEP } from './optionalVisits'
import { HOME_TASKS, VISIT_STEP, applyVisits, doneTasks, moreCount, openTasks, primaryOf, stepDoneInGuide, urgentReason, urgentTask } from './view'
import { taskMeta } from './words'
import { welcomeContent } from '../routes/stageWelcome'

const sea = () => guide('sea', [task('sea.bags', { doneBy: 'visit', urgency: 'now', urgencyReason: 'bags', hard: true }), task('sea.today', { doneBy: 'visit' }), task('sea.dinner', { doneBy: 'visit' })])

describe('the guide on the phone', () => {
  it('names the first task to do, and none when nothing is open', () => {
    expect(primaryOf(sea())!.id).toBe('sea.bags')
    expect(primaryOf(guide('sea', [task('sea.today', { state: 'done' })]))).toBeNull()
  })

  it('lists at most five open tasks, tells how many are left out, and keeps done ones apart', () => {
    const many = guide('prebook', [...'abcdefg'].map((c) => task(`prebook.${c}`)).concat(task('prebook.z', { state: 'done' })))
    expect(openTasks(many)).toHaveLength(HOME_TASKS)
    expect(moreCount(many)).toBe(2)
    expect(doneTasks(many).map((x) => x.id)).toEqual(['prebook.z'])
    expect(moreCount(sea())).toBe(0)
  })

  it('reads the urgent reason from the first open urgent task only', () => {
    expect(urgentReason(sea())).toBe('bags')
    expect(urgentTask(sea())!.to).toBe('/x')
    expect(urgentReason(guide('sea', [task('sea.bags', { state: 'done', urgency: 'now', urgencyReason: 'bags' })]))).toBeNull()
    expect(urgentReason(guide('dream', [task('dream.quiz')]))).toBeNull()
    expect(urgentReason(null)).toBeNull()
  })

  it('counts a visit as done for a task only a visit can finish, moves it to the end and updates the primary and counts', () => {
    const out = applyVisits(sea(), (step) => step === 3)
    expect(out.tasks.map((x) => [x.id, x.state])).toEqual([['sea.today', 'todo'], ['sea.dinner', 'todo'], ['sea.bags', 'done']])
    expect(out.primaryId).toBe('sea.today')
    expect(out.counts).toEqual({ done: 1, total: 3, open: 2 })
    expect(urgentReason(out)).toBeNull()
  })

  it('leaves the guide alone when no visit matters, and never lets a visit finish a task the app can see', () => {
    const view = sea()
    expect(applyVisits(view, () => false)).toBe(view)
    const paid = guide('manage', [task('manage.pay', { doneBy: 'data' })])
    expect(applyVisits(paid, () => true)).toBe(paid)
  })

  it('opens a task whose blocker a visit finished, and ignores a carried-over task', () => {
    const view = guide('getToShip', [task('getToShip.travel', { doneBy: 'visit' }), task('getToShip.pass', { doneBy: 'visit', state: 'blocked', blockedBy: 'getToShip.travel' })])
    expect(applyVisits(view, (s) => s === 2).tasks.map((x) => [x.id, x.state])).toEqual([['getToShip.pass', 'todo'], ['getToShip.travel', 'done']])
    const carried = guide('prebook', [task('manage.readiness', { doneBy: 'visit', carriedFrom: 'manage' })])
    expect(applyVisits(carried, () => true)).toBe(carried)
  })

  it('maps every visit task to a step the welcome page has', () => {
    for (const [id, step] of Object.entries(VISIT_STEP)) {
      const stage = id.split('.')[0] as Parameters<typeof welcomeContent>[0]
      expect(step, id).toBeGreaterThanOrEqual(1)
      if (OPTIONAL_STEP[id] === undefined) expect(step, id).toBeLessThanOrEqual(welcomeContent(stage).steps.length)
    }
  })

  it('shows a welcome step done when the guide has the matching task done', () => {
    const view = guide('manage', [task('manage.pay', { state: 'done' }), task('manage.documents')])
    expect(stepDoneInGuide(view, 1)).toBe(true)
    expect(stepDoneInGuide(view, 2)).toBe(false)
  })
})

describe('what a task says about itself', () => {
  it('names the travellers still to do, only while some are', () => {
    const who = (done: number, missing?: string[]) => taskMeta(task('manage.documents', { who: { done, total: 4, missing } })).slice(0, 2)
    expect(who(2, ['Ana', 'Leo'])).toEqual(['2 of 4 travellers ready', 'Still to do: Ana, Leo'])
    expect(who(4, ['Ana'])).toEqual(['4 of 4 travellers ready', '5 min'])
    expect(who(2)).toEqual(['2 of 4 travellers ready', '5 min'])
  })

  it('gives the due date and minutes, then opens, blocked and carried-over notes', () => {
    expect(taskMeta(task('manage.pay', { due: '2026-12-04' }))).toEqual(['Due Fri, Dec 4, 2026', '5 min'])
    expect(taskMeta(task('getToShip.checkin', { state: 'waiting', opensAt: '2026-12-19', due: '2026-12-22', minutes: 10 }))).toEqual(['Opens Sat, Dec 19, 2026', '10 min'])
    expect(taskMeta(task('getToShip.pass', { state: 'blocked', blockedBy: 'getToShip.checkin', minutes: 2 }))).toEqual(['After: check in online', '2 min'])
    expect(taskMeta(task('manage.pay', { carriedFrom: 'manage', stage: 'manage', optional: true }))).toEqual(['Still to do from Manage', 'Optional', '5 min'])
  })

  it('has words for every new line', () => {
    for (const k of ['guide.title', 'guide.now', 'guide.soon', 'guide.start', 'guide.allDone', 'guide.lookAhead', 'guide.more', 'guide.moreLink', 'guide.doneCount']) expect(k in en, k).toBe(true)
  })
})
