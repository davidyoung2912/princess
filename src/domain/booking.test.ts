import { describe, expect, it } from 'vitest'
import { blankContact, blankGuest, canEnter, emptyDraft, fillBlank, firstIncomplete, maskEmail, maskPhone, monthsOn, normalizeDraft, resizePeople, stepProblems, stepStates, STEPS, type Draft, type GuestDraft } from './booking'
import { cabinAvailable, cabinsFor } from './cabins'
import { buildIcs } from './calendar'
import { bookable, bookingQuote, capacityOf, checkParts, dueNow, fareIncludes, fareIncluded, fareOptions, payPlan, promotionsFor, scaRequired, SCA_LIMIT, walletSupported, DEFAULT_CARD_ID } from './fares'
import { acceptanceLog, cancelTerms, changeCheck, LEGAL, LEGAL_IDS } from './policy'
import { parseMoney, quote } from './pricing'

const guest = (first: string, dob: string): GuestDraft => ({ ...blankGuest(), firstName: first, lastName: 'Whitfield', dob, gender: 'M', citizenship: 'us', dietaryStatus: 'none' })
const complete = (over: Partial<Draft> = {}): Draft => ({
  ...emptyDraft('d1'), sailingId: 'sun-2027-03-21', category: 'balcony', guests: 2, fare: 'plus',
  people: [guest('Gerald', '1955-01-15'), guest('Ruth', '1957-02-01')],
  contact: { ...blankContact(), email: 'gerald@example.com', phone: '555-0142', street: '1 Main St', city: 'Tampa', region: 'FL', postcode: '33601' },
  dining: 'anytime', accepted: { terms: true, health: true, age: true, pregnancy: true }, ...over,
})
const ctx = { departure: '2027-03-21', today: '2026-10-29' }
const paths = (d: Draft, step: (typeof STEPS)[number]) => stepProblems(d, step, ctx).map((p) => `${p.path}:${p.code}`)

describe('fares and prices', () => {
  it('prices Standard exactly like the Discover estimate', () => {
    expect(bookingQuote('sun-2027-03-21', 'balcony', 2, 'standard')).toMatchObject({ total: quote('sun-2027-03-21', 'balcony', 2)!.total, fare: 'standard' })
  })

  it('swaps the gratuities line for the package line, and every line adds up to the total', () => {
    const std = bookingQuote('sun-2027-03-21', 'balcony', 2, 'standard')!
    const plus = bookingQuote('sun-2027-03-21', 'balcony', 2, 'plus')!
    expect(plus.lines.map((l) => l.key)).toEqual(['fare', 'taxes', 'package'])
    expect(plus.lines.find((l) => l.key === 'package')!.cents).toBe(6000 * 7 * 2)
    expect(plus.total).toBe(std.total - std.gratuities + 6000 * 7 * 2)
    for (const q of [std, plus]) expect(q.lines.reduce((n, l) => n + l.cents, 0)).toBe(q.total)
  })

  it('includes Premier in the suites at no extra charge, and allows only Premier there', () => {
    expect(fareOptions('signatureSuite')).toEqual(['premier'])
    expect(fareIncluded('sanctuaryMiniSuite')).toBe('premier')
    expect(bookingQuote('sun-2027-03-21', 'signatureSuite', 2, 'plus')).toBeNull()
    const q = bookingQuote('sun-2027-03-21', 'signatureSuite', 2, 'premier')!
    expect(q.lines.find((l) => l.key === 'package')!.cents).toBe(0)
    expect(fareOptions('balcony')).toEqual(['standard', 'plus', 'premier'])
  })

  it('refuses unknown sailings and too many guests', () => {
    expect(bookingQuote('nope', 'balcony', 2, 'standard')).toBeNull()
    expect(bookingQuote('sun-2027-03-21', 'signatureSuite', 4, 'premier')).toBeNull()
    expect(capacityOf('signatureSuite')).toBe(3)
  })

  it('describes what a fare includes from the entitlement engine', () => {
    expect(fareIncludes('plus')).toContain('Drinks up to $15 each')
    expect(fareIncludes('premier')).toContain('$100 shore excursion credit per guest')
    expect(fareIncludes('standard').join(' ')).toContain('Gratuities')
  })

  it('gives an onboard credit only when sailing is far enough away, more for suites', () => {
    expect(promotionsFor('balcony', 119)).toEqual([])
    expect(promotionsFor('balcony', 120)[0].creditCents).toBe(15_000)
    expect(promotionsFor('miniSuite', 200)[0].creditCents).toBe(30_000)
  })

  it('closes a sailing the day it leaves', () => {
    expect(bookable(1)).toBe(true)
    expect(bookable(0)).toBe(false)
  })
})

