import { describe, expect, it } from 'vitest'
import { checkinConflict } from './checkinConflict'

describe('check-in contradictions', () => {
  it('is quiet while check-in is not finished', () => {
    expect(checkinConflict({ state: 'open', stepsLeft: 3, finishedAt: null })).toBeNull()
  })
  it('is quiet when finished and complete', () => {
    expect(checkinConflict({ state: 'done', stepsLeft: 0, finishedAt: 1 })).toBeNull()
  })
  it('flags finished with steps still open', () => {
    expect(checkinConflict({ state: 'done', stepsLeft: 2, finishedAt: 1 })).toBe('finishedButOpen')
  })
  it('flags finished with no time recorded', () => {
    expect(checkinConflict({ state: 'done', stepsLeft: 0, finishedAt: null })).toBe('finishedNoTime')
  })
})
