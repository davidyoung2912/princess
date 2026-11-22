import { describe, expect, it } from 'vitest'
import { cleanCode, isAdult, isCode, isEmail, isPhone, isUsername, signupProblems } from './signup'

const good = { username: 'ana.lee', email: 'a@example.com', password: 'a-long-password', legalName: 'Ana Lee', dob: '1990-05-01', phone: '+15551234567' }

describe('phone number', () => {
  it('accepts a whole international number and nothing else', () => {
    for (const ok of ['+15551234567', '+447700900123', '+61412345678']) expect(isPhone(ok), ok).toBe(true)
    for (const bad of ['', '+1555123', '+155512345678', '5551234567', '+', '+44 77']) expect(isPhone(bad), bad).toBe(false)
  })
  it('is optional, but must be whole when given', () => {
    expect(signupProblems({ ...good, phone: '' }, '2026-11-01')).toEqual([])
    expect(signupProblems({ ...good, phone: '+12' }, '2026-11-01')).toEqual(['phone'])
  })
})

describe('username and email', () => {
  it('needs a username of 6 to 30 letters, digits, dots, dashes or underscores', () => {
    for (const ok of ['ana.lee', 'Ana_Lee-01', 'x'.repeat(30)]) expect(isUsername(ok), ok).toBe(true)
    for (const bad of ['', 'short', 'has space', 'bad!chars', 'x'.repeat(31)]) expect(isUsername(bad), bad).toBe(false)
    expect(signupProblems({ ...good, username: 'abc' }, '2026-11-01')).toEqual(['username'])
  })
  it('lets the email be left empty, but not wrong', () => {
    expect(signupProblems({ ...good, email: '' }, '2026-11-01')).toEqual([])
    expect(signupProblems({ ...good, email: 'nope' }, '2026-11-01')).toEqual(['email'])
  })
})

describe('signupProblems', () => {
  it('needs the confirmed password to match', () => {
    expect(signupProblems(good, '2026-11-01', good.password)).toEqual([])
    expect(signupProblems(good, '2026-11-01', 'something-else')).toEqual(['confirm'])
    expect(signupProblems(good, '2026-11-01', '')).toEqual(['confirm'])
  })
  it('accepts a complete adult sign-up', () => expect(signupProblems(good, '2026-11-01')).toEqual([]))
  it('lists every problem in field order', () => {
    expect(signupProblems({ username: 'x', email: 'nope', password: 'short', legalName: '', dob: 'x', phone: '+12' }, '2026-11-01')).toEqual(['username', 'email', 'password', 'legalName', 'dob', 'phone'])
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
