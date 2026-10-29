import { describe, expect, it } from 'vitest'
import { ageOn, defaultProfile, helperMay, nameChange, normalizeHelper, normalizeProfile, validateCard, validateProfile } from './account'
import { DEFAULT_HELD, docStatus, guestDocuments, normalizeHeld, passportValidUntil, requirementsFor } from './documents'
import { CONTACT_OPTIONS, contactStatus, FAQS, searchFaqs, ticketStatus } from './help'
import { buildNotices, DEFAULT_PREFS, inQuietHours, normalizePrefs } from './notifications'
import { PERSONAS } from './personas'
import { AGENT_BOOKINGS, bookingNumber, categoryOfStateroom, daysBetween, matchBooking, nextAction, normalizeBookingNumber, paymentPlan, paymentState, pastTrips } from './trip'

describe('trip and payments', () => {
  it('counts days between dates', () => {
    expect(daysBetween('2027-03-07', '2027-03-21')).toBe(14)
    expect(daysBetween('2027-03-21', '2027-03-07')).toBe(-14)
  })

  it('gives every booker a stable, different booking number', () => {
    const numbers = PERSONAS.map((p) => bookingNumber(p.id))
    expect(new Set(numbers).size).toBe(numbers.length)
    expect(bookingNumber('gerald')).toBe(bookingNumber('gerald'))
    expect(numbers.every((n) => /^PC\d{6}$/.test(n))).toBe(true)
  })

  it('splits the total into a whole-dollar deposit and a balance that add up', () => {
    const plan = paymentPlan(345_650, '2027-03-21', 90)
    expect(plan.deposit % 100).toBe(0)
    expect(plan.deposit + plan.balance).toBe(plan.total)
    expect(plan.finalDue).toBe('2026-12-21')
    expect(plan.booked < plan.finalDue).toBe(true)
  })

  it('moves a payment from upcoming to due soon to overdue, and paid wins', () => {
    const plan = paymentPlan(100_000, '2027-03-21', 90)
    expect(paymentState(plan, false, '2026-09-01')).toBe('upcoming')
    expect(paymentState(plan, false, '2026-12-01')).toBe('dueSoon')
    expect(paymentState(plan, false, '2026-12-21')).toBe('dueSoon')
    expect(paymentState(plan, false, '2026-12-22')).toBe('overdue')
    expect(paymentState(plan, true, '2027-02-01')).toBe('paid')
  })

  it('puts money before paperwork before check-in when choosing the next action', () => {
    const base = { payment: 'paid' as const, documentsMissing: 0, checkinOpen: false, checkinDone: false }
    expect(nextAction({ ...base, payment: 'overdue', documentsMissing: 2 })).toBe('payOverdue')
    expect(nextAction({ ...base, payment: 'dueSoon', documentsMissing: 1 })).toBe('documents')
    expect(nextAction({ ...base, payment: 'dueSoon' })).toBe('payDue')
    expect(nextAction({ ...base, checkinOpen: true })).toBe('checkin')
    expect(nextAction({ ...base, checkinOpen: true, checkinDone: true })).toBe('allSet')
  })

  it('prices every stateroom kind as a known room type', () => {
    expect(categoryOfStateroom('connectingBalcony')).toBe('balcony')
    expect(categoryOfStateroom('accessibleBalcony')).toBe('balcony')
    expect(categoryOfStateroom('interior')).toBe('interior')
  })

  it('links a booking only when number, name and date all match', () => {
    const b = AGENT_BOOKINGS[0]
    const date = '2027-03-21'
    expect(matchBooking(' ag4k-72q ', 'whitfield', date, [])).toMatchObject({ ok: true })
    expect(matchBooking(b.number, 'Smith', date, [])).toEqual({ ok: false, reason: 'noMatch' })
    expect(matchBooking(b.number, 'Whitfield', '2027-02-28', [])).toEqual({ ok: false, reason: 'noMatch' })
    expect(matchBooking('12', 'Whitfield', date, [])).toEqual({ ok: false, reason: 'format' })
    expect(matchBooking(b.number, '', date, [])).toEqual({ ok: false, reason: 'format' })
    expect(matchBooking(b.number, 'Whitfield', date, [b.number])).toEqual({ ok: false, reason: 'alreadyLinked' })
    expect(normalizeBookingNumber('ag 4k-72q')).toBe('AG4K72Q')
  })

  it('lists past trips for repeat guests and none for a first-time cruiser', () => {
    expect(pastTrips('gerald').length).toBeGreaterThan(1)
    expect(pastTrips('maria')).toEqual([])
    expect(pastTrips('priya')).toEqual(pastTrips('daniel'))
  })
})

