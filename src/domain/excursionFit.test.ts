import { describe, expect, it } from 'vitest'
import { fitTours, NO_FIT, type FitOffer } from './excursionFit'
import type { ExcursionItem } from './excursions'

const item = (id: string, over: Partial<ExcursionItem>): ExcursionItem => ({ id, port: 'cozumel' as ExcursionItem['port'], name: id, summary: '', hours: 3, price: 6_000, activity: 'easy', wheelchair: true, family: true, interests: [], rating: 4.5, reviews: 10, meeting: '', start: '09:00', capacity: 20, ...over })
const offer = (id: string, over: Partial<ExcursionItem> = {}, extra: Partial<FitOffer> = {}): FitOffer => ({ item: item(id, over), spots: 5, backBy: '14:30', timing: null, ...extra })

describe('fitTours', () => {
  it('rules out the too hard, too dear, sold out and badly timed', () => {
    const list = [offer('ok'), offer('hard', { activity: 'strenuous' }), offer('dear', { price: 20_000 }), offer('gone', {}, { spots: 0 }), offer('late', {}, { timing: 'tooLate' })]
    expect(fitTours(list, { ...NO_FIT, maxPrice: 100 }).map((m) => m.offer.item.id)).toEqual(['ok'])
  })
  it('keeps to step-free tours for a wheelchair user and family tours for children', () => {
    const list = [offer('a', { wheelchair: false }), offer('b', { family: false }), offer('c')]
    expect(fitTours(list, { ...NO_FIT, who: 'wheelchair' }).map((m) => m.offer.item.id)).toEqual(['b', 'c'])
    expect(fitTours(list, { ...NO_FIT, who: 'children' }).map((m) => m.offer.item.id)).toEqual(['a', 'c'])
  })
  it('ranks by rating and gives plain reasons', () => {
    const [first, second] = fitTours([offer('low', { rating: 4.0 }), offer('high', { rating: 4.8 })], NO_FIT)
    expect(first.offer.item.id).toBe('high')
    expect(second.offer.item.id).toBe('low')
    expect(first.reasons.slice(0, 2)).toEqual(['Easy', '3 hours'])
    expect(first.reasons).toContain('step-free')
  })
})