describe('paying', () => {
  it('offers a deposit until the final payment date, then only the full amount', () => {
    const far = payPlan(500_000, '2027-03-21', 143)
    expect(far.options).toEqual(['deposit', 'full'])
    expect(far.deposit).toBe(100_000)
    expect(far.finalDue).toBe('2026-12-21')
    expect(dueNow(far, 'deposit')).toBe(100_000)
    expect(dueNow(far, 'full')).toBe(500_000)
    expect(payPlan(500_000, '2027-03-21', 90).options).toEqual(['full'])
  })

  it('checks that the parts make up the amount due', () => {
    const card = (cardId: string, cents: number) => ({ method: 'card' as const, cardId, cents })
    expect(checkParts([card('a', 100)], 100)).toBeNull()
    expect(checkParts([card('a', 60), { method: 'wallet', cents: 40 }], 100)).toBeNull()
    expect(checkParts([], 100)).toBe('empty')
    expect(checkParts([card('a', 50), card('b', 25), card('c', 25)], 100)).toBe('tooMany')
    expect(checkParts([card('a', 99)], 100)).toBe('sum')
    expect(checkParts([card('a', 0), card('b', 100)], 100)).toBe('amount')
    expect(checkParts([card('a', 50), card('a', 50)], 100)).toBe('duplicate')
    expect(checkParts([card('a', 50.5), card('b', 49.5)], 100)).toBe('amount')
  })

  it('asks for the bank check on a new card or a large payment, never for the wallet', () => {
    expect(scaRequired({ method: 'card', cardId: DEFAULT_CARD_ID, cents: SCA_LIMIT - 100 })).toBe(false)
    expect(scaRequired({ method: 'card', cardId: DEFAULT_CARD_ID, cents: SCA_LIMIT })).toBe(true)
    expect(scaRequired({ method: 'card', cardId: 'card-new', cents: 100 })).toBe(true)
    expect(scaRequired({ method: 'wallet', cents: 999_999 })).toBe(false)
  })

  it('detects a device wallet from the Payment Request API', () => {
    expect(walletSupported({ PaymentRequest: function PaymentRequest() {} })).toBe(true)
    expect(walletSupported({})).toBe(false)
    expect(walletSupported(undefined)).toBe(false)
  })
})

describe('cancellation and change', () => {
  const base = { total: 500_000, paid: 100_000, deposit: 100_000 }
  it('is free for a day after booking when sailing is a week or more away', () => {
    expect(cancelTerms({ ...base, daysToDeparture: 50, hoursSinceBooking: 3 })).toEqual({ tier: 'free24h', fee: 0, refund: 100_000 })
    expect(cancelTerms({ ...base, daysToDeparture: 5, hoursSinceBooking: 3 }).tier).toBe('final')
  })

  it('charges more as sailing gets closer, and never refunds more than was paid', () => {
    expect(cancelTerms({ ...base, daysToDeparture: 120, hoursSinceBooking: 100 })).toEqual({ tier: 'early', fee: 100_000, refund: 0 })
    expect(cancelTerms({ ...base, paid: 500_000, daysToDeparture: 90, hoursSinceBooking: 100 })).toEqual({ tier: 'mid', fee: 250_000, refund: 250_000 })
    expect(cancelTerms({ ...base, paid: 500_000, daysToDeparture: 45, hoursSinceBooking: 100 })).toEqual({ tier: 'late', fee: 375_000, refund: 125_000 })
    expect(cancelTerms({ ...base, paid: 500_000, daysToDeparture: 14, hoursSinceBooking: 100 })).toEqual({ tier: 'final', fee: 500_000, refund: 0 })
    expect(cancelTerms({ ...base, paid: 100_000, daysToDeparture: 30, hoursSinceBooking: 100 }).refund).toBe(0)
  })

  it('allows a date change only before the final payment date, to a date outside it', () => {
    expect(changeCheck(143, 200, false)).toBe('ok')
    expect(changeCheck(90, 200, false)).toBe('tooLate')
    expect(changeCheck(143, 60, false)).toBe('newTooSoon')
    expect(changeCheck(143, 143, true)).toBe('same')
  })

  it('logs acceptance with the version shown', () => {
    expect(LEGAL_IDS).toEqual(['terms', 'health', 'age', 'pregnancy'])
    expect(acceptanceLog({ terms: true, age: true }, 5)).toEqual([{ id: 'terms', version: LEGAL[0].version, at: 5 }, { id: 'age', version: LEGAL[2].version, at: 5 }])
    expect(acceptanceLog({}, 5)).toEqual([])
  })
})

