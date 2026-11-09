import { describe, expect, it } from 'vitest'
import { answerOf, filterJourney, journeySummary, type JourneyItem } from './journeyAccess'

const item = (id: string, area: JourneyItem['area'], answers: JourneyItem['answers']): JourneyItem => ({ id, area, name: id, answers })

describe('journey access', () => {
  const items = [
    item('a', 'cabin', { stepFree: 'yes' }),
    item('b', 'cabin', { stepFree: 'no' }),
    item('c', 'port', {}),
    item('d', 'excursion', { stepFree: 'yes', wheelchair: 'no' }),
  ]
  it('reads a missing answer as unknown', () => expect(answerOf(items[2], 'stepFree')).toBe('unknown'))
  it('keeps everything when nothing is chosen', () => expect(filterJourney(items, [])).toHaveLength(4))
  it('drops a no but keeps an unknown', () => expect(filterJourney(items, ['stepFree']).map((i) => i.id)).toEqual(['a', 'c', 'd']))
  it('combines features', () => expect(filterJourney(items, ['stepFree', 'wheelchair']).map((i) => i.id)).toEqual(['a', 'c']))
  it('summarises each area, counting unknown apart', () => {
    const s = journeySummary(items, ['stepFree'])
    expect(s.find((x) => x.area === 'cabin')).toMatchObject({ total: 2, yes: 1, no: 1, unknown: 0 })
    expect(s.find((x) => x.area === 'port')).toMatchObject({ total: 1, yes: 0, no: 0, unknown: 1 })
    expect(s.find((x) => x.area === 'ship')).toMatchObject({ total: 0 })
  })
})
