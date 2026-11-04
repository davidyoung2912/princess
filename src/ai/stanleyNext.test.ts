import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { JOURNEY_STAGES } from '../routes/hubs'
import type { HomeFacts } from '../routes/stageHome'
import { stanleyNext } from './stanleyNext'
import { TERMS, explanationOf, termOf } from './stanleyTerms'

const none: HomeFacts = { savedSailings: 0, draft: null }
const trip = (over: object): HomeFacts => ({ ...none, trip: { number: 'B1', paid: false, documentsOk: true, checkinDone: false, agent: false, ...over } })

describe('Stanley Next', () => {
  it('leads with the first undone step of any stage, and every answer has words', () => {
    for (const stage of JOURNEY_STAGES) {
      const a = stanleyNext(stage, none, 10)
      expect(`${a.key}` in en, `${stage} ${a.key}`).toBe(true)
      if (a.stepKey) expect(a.stepKey in en, a.stepKey).toBe(true)
    }
    expect(stanleyNext('dream', none, 10)).toEqual({ key: 'stanley.next.step', stepKey: 'stage.next.dream.1', to: '/home/quiz' })
  })

  it('puts an urgent reason before the plain step', () => {
    expect(stanleyNext('manage', trip({ daysToFinal: 5 }), 10).key).toBe('stanley.next.payment')
    expect(stanleyNext('getToShip', trip({ paid: true, checkinOpen: true, daysToDeparture: 2 }), 10).key).toBe('stanley.next.checkin')
    expect(stanleyNext('manage', trip({ paid: true, documentsOk: false, daysToDeparture: 20 }), 10).key).toBe('stanley.next.documents')
    expect(stanleyNext('embark', { ...none, aboard: { musterDone: false, lastFullDay: false } }, 10).key).toBe('stanley.next.muster')
    expect(stanleyNext('sea', { ...none, aboard: { musterDone: true, lastFullDay: true } }, 10).key).toBe('stanley.next.bags')
  })

  it('looks ahead to tomorrow in the evening at sea and in port, and says so when all is done', () => {
    expect(stanleyNext('sea', { ...none, aboard: { musterDone: true, lastFullDay: false } }, 20)).toEqual({ key: 'stanley.next.evening', to: '/plan/day' })
    expect(stanleyNext('sea', { ...none, aboard: { musterDone: true, lastFullDay: false } }, 9).key).toBe('stanley.next.step')
    expect(stanleyNext('embark', { ...none, aboard: { musterDone: true, lastFullDay: false } }, 20).key).toBe('stanley.next.step')
    expect(stanleyNext('manage', trip({ paid: true }), 10).stepKey).toBe('stage.next.manage.3')
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
