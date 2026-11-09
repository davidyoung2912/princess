import { describe, expect, it } from 'vitest'
import { canMove, isOpen, LIFECYCLE, lifecycleOf, needsAction } from './lifecycle'
import { en } from '../i18n/locales/en'

describe('one lifecycle vocabulary (TRU-03)', () => {
  it('has the nine states, each with a guest-facing word', () => {
    expect(LIFECYCLE).toHaveLength(9)
    for (const s of LIFECYCLE) expect((en as Record<string, string>)[`lifecycle.${s}`]).toBeTruthy()
  })
  it('says which states can still change and which need the guest', () => {
    expect(LIFECYCLE.filter(isOpen)).toEqual(['draft', 'submitted', 'pending'])
    expect(LIFECYCLE.filter(needsAction)).toEqual(['declined', 'expired', 'failed'])
  })
  it('does not let a final state move backwards', () => {
    expect(canMove('confirmed', 'draft')).toBe(false)
    expect(canMove('declined', 'confirmed')).toBe(false)
    expect(canMove('submitted', 'confirmed')).toBe(true)
    expect(canMove('cancelled', 'refunded')).toBe(true)
    expect(canMove('failed', 'submitted')).toBe(true)
  })
  it('maps older words and never guesses at unknown ones', () => {
    expect(lifecycleOf('approved')).toBe('confirmed')
    expect(lifecycleOf('canceled')).toBe('cancelled')
    expect(lifecycleOf('pending')).toBe('pending')
    expect(lifecycleOf('mystery')).toBeNull()
    expect(lifecycleOf(3)).toBeNull()
  })
})

import { receiptState } from './checkin'
// proves: GTS-01
describe('check-in receipt states (GTS-01)', () => {
  it('uses the served state, else works it out', () => {
    expect(receiptState({ savedAt: 5, state: 'confirmed' })).toBe('confirmed')
    expect(receiptState({ savedAt: null })).toBe('draft')
    expect(receiptState({ savedAt: 5 })).toBe('submitted')
    expect(receiptState({ savedAt: 5 }, true)).toBe('confirmed')
  })
})
