import { describe, expect, it } from 'vitest'
import { dismissOffer, EMPTY_OFFER_STATE } from '../domain/offers'
import { loadOfferState, offerKeyFor, saveOfferState } from './store'

const fake = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('offer storage', () => {
  it('keeps each person’s choices apart', () => {
    const s = fake()
    saveOfferState('gerald', dismissOffer(EMPTY_OFFER_STATE, 'B1', 'package'), s)
    expect(loadOfferState('gerald', s).dismissed.B1).toEqual(['package'])
    expect(loadOfferState('maria', s)).toEqual(EMPTY_OFFER_STATE)
    expect(offerKeyFor('gerald').startsWith('princess:')).toBe(true)
  })

  it('survives broken or missing storage', () => {
    expect(loadOfferState('gerald', { getItem: () => '{oops' })).toEqual(EMPTY_OFFER_STATE)
    expect(loadOfferState('gerald', null)).toEqual(EMPTY_OFFER_STATE)
    expect(saveOfferState('gerald', EMPTY_OFFER_STATE, { setItem: () => { throw new Error('full') } })).toBe(false)
  })
})
