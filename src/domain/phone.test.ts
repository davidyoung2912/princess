import { describe, expect, it } from 'vitest'
import { cleanNational, defaultPhoneCountry, formatNational, isNationalComplete, isWholePhone, phoneCountry, PHONE_COUNTRIES, splitInternational, toE164 } from './phone'

const us = phoneCountry('us')
const gb = phoneCountry('gb')

describe('phone entry', () => {
  it('keeps only digits and stops at the longest number for the country', () => {
    expect(cleanNational(us, '(555) 123-4567 ext 9')).toBe('5551234567')
    expect(cleanNational(us, 'abc')).toBe('')
    expect(cleanNational(gb, '77009001234567')).toHaveLength(10)
  })
  it('lays the digits out as they are typed, with nothing dangling', () => {
    expect(formatNational(us, '')).toBe('')
    expect(formatNational(us, '5')).toBe('(5')
    expect(formatNational(us, '555')).toBe('(555')
    expect(formatNational(us, '5551')).toBe('(555) 1')
    expect(formatNational(us, '5551234567')).toBe('(555) 123-4567')
    expect(formatNational(gb, '7700900123')).toBe('7700 900123')
  })
  it('judges the length by country and builds the whole number', () => {
    expect(isNationalComplete(us, '555123456')).toBe(false)
    expect(isNationalComplete(us, '5551234567')).toBe(true)
    expect(toE164(us, '5551234567')).toBe('+15551234567')
    expect(toE164(us, '')).toBe('')
  })
  it('reads a number pasted with its code, choosing the longest matching code', () => {
    expect(splitInternational('+44 7700 900123')).toMatchObject({ country: { iso: 'gb' }, digits: '7700900123' })
    expect(splitInternational('+353 87 123 4567')?.country.iso).toBe('ie')
    expect(splitInternational('001 555 123 4567')).toMatchObject({ country: { iso: 'us' }, digits: '5551234567' })
    expect(splitInternational('555 123 4567')).toBeNull()
  })
  it('accepts a whole stored number, and any 7 to 15 digit number from a country not listed', () => {
    expect(isWholePhone('+15551234567')).toBe(true)
    expect(isWholePhone('+1555123')).toBe(false)
    expect(isWholePhone('+2551234567')).toBe(true)
  })
  it('starts on the guest\'s own country when it is listed, else +1', () => {
    expect(defaultPhoneCountry('en-GB')).toBe('gb')
    expect(defaultPhoneCountry('en-CA')).toBe('us')
    expect(defaultPhoneCountry('en')).toBe('us')
    expect(defaultPhoneCountry('fr-ZZ')).toBe('us')
  })
  it('lists each country once, with a pattern that fits its longest number', () => {
    expect(new Set(PHONE_COUNTRIES.map((p) => p.iso)).size).toBe(PHONE_COUNTRIES.length)
    for (const p of PHONE_COUNTRIES) {
      expect((p.pattern.match(/#/g) ?? []).length, p.iso).toBeGreaterThanOrEqual(p.min)
      expect(p.min <= p.max && p.code.length + p.max <= 15, p.iso).toBe(true)
    }
  })
})
