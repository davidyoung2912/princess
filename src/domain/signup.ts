import type { Registration } from '../auth/provider'
import { limit } from './limits'

/** Sign-up rules (ACT-01), mirrored by the server: an adult account holder, an address that looks like one, a password of 10 or more characters. */
export const MIN_PASSWORD = 10
export let MIN_ACCOUNT_AGE = 18

export type SignupProblem = 'email' | 'password' | 'firstName' | 'lastName' | 'dob' | 'tooYoung' | 'confirm'

export const isEmail = (s: string): boolean => /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(s.trim()) && s.trim().length <= 254

const isRealDate = (dob: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] >= 1900
}

/** Whether someone born on `dob` ("YYYY-MM-DD") is at least 18 on `today` ("YYYY-MM-DD"). False for a date that is not real. */
export function isAdult(dob: string, today: string): boolean {
  return isRealDate(dob) && dob <= `${+today.slice(0, 4) - MIN_ACCOUNT_AGE}${today.slice(4)}`
}

/** Every problem with a sign-up form, in field order. Empty means it can be sent. `confirm`, when given, is the password typed a second time and must match. */
export function signupProblems(r: Registration, today: string, confirm?: string): SignupProblem[] {
  const out: SignupProblem[] = []
  if (!isEmail(r.email)) out.push('email')
  if (r.password.length < MIN_PASSWORD || r.password.length > 200) out.push('password')
  else if (confirm !== undefined && confirm !== r.password) out.push('confirm')
  if (!r.firstName.trim() || r.firstName.trim().length > 60) out.push('firstName')
  if (!r.lastName.trim() || r.lastName.trim().length > 60) out.push('lastName')
  if (!isRealDate(r.dob)) out.push('dob')
  else if (!isAdult(r.dob, today)) out.push('tooYoung')
  return out
}

/** A one-time code is six digits; spaces are ignored so a code pasted as "123 456" works. */
export const cleanCode = (s: string): string => s.replace(/\s+/g, '')
export const isCode = (s: string): boolean => /^\d{6}$/.test(cleanCode(s))

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('MIN_ACCOUNT_AGE', (v) => { MIN_ACCOUNT_AGE = v }, MIN_ACCOUNT_AGE)
