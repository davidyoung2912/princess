import { describe, expect, it } from 'vitest'
import { guide, task } from '../../guide/logic/fixture'
import { en } from '../../../shared/i18n/locales/en'
import { stanleyNext } from './stanleyNext'
import { TERMS, explanationOf, termOf } from './stanleyTerms'

const urgent = (id: string, reason: 'payment' | 'checkin' | 'documents' | 'muster' | 'bags', to = '/urgent') => task(id, { urgency: 'now', urgencyReason: reason, to })

describe('Stanley Next', () => {
  it('leads with the first task of the guide, and every answer has words', () => {
    const view = guide('dream', [task('dream.quiz', { to: '/home/quiz' }), task('dream.save')])
    const a = stanleyNext(view, 10)
    expect(a).toEqual({ key: 'stanley.next.step', stepKey: 'guide.dream.quiz.title', to: '/home/quiz' })
    expect(a.key in en).toBe(true)
    expect(a.stepKey! in en).toBe(true)
  })

  it('puts an urgent reason before the plain task, and sends the button to the urgent task', () => {
    const cases = [['payment', 'manage'], ['checkin', 'getToShip'], ['documents', 'manage'], ['muster', 'embark'], ['bags', 'sea']] as const
    for (const [reason, stage] of cases) {
      const a = stanleyNext(guide(stage, [task(`${stage}.first`), urgent(`${stage}.hot`, reason)]), 10)
      expect(a, reason).toEqual({ key: `stanley.next.${reason}`, to: '/urgent' })
      expect(a.key in en, reason).toBe(true)
    }
  })

  it('looks ahead to tomorrow in the evening at sea and in port, and says so when nothing is open', () => {
    const view = (stage: 'sea' | 'embark') => guide(stage, [task(`${stage}.today`)])
    expect(stanleyNext(view('sea'), 20)).toEqual({ key: 'stanley.next.evening', to: '/plan/day' })
    expect(stanleyNext(view('sea'), 9).key).toBe('stanley.next.step')
    expect(stanleyNext(view('embark'), 20).key).toBe('stanley.next.step')
    expect(stanleyNext(guide('sea', [task('sea.today', { state: 'done' })]), 20)).toEqual({ key: 'stanley.next.allDone', to: null })
  })

  it('does not call a waiting task the next step', () => {
    expect(stanleyNext(guide('prebook', [task('getToShip.checkin', { state: 'waiting' })]), 10).key).toBe('stanley.next.allDone')
  })
})

describe('Stanley explainers', () => {
  it('has 20 terms, each with a name and a short plain explanation', () => {
    expect(TERMS).toHaveLength(20)
    expect(new Set(TERMS).size).toBe(20)
    for (const id of TERMS) {
      const text = explanationOf(id)
      expect(termOf(id).length, id).toBeGreaterThan(2)
      expect(text.length, id).toBeLessThanOrEqual(200)
      expect(text, id).not.toMatch(/!/)
      expect(text.endsWith('.'), id).toBe(true)
    }
  })
})
