import { describe, expect, it } from 'vitest'
import { ashoreNames, needsPhone, smsReason } from './chatSms'

describe('smsReason', () => {
  it('finds a known reason in the first place it appears', () => {
    expect(smsReason(undefined, 'unverified')).toBe('unverified')
    expect(smsReason('invalid', 'noPhone')).toBe('noPhone')
    expect(smsReason('forbidden', 'supervised')).toBe('supervised')
  })
  it('is null for anything else', () => {
    expect(smsReason('invalid', 'settings')).toBeNull()
    expect(smsReason()).toBeNull()
  })
})

describe('needsPhone', () => {
  it('is true only for a missing or unconfirmed number', () => {
    expect(needsPhone('noPhone')).toBe(true)
    expect(needsPhone('unverified')).toBe(true)
    expect(needsPhone('off')).toBe(false)
    expect(needsPhone(null)).toBe(false)
  })
})

describe('ashoreNames', () => {
  it('lists up to three names', () => {
    expect(ashoreNames(['Sam R.', 'Ana L.'])).toBe('Sam R., Ana L.')
    expect(ashoreNames(undefined)).toBe('')
  })
  it('counts the rest', () => {
    expect(ashoreNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2')
  })
})