describe('documents engine', () => {
  const returnDate = '2027-03-28'

  it('asks US adults for proof of citizenship and a photo ID, children for proof only, and others for a passport', () => {
    const ids = (c: 'us' | 'other', age: number) => requirementsFor(c, age).filter((r) => r.level === 'required').map((r) => r.id)
    expect(ids('us', 40)).toEqual(['proofOfCitizenship', 'photoId'])
    expect(ids('us', 8)).toEqual(['proofOfCitizenship'])
    expect(ids('other', 40)).toEqual(['passport'])
  })

  it('needs a passport to last six months past the return', () => {
    expect(passportValidUntil(returnDate)).toBe('2027-09-28')
    expect(docStatus('passport', { passport: { expires: '2027-09-28' } }, returnDate)).toBe('ok')
    expect(docStatus('passport', { passport: { expires: '2027-08-14' } }, returnDate)).toBe('tooSoon')
    expect(docStatus('passport', { passport: { expires: '2027-03-01' } }, returnDate)).toBe('expired')
    expect(docStatus('passport', { passport: {} }, returnDate)).toBe('noExpiry')
    expect(docStatus('passport', {}, returnDate)).toBe('missing')
    expect(docStatus('birthCertificate', { birthCertificate: {} }, returnDate)).toBe('ok')
  })

  it('accepts a passport or a birth certificate as proof, and a passport or photo ID as ID', () => {
    const ok = guestDocuments('us', 40, { birthCertificate: {}, photoId: { expires: '2030-01-01' } }, returnDate)
    expect(ok.ready).toBe(true)
    expect(guestDocuments('us', 40, { passport: { expires: '2031-01-01' } }, returnDate).ready).toBe(true)
    expect(guestDocuments('us', 40, {}, returnDate).blocking).toBe(2)
  })

  it('flags a passport that is too close to expiry as a problem, not as missing', () => {
    const g = guestDocuments('us', 71, DEFAULT_HELD.gerald, returnDate)
    const proof = g.results.find((r) => r.requirement.id === 'proofOfCitizenship')!
    expect(proof.status).toBe('problem')
    expect(proof.problem).toBe('tooSoon')
    expect(g.blocking).toBe(1)
  })

  it('starts the demo people sensibly: Maria has nothing yet, the Harpers are ready', () => {
    const ready = (id: string, age: number, c: 'us' | 'other' = 'us') => guestDocuments(c, age, DEFAULT_HELD[id], returnDate).ready
    expect(ready('maria', 38)).toBe(false)
    for (const [id, age] of [['daniel', 41], ['priya', 39], ['ethan', 14], ['maya', 8]] as const) expect(ready(id, age), id).toBe(true)
    expect(ready('alexander', 54, 'other')).toBe(true)
  })

  it('keeps only known documents and valid dates from stored data', () => {
    expect(normalizeHeld({ passport: { expires: 'soon', extra: 1 }, birthCertificate: { expires: '2030-01-01' }, nonsense: {}, photoId: 'x' })).toEqual({ passport: {}, birthCertificate: {} })
    expect(normalizeHeld(null)).toEqual({})
  })
})

describe('profile', () => {
  it('starts every demo person with a valid profile, using example addresses', () => {
    for (const p of PERSONAS) {
      const profile = defaultProfile(p.id)
      expect(validateProfile(profile, '2027-03-07', p.child), p.id).toEqual({})
      if (profile.email) expect(profile.email.endsWith('@example.com')).toBe(true)
      expect(ageOn(profile.dob, '2027-03-07')).toBe(p.age)
    }
  })

  it('reports each problem on its field', () => {
    const p = { ...defaultProfile('gerald'), firstName: ' ', dob: '2030-01-01', email: 'nope', phone: 'abc', emergency: { name: 'Sam', phone: '', relationship: '' } }
    expect(validateProfile(p, '2027-03-07', false)).toEqual({ firstName: 'required', dob: 'future', email: 'email', phone: 'phone', emergencyPhone: 'pair' })
    expect(validateProfile({ ...p, dob: '' }, '2027-03-07', false).dob).toBe('required')
    expect(validateProfile({ ...defaultProfile('maya'), email: '' }, '2027-03-07', true).email).toBeUndefined()
  })

  it('cleans stored data, keeping defaults for what is missing or wrong', () => {
    const p = normalizeProfile({ firstName: 'Gerry', dietary: ['vegan', 'pizza'], bedding: 'bunk', citizenship: 'mars', emergency: { name: 7 } }, 'gerald')
    expect(p.firstName).toBe('Gerry')
    expect(p.lastName).toBe('Whitfield')
    expect(p.dietary).toEqual(['vegan'])
    expect(p.bedding).toBe('noPreference')
    expect(p.citizenship).toBe('us')
    expect(p.emergency.name).toBe(defaultProfile('gerald').emergency.name)
    expect(normalizeProfile({ needs: [] }, 'gerald').needs).toEqual([])
  })

  it('lets small spelling fixes through early and sends bigger or later changes to Guest Services', () => {
    expect(nameChange('Gerald Whitfield', 'Gerald Whitfeld', 60)).toEqual({ allowed: true })
    expect(nameChange('Gerald Whitfield', 'gerald whitfield', 5)).toEqual({ allowed: true })
    expect(nameChange('Gerald Whitfield', 'Gerald Whitfeld', 5)).toEqual({ allowed: false, reason: 'late' })
    expect(nameChange('Gerald Whitfield', 'Paul Jones', 60)).toEqual({ allowed: false, reason: 'large' })
  })

  it('checks card digits and expiry, good through the end of the expiry month', () => {
    expect(validateCard('4242', '09/29', '2027-03-07')).toBeNull()
    expect(validateCard('424', '09/29', '2027-03-07')).toBe('last4')
    expect(validateCard('4242', '13/29', '2027-03-07')).toBe('expiry')
    expect(validateCard('4242', '9/29', '2027-03-07')).toBe('expiry')
    expect(validateCard('4242', '02/27', '2027-03-07')).toBe('expired')
    expect(validateCard('4242', '03/27', '2027-03-07')).toBeNull()
  })

  it('lets a helper act only while active and only for what was allowed', () => {
    const h = normalizeHelper({ name: 'Paul', relationship: 'Son', permissions: ['view', 'payments', 'bogus'], status: 'active', at: 5 })!
    expect(h.permissions).toEqual(['view', 'payments'])
    expect(helperMay(h, 'payments')).toBe(true)
    expect(helperMay(h, 'documents')).toBe(false)
    expect(helperMay({ ...h, status: 'requested' }, 'view')).toBe(false)
    expect(helperMay({ ...h, status: 'revoked' }, 'view')).toBe(false)
    expect(helperMay({ ...h, permissions: ['payments'] }, 'payments')).toBe(false)
    expect(helperMay(null, 'view')).toBe(false)
    expect(normalizeHelper({ name: ' ' })).toBeNull()
  })
})

