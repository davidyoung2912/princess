import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, digitsOnly } from './CodeBoxes'

describe('six-digit code entry', () => {
  it('keeps only digits, and at most six', () => {
    expect(digitsOnly('12a 3-4')).toBe('1234')
    expect(digitsOnly('123 456 789')).toBe('123456')
    expect(digitsOnly('abc')).toBe('')
    expect(CODE_LENGTH).toBe(6)
  })
})
