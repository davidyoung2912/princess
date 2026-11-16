import { describe, expect, it } from 'vitest'
import { canSendDietary, DIETARY_BADGE, isDietaryConfirmed, needsAttention, requestsNeedingAttention, type DietaryRequest, type DietaryStatus } from './dietaryRequest'

const req = (status: DietaryStatus): DietaryRequest => ({ guest: 'g', kind: 'allergy', note: 'Peanuts', status, sentAt: 0 })

describe('dietary requests', () => {
  it('counts only a confirmed request as approved', () => {
    const all: DietaryStatus[] = ['received', 'review', 'confirmed', 'contact', 'unable']
    expect(all.filter((s) => isDietaryConfirmed(req(s)))).toEqual(['confirmed'])
  })

  it('flags a request that needs staff or cannot be met', () => {
    expect(requestsNeedingAttention([req('received'), req('contact'), req('unable'), req('confirmed')]).map((r) => r.status)).toEqual(['contact', 'unable'])
    expect(needsAttention(req('review'))).toBe(false)
  })

  it('needs a kind, words and the acknowledgement before it can be sent', () => {
    expect(canSendDietary({ kind: 'allergy', note: 'Peanuts', acknowledged: true })).toBe(true)
    expect(canSendDietary({ kind: 'allergy', note: 'Peanuts', acknowledged: false })).toBe(false)
    expect(canSendDietary({ kind: 'allergy', note: '   ', acknowledged: true })).toBe(false)
    expect(canSendDietary({ kind: 'other-thing', note: 'x', acknowledged: true })).toBe(false)
  })

  it('has a badge for every status, none of them a plain tick but confirmed', () => {
    expect(DIETARY_BADGE.received).not.toBe('confirmed')
    expect(DIETARY_BADGE.review).not.toBe('confirmed')
    expect(DIETARY_BADGE.confirmed).toBe('confirmed')
  })
})