describe('notifications', () => {
  it('never lets critical notices be switched off', () => {
    const p = normalizePrefs({ channels: { critical: { push: false, email: false, sms: false }, offers: { push: true } } })
    expect(p.channels.critical).toEqual({ push: true, email: true, sms: true })
    expect(p.channels.offers.push).toBe(true)
    expect(p.channels.offers.email).toBe(false)
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS)
  })

  it('treats quiet hours across midnight, and lets critical notices through', () => {
    const q = { on: true, from: '22:00', to: '07:00' }
    expect(inQuietHours(q, '23:30', 'payments')).toBe(true)
    expect(inQuietHours(q, '06:59', 'payments')).toBe(true)
    expect(inQuietHours(q, '07:00', 'payments')).toBe(false)
    expect(inQuietHours(q, '12:00', 'payments')).toBe(false)
    expect(inQuietHours(q, '23:30', 'critical')).toBe(false)
    expect(inQuietHours({ ...q, on: false }, '23:30', 'payments')).toBe(false)
    expect(inQuietHours({ on: true, from: '09:00', to: '17:00' }, '12:00', 'checkin')).toBe(true)
    expect(normalizePrefs({ quiet: { on: true, from: '25:00' } }).quiet.from).toBe('22:00')
  })

  it('builds notices from the trip, most urgent first', () => {
    const input = { payment: 'overdue' as const, finalDue: '2026-12-21', documentsMissing: 2, passportProblems: 1, checkinState: 'notOpen' as const, checkinOpens: '2027-03-18' }
    expect(buildNotices(input).map((n) => n.id)).toEqual(['payOverdue', 'passportProblem', 'documentsMissing', 'checkinOpens'])
    expect(buildNotices({ ...input, payment: 'paid', documentsMissing: 0, passportProblems: 0, checkinState: 'done' })).toEqual([])
    expect(buildNotices(input)[0].category).toBe('critical')
  })
})

describe('help centre and contact', () => {
  it('finds answers by any word in the question or answer, best match first', () => {
    expect(searchFaqs('passport').length).toBeGreaterThan(1)
    expect(searchFaqs('  ')).toHaveLength(FAQS.length)
    expect(searchFaqs('zzzz')).toEqual([])
    expect(searchFaqs("can't see booking")[0]?.id).toBe('cant-see-booking')
    expect(searchFaqs('passport valid six months').map((f) => f.id)).toContain('what-documents')
  })

  it('points every answer link at a real screen', () => {
    for (const f of FAQS) if (f.link) expect(f.link.to).toMatch(/^\/me\//)
  })

  it('shows hours and the usual wait', () => {
    const phone = CONTACT_OPTIONS.find((o) => o.id === 'phone')!
    const chat = CONTACT_OPTIONS.find((o) => o.id === 'chat')!
    expect(contactStatus(phone, 7.5)).toEqual({ open: false, waitMinutes: null })
    expect(contactStatus(phone, 10)).toEqual({ open: true, waitMinutes: 12 })
    expect(contactStatus(phone, 14)).toEqual({ open: true, waitMinutes: 4 })
    expect(contactStatus(chat, 3).open).toBe(true)
    expect(contactStatus(CONTACT_OPTIONS.find((o) => o.id === 'email')!, 3)).toEqual({ open: true, waitMinutes: null })
  })

  it('moves a request along as it ages', () => {
    expect(ticketStatus(0, 5 * 60_000)).toBe('received')
    expect(ticketStatus(0, 30 * 60_000)).toBe('inProgress')
    expect(ticketStatus(0, 2 * 3_600_000)).toBe('resolved')
  })
})
