import { describe, expect, it } from 'vitest'
import { clearCelebration, peekCelebration, queueCelebration } from './pending'

describe('pending celebration', () => {
  it('is held until cleared', () => {
    expect(peekCelebration()).toBeNull()
    queueCelebration('checkedIn')
    expect(peekCelebration()).toBe('checkedIn')
    clearCelebration()
    expect(peekCelebration()).toBeNull()
  })
})
