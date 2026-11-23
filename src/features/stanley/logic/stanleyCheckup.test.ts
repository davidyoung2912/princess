import { describe, expect, it } from 'vitest'
import { isUrgent, normalizeCheckup, normalizeDeadline, normalizeFinding, normalizeFix, whenText } from './stanleyCheckup'

const fix = { label: 'Open my documents', route: '/me/documents' }
const finding = (over: Record<string, unknown> = {}) => ({ id: 'doc:1:passport:tooSoon', rule: 'CHK-01', consequence: 'lostReservation', title: 'Your passport is too close to expiring', detail: 'Valid for 6 months.', day: null, due: null, fix, ...over })
const deadline = (over: Record<string, unknown> = {}) => ({ id: 'final-payment', consequence: 'lostReservation', title: 'Final payment due', date: '2027-01-04', daysLeft: 12, fix: { label: 'Open payments', route: '/me/payments' }, ...over })

describe('the trip check-up from the server', () => {
  it('only accepts a fix that stays inside the app', () => {
    expect(normalizeFix(fix)).toEqual(fix)
    for (const route of ['https://example.com', '//evil.com', 'javascript:alert(1)', '/a b', '']) expect(normalizeFix({ label: 'x', route })).toBeNull()
    expect(normalizeFix({ label: '', route: '/plan' })).toBeNull()
    expect(normalizeFix(null)).toBeNull()
  })

  it('reads a finding and refuses one with no fix or title', () => {
    expect(normalizeFinding(finding())).toMatchObject({ id: 'doc:1:passport:tooSoon', consequence: 'lostReservation', day: null, fix })
    expect(normalizeFinding(finding({ fix: null }))).toBeNull()
    expect(normalizeFinding(finding({ title: '' }))).toBeNull()
    expect(normalizeFinding(finding({ consequence: 'weird' }))?.consequence).toBe('optional')
    expect(normalizeFinding(finding({ day: 3 }))?.day).toBe(3)
  })

  it('reads a deadline and refuses a bad date', () => {
    expect(normalizeDeadline(deadline())).toMatchObject({ date: '2027-01-04', daysLeft: 12 })
    expect(normalizeDeadline(deadline({ date: 'soon' }))).toBeNull()
    expect(normalizeDeadline(deadline({ daysLeft: 'x' }))).toBeNull()
  })

  it('keeps the server order, drops what it cannot read, and never calls a result clean while a finding stands', () => {
    const c = normalizeCheckup({ hasTrip: true, findings: [finding({ id: 'b' }), 'junk', finding({ id: 'a' })], deadlines: [deadline()], notChecked: ['Flights', 4], clean: true, asOf: '2027-02-01T15:00:00Z' })!
    expect(c.findings.map((f) => f.id)).toEqual(['b', 'a'])
    expect(c.notChecked).toEqual(['Flights'])
    expect(c.clean).toBe(false)
    expect(normalizeCheckup({ hasTrip: true, findings: [], deadlines: [], notChecked: [], clean: true })!.clean).toBe(true)
    expect(normalizeCheckup({ findings: [] })).toBeNull()
    expect(normalizeCheckup(null)).toBeNull()
    expect(normalizeCheckup({ hasTrip: false })).toMatchObject({ hasTrip: false, findings: [], clean: false })
  })

  it('words a deadline and finds the urgent ones', () => {
    expect(whenText(-2)).toEqual({ key: 'overdue', count: 2 })
    expect(whenText(0).key).toBe('today')
    expect(whenText(1).key).toBe('tomorrow')
    expect(whenText(9)).toEqual({ key: 'days', count: 9 })
    expect(isUrgent({ consequence: 'lostReservation' })).toBe(true)
    expect(isUrgent({ consequence: 'conflict' })).toBe(false)
  })
})