describe('drafts', () => {
  it('turns anything stored into a safe draft, with people matching the guest count', () => {
    const d = normalizeDraft({ id: 'x', sailingId: 'nope', category: 'balcony', guests: 9, fare: 'bogus', people: 'bad', contact: 5, dining: 'late', occasion: 'party' }, 'fallback')
    expect(d).toMatchObject({ id: 'x', sailingId: '', category: 'balcony', fare: '', dining: 'late', occasion: 'none' })
    expect(d.guests).toBe(4)
    expect(d.people).toHaveLength(4)
    expect(normalizeDraft(null, 'f').id).toBe('f')
    expect(normalizeDraft({ category: 'signatureSuite', guests: 4, people: [{}, {}, {}, {}] }, 'f')).toMatchObject({ guests: 3, fare: 'premier' })
  })

  it('keeps entered people when the guest count changes', () => {
    const d = complete()
    expect(resizePeople(d, 1).people).toEqual([d.people[0]])
    expect(resizePeople(d, 3).people.slice(0, 2)).toEqual(d.people)
    expect(resizePeople(d, 3).people[2]).toEqual(blankGuest())
    expect(resizePeople(d, 99).guests).toBe(4)
  })

  it('reports nothing on a complete draft', () => {
    for (const step of STEPS) expect(paths(complete(), step)).toEqual([])
    expect(firstIncomplete(complete(), ctx)).toBe('pay')
  })

  it('finds what is missing on each step', () => {
    expect(paths(emptyDraft('x'), 'sailing')).toEqual(['sailingId:choose'])
    expect(paths(complete({ category: '' }), 'room')).toEqual(['category:choose'])
    expect(paths(complete({ cabinMode: 'pick' }), 'room')).toEqual(['cabinNumber:choose'])
    expect(paths(complete({ fare: '' }), 'fare')).toEqual(['fare:choose'])
    expect(paths(complete({ dining: '' }), 'dining')).toEqual(['dining:choose'])
    expect(paths(complete({ accepted: { terms: true } }), 'review')).toEqual(['accepted.health:accept', 'accepted.age:accept', 'accepted.pregnancy:accept'])
  })

  it('checks names, birth dates, ages and contact details', () => {
    const d = complete()
    d.people[0] = { ...d.people[0], firstName: 'Ge4rald', lastName: ' ', dob: '2999-01-01', gender: '', citizenship: '' }
    d.contact = { ...d.contact, email: 'nope', phone: 'abc', street: '' }
    expect(paths(d, 'guests')).toEqual(expect.arrayContaining(['people.0.firstName:name', 'people.0.lastName:required', 'people.0.dob:future', 'people.0.gender:choose', 'people.0.citizenship:choose', 'contact.email:email', 'contact.phone:phone', 'contact.street:required']))
    const apostrophe = complete()
    apostrophe.people[1] = { ...apostrophe.people[1], firstName: "Mary-Jo O'Neil", lastName: 'García' }
    expect(paths(apostrophe, 'guests')).toEqual([])
  })

  it('needs one guest 21 or older, an adult to book, and babies of at least six months', () => {
    const kids = complete()
    kids.people = [guest('A', '2010-01-01'), guest('B', '2012-01-01')]
    expect(paths(kids, 'guests')).toEqual(['people.0.dob:leadAge', 'people:noAdult'])
    const baby = complete()
    baby.people[1] = { ...baby.people[1], dob: '2026-10-01' }
    expect(paths(baby, 'guests')).toEqual(['people.1.dob:tooYoung'])
    expect(monthsOn('2026-09-21', '2027-03-21')).toBe(6)
    expect(monthsOn('2026-09-22', '2027-03-21')).toBe(5)
    const nineteen = complete()
    nineteen.people = [guest('A', '2008-06-01'), guest('B', '2020-01-01')]
    expect(paths(nineteen, 'guests')).toEqual(['people:noAdult'])
  })

  it('requires an explicit dietary answer for each guest, with detail when there are needs', () => {
    const d = complete()
    d.people[0] = { ...d.people[0], dietaryStatus: '' }
    d.people[1] = { ...d.people[1], dietaryStatus: 'some' }
    expect(paths(d, 'dining')).toEqual(['people.0.dietaryStatus:choose', 'people.1.dietary:detail'])
    d.people[1] = { ...d.people[1], allergyNote: 'Peanuts' }
    d.people[0] = { ...d.people[0], dietaryStatus: 'none' }
    expect(paths(d, 'dining')).toEqual([])
  })

  it('only opens a step when every step before it is complete', () => {
    const d = complete({ fare: '' })
    expect(canEnter(d, 'fare', ctx)).toBe(true)
    expect(canEnter(d, 'guests', ctx)).toBe(false)
    expect(firstIncomplete(d, ctx)).toBe('fare')
    expect(stepStates(d, 'guests', ctx).map((s) => s.state)).toEqual(['done', 'done', 'todo', 'current', 'todo', 'todo', 'todo'])
  })

  it('hides the middle of an address or number', () => {
    expect(maskEmail('gerald@example.com')).toBe('g***@example.com')
    expect(maskPhone('555-0142')).toBe('***-0142')
  })
})

