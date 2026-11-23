import { describe, expect, it } from 'vitest'
import { applyRemoteProgress, getProgress, recordVisit, resetProgress } from './store'
import { EMPTY_PROGRESS } from '../routes/stageProgress'

describe('stage progress store', () => {
  it('records a visit, resets, and keeps people apart', () => {
    recordVisit('p1', 'dream#1', 1)
    expect(getProgress('p1').visited).toEqual({ 'dream#1': 1 })
    expect(getProgress('p2')).toBe(EMPTY_PROGRESS)
    resetProgress('p1')
    expect(getProgress('p1')).toBe(EMPTY_PROGRESS)
  })

  it('takes the server copy as it is', () => {
    applyRemoteProgress('a', { visited: { 'dream#2': 5 } })
    expect(getProgress('a').visited).toEqual({ 'dream#2': 5 })
    applyRemoteProgress('a', null)
    expect(getProgress('a')).toBe(EMPTY_PROGRESS)
  })
})
