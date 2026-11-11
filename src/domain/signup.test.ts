import { describe, expect, it } from 'vitest'
import { cleanCode, isAdult, isCode, isEmail, signupProblems } from './signup'

const good = { email: 'a@example.com', password: 'a-long-password', firstName: 'Ana', lastName: 'Lee', dob: '1990-05-01' }

describe('signupProblems', () => {
  it('needs the confirmed password to match', () => {
    expect(signupProblems(good, '2026-11-01', good.password)).toEqual([])
    expect(signupProblems(good, '2026-11-01', 'something-else')).toEqual(['confirm'])
    expect(signupProblems(good, '2026-11-01', '')).toEqual(['confirm'])
  })
  it('accepts a complete adult sign-up', () => expect(signupProblems(good, '2026-11-01')).toEqual([]))
  it('lists every problem in field order', () => {
    expect(signupProblems({ email: 'nope', password: 'short', firstName: ' ', lastName: '', dob: 'x' }, '2026-11-01')).toEqual(['email', 'password', 'firstName', 'lastName', 'dob'])
  })
  it('refuses under 18 but allows the 18th birthday', () => {
    expect(signupProblems({ ...good, dob: '2008-11-02' }, '2026-11-01')).toEqual(['tooYoung'])
    expect(signupProblems({ ...good, dob: '2008-11-01' }, '2026-11-01')).toEqual([])
  })
  it('refuses dates that do not exist', () => {
    expect(signupProblems({ ...good, dob: '1990-02-30' }, '2026-11-01')).toEqual(['dob'])
    expect(signupProblems({ ...good, dob: '1800-01-01' }, '2026-11-01')).toEqual(['dob'])
  })
})

describe('helpers', () => {
  it('checks addresses and ages', () => {
    expect(isEmail(' a@b.co ')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
    expect(isEmail('a b@c.de')).toBe(false)
    expect(isAdult('2000-02-29', '2026-11-01')).toBe(true)
    expect(isAdult('bad', '2026-11-01')).toBe(false)
  })
  it('accepts a code pasted with spaces', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456')
    expect(isCode('123 456')).toBe(true)
    expect(isCode('12345')).toBe(false)
    expect(isCode('12345a')).toBe(false)
  })
})
