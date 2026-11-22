import type { Registration } from '../auth/provider'
import { limit } from './limits'
import { isWholePhone } from './phone'

/** Sign-up rules (ACT-01), mirrored by the server: an adult account holder, an address that looks like one, a password of 10 or more characters. */
export const MIN_PASSWORD = 10
export let MIN_ACCOUNT_AGE = 18

export type SignupProblem = 'username' | 'email' | 'password' | 'legalName' | 'dob' | 'phone' | 'tooYoung' | 'confirm'

/** A sign-in name: 6 to 30 letters, digits and . _ - (the server also refuses blocked words). */
export const MIN_USERNAME = 6
export const MAX_USERNAME = 30
export const isUsername = (s: string): boolean => s.trim().length >= MIN_USERNAME && s.trim().length <= MAX_USERNAME && /^[A-Za-z0-9._-]+$/.test(s.trim())

export const isEmail = (s: string): boolean => /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(s.trim()) && s.trim().length <= 254

/** A whole international phone number (`+<code><digits>`, as the phone field gives it): the right length for its country, 7 to 15 digits in all. */
export const isPhone = (s: string): boolean => isWholePhone(s)

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
  if (!isUsername(r.username)) out.push('username')
  if (r.email.trim() && !isEmail(r.email)) out.push('email')
  if (r.password.length < MIN_PASSWORD || r.password.length > 200) out.push('password')
  else if (confirm !== undefined && confirm !== r.password) out.push('confirm')
  if (!r.legalName.trim() || r.legalName.trim().length > 120) out.push('legalName')
  if (!isRealDate(r.dob)) out.push('dob')
  else if (!isAdult(r.dob, today)) out.push('tooYoung')
  if (r.phone.trim() && !isPhone(r.phone)) out.push('phone')
  return out
}

/** A one-time code is six digits; spaces are ignored so a code pasted as "123 456" works. */
export const cleanCode = (s: string): string => s.replace(/\s+/g, '')
export const isCode = (s: string): boolean => /^\d{6}$/.test(cleanCode(s))

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('MIN_ACCOUNT_AGE', (v) => { MIN_ACCOUNT_AGE = v }, MIN_ACCOUNT_AGE)