describe('staterooms', () => {
  it('gives the same sample rooms every time, with free ones to choose', () => {
    const a = cabinsFor('sun-2027-03-21', 'balcony')
    expect(a).toEqual(cabinsFor('sun-2027-03-21', 'balcony'))
    expect(a.length).toBeGreaterThan(5)
    expect(a.filter((c) => c.available).length).toBeGreaterThanOrEqual(2)
    expect(new Set(a.map((c) => c.number)).size).toBe(a.length)
    expect(a.some((c) => c.accessible)).toBe(true)
    expect(cabinsFor('sun-2027-03-21', 'signatureSuite').every((c) => c.deck === 16)).toBe(true)
  })

  it('checks a number against the free rooms of that type', () => {
    const [first] = cabinsFor('sun-2027-03-21', 'interior')
    expect(cabinAvailable('sun-2027-03-21', 'interior', first.number)).toBe(true)
    expect(cabinAvailable('sun-2027-03-21', 'interior', '0000')).toBe(false)
  })
})

describe('calendar file', () => {
  it('writes one all-day event for the whole cruise with escaped text and CRLF lines', () => {
    const ics = buildIcs({ uid: 'PB1@princess', summary: 'Cruise, Sun Princess', description: 'Line one\nLine two; ok', location: 'Fort Lauderdale', start: '2027-03-21', end: '2027-03-28', stamp: Date.UTC(2026, 9, 29, 12) })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20270321\r\n')
    expect(ics).toContain('DTEND;VALUE=DATE:20270329\r\n')
    expect(ics).toContain('SUMMARY:Cruise\\, Sun Princess')
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\\; ok')
    expect(ics).toContain('DTSTAMP:20261029T120000Z')
  })

  it('folds long lines at 75 characters', () => {
    const ics = buildIcs({ uid: 'u', summary: 'x'.repeat(200), description: '', location: '', start: '2027-03-21', end: '2027-03-28', stamp: 0 })
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })
})

describe('starting from the account', () => {
  const account = { people: [{ ...guest('Priya', '1987-01-15'), gender: '' as const }, guest('Daniel', '1985-03-02')], contact: { ...blankContact(), email: 'p@example.com', phone: '555-0100' } }

  it('fills guests that are still blank and empty contact details, and nothing else', () => {
    const d = fillBlank(emptyDraft('x'), account)
    expect(d.people.map((g) => g.firstName)).toEqual(['Priya', 'Daniel'])
    expect(d.contact).toMatchObject({ email: 'p@example.com', phone: '555-0100' })
    const typed = emptyDraft('x')
    typed.people[0] = { ...blankGuest(), firstName: 'Someone' }
    typed.contact.email = 'mine@example.com'
    const kept = fillBlank(typed, account)
    expect(kept.people[0].firstName).toBe('Someone')
    expect(kept.people[1].firstName).toBe('Daniel')
    expect(kept.contact.email).toBe('mine@example.com')
  })

  it('returns the very same draft when there is nothing to fill, so no save is triggered', () => {
    const full = fillBlank(emptyDraft('x'), account)
    expect(fillBlank(full, account)).toBe(full)
    expect(fillBlank(emptyDraft('x'), { people: [], contact: blankContact() })).toEqual(emptyDraft('x'))
  })
})

describe('typed amounts', () => {
  it('reads dollars as cents and refuses anything else', () => {
    expect(parseMoney('1,250')).toBe(125_000)
    expect(parseMoney('$99.5')).toBe(9950)
    expect(parseMoney(' 40.25 ')).toBe(4025)
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '$']) expect(parseMoney(bad), bad).toBeNull()
  })
})
