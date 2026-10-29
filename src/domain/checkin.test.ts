import { describe, expect, it } from 'vitest'
import {
  assignmentFor, boardingGroup, currentCompanion, decodePass, encodePass, laneFor, luggageStatus, musterStation, passName, seqOf, terminalFor, trafficFor, windowFor, WAIT_MINUTES,
} from './boarding'
import {
  checkinProgress, checkinWindow, guestProgress, judgePhoto, measurePhoto, normalizeGuestCheckin, SAMPLE_PHOTOS, stepDone, validateDocument, validateEmergency, validateHealth,
} from './checkin'
import { cacheGet, cachePut, cacheKey } from './offlineCache'

const RETURN = '2027-03-28'

describe('travel document', () => {
  it('accepts a passport that is valid six months past the return date', () => {
    expect(validateDocument({ kind: 'passport', country: 'United States', number: 'a1234-567', expires: '2030-01-01' }, 'us', RETURN)).toBeNull()
  })

  it('says exactly what is wrong with a passport', () => {
    const base = { kind: 'passport', country: 'United States', number: 'A1234567', expires: '2030-01-01' }
    expect(validateDocument({ ...base, kind: 'visa' }, 'us', RETURN)).toBe('kind')
    expect(validateDocument({ ...base, country: '' }, 'us', RETURN)).toBe('country')
    expect(validateDocument({ ...base, number: '12' }, 'us', RETURN)).toBe('number')
    expect(validateDocument({ ...base, expires: 'soon' }, 'us', RETURN)).toBe('expiry')
    expect(validateDocument({ ...base, expires: '2027-03-01' }, 'us', RETURN)).toBe('expired')
    expect(validateDocument({ ...base, expires: '2027-08-14' }, 'us', RETURN)).toBe('tooSoon')
  })

  it('allows a birth certificate for US citizens only', () => {
    expect(validateDocument({ kind: 'birthCertificate', country: '', number: '', expires: '' }, 'us', RETURN)).toBeNull()
    expect(validateDocument({ kind: 'birthCertificate', country: '', number: '', expires: '' }, 'other', RETURN)).toBe('notAllowed')
  })
})

describe('security photo', () => {
  const flat = (w: number, h: number, v: number) => Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : v))
  const stripes = (w: number, h: number, a: number, b: number) => Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : Math.floor(i / 4) % 2 === 0 ? a : b))

  it('measures brightness and sharpness from the pixels', () => {
    expect(measurePhoto(8, 8, flat(8, 8, 100))).toMatchObject({ brightness: expect.closeTo(100, 0), sharpness: 0 })
    const m = measurePhoto(8, 8, stripes(8, 8, 60, 200), 1200, 1500)
    expect(m.sharpness).toBeGreaterThan(50)
    expect(m).toMatchObject({ width: 1200, height: 1500 })
  })

  it('judges the samples and names every problem at once', () => {
    expect(judgePhoto(SAMPLE_PHOTOS.good)).toEqual([])
    expect(judgePhoto(SAMPLE_PHOTOS.dark)).toEqual(['dark'])
    expect(judgePhoto(SAMPLE_PHOTOS.blurry)).toEqual(['blurry'])
    expect(judgePhoto({ width: 200, height: 900, brightness: 250, sharpness: 1 })).toEqual(['small', 'shape', 'bright', 'blurry'])
    expect(judgePhoto({ width: NaN, height: 1, brightness: 1, sharpness: 1 })).toEqual(['small'])
  })
})

describe('emergency contact and health questions', () => {
  const contact = { name: 'Sam Example', phone: '555-0142', relationship: 'Friend' }
  it('needs a name, a real phone number, a relationship, and someone not on the ship', () => {
    expect(validateEmergency(contact, ['Gerald Whitfield'])).toBeNull()
    expect(validateEmergency({ ...contact, name: ' ' }, [])).toBe('name')
    expect(validateEmergency({ ...contact, phone: 'abc' }, [])).toBe('phone')
    expect(validateEmergency({ ...contact, relationship: '' }, [])).toBe('relationship')
    expect(validateEmergency({ ...contact, name: 'sam example' }, ['Sam Example'])).toBe('travelling')
  })

  it('wants every question answered, and flags any yes without refusing', () => {
    expect(validateHealth({ symptoms: false, positive: false })).toBeNull()
    expect(validateHealth({ symptoms: false, positive: false, contact: false })).toEqual({ answers: { symptoms: false, positive: false, contact: false }, flagged: false })
    expect(validateHealth({ symptoms: true, positive: false, contact: false })!.flagged).toBe(true)
  })
})

describe('progress', () => {
  const at = { at: 1 }
  const full = normalizeGuestCheckin({ confirm: at, document: { ...at, kind: 'passport', country: 'US', last4: '4567', expires: '2030-01-01' }, photo: at, emergency: { ...at, name: 'A B', phone: '555-0100', relationship: 'x' }, contract: { ...at, version: '1', by: 'm' }, health: { ...at, answers: { symptoms: false, positive: false, contact: false } } })

  it('counts steps per guest and per booking and names the first thing left', () => {
    const a = { id: 'a', progress: guestProgress(full) }
    const b = { id: 'b', progress: guestProgress({ confirm: at }) }
    expect(a.progress.complete).toBe(true)
    expect(b.progress.left).toEqual(['document', 'photo', 'emergency', 'contract', 'health'])
    const p = checkinProgress([a, b], { payment: false, arrival: true })
    expect(p).toMatchObject({ done: 6 + 1 + 1, total: 14, complete: false, bookingLeft: ['payment'], next: { step: 'document', guest: 'b' } })
    expect(stepDone('document', [a, b], p.bookingLeft)).toBe(false)
    expect(stepDone('confirm', [a, b], p.bookingLeft)).toBe(true)
    expect(stepDone('arrival', [a, b], p.bookingLeft)).toBe(true)
  })

  it('is complete only when every guest and the booking are done', () => {
    const a = { id: 'a', progress: guestProgress(full) }
    expect(checkinProgress([a], { payment: true, arrival: true })).toMatchObject({ complete: true, next: null, done: 8, total: 8 })
    expect(checkinProgress([a], { payment: false, arrival: true }).next).toEqual({ step: 'payment', guest: null })
  })

  it('ignores damaged stored records instead of failing', () => {
    expect(normalizeGuestCheckin(null)).toEqual({})
    expect(normalizeGuestCheckin({ document: { kind: 'visa', at: 1 }, photo: 'yes', health: { at: 1, answers: { symptoms: 1 } } })).toEqual({})
  })

  it('opens three days out and closes on sailing day', () => {
    expect(checkinWindow(5, 10, 20)).toBe('notOpen')
    expect(checkinWindow(10, 10, 20)).toBe('open')
    expect(checkinWindow(20, 10, 20)).toBe('closed')
  })
})

describe('boarding pass', () => {
  const pass = { v: 1 as const, booking: 'PC482113', seq: 2, name: passName('Maya', 'Harper'), departure: '2027-03-21', cabin: '10412', group: 'Group 3' }

  it('round-trips through the QR text and spots any edit', () => {
    const text = encodePass(pass)
    expect(decodePass(text)).toEqual({ ...pass, name: 'HARPER/MAYA' })
    expect(decodePass(text.replace('10412', '10413'))).toBeNull()
    expect(decodePass('PCP1|short')).toBeNull()
    expect(decodePass('hello')).toBeNull()
  })

  it('gives the same stateroom every time, and a step-free one when needed', () => {
    expect(assignmentFor('gerald', 'sun-2027-03-21', false)).toEqual(assignmentFor('gerald', 'sun-2027-03-21', false))
    expect(assignmentFor('linda', 'sun-2027-03-21', true).accessible).toBe(true)
    expect(assignmentFor('gerald', 'sun-2027-03-21', false).accessible).toBe(false)
    expect(musterStation({ position: 'forward', side: 'port' })).toBe('Station A')
    expect(musterStation({ position: 'aft', side: 'starboard' })).toBe('Station F')
  })

  it('groups priority guests first and the rest by the window they chose', () => {
    expect(boardingGroup(true, '10:30')).toBe('Priority')
    expect(boardingGroup(false, '11:00')).toBe('Group 1')
    expect(boardingGroup(false, '12:30')).toBe('Group 4')
    expect(boardingGroup(false, null)).toBe('Not set')
    expect(laneFor(true)).toBe('green')
    expect(laneFor(false)).toBe('blue')
    expect(seqOf('daniel', 'ethan')).toBe(3)
  })

  it('gives wait guides and traffic from how busy the window is', () => {
    expect(windowFor('12:00', false)?.crowd).toBe('busiest')
    expect(windowFor('10:30', false)).toBeNull()
    expect(WAIT_MINUTES.busiest).toBeGreaterThan(WAIT_MINUTES.quiet)
    expect(trafficFor('quiet')).toBe('light')
    expect(trafficFor('busiest')).toBe('heavy')
  })

  it('moves the terminal with a note of the change', () => {
    expect(terminalFor(false)).toEqual({ name: 'Terminal 2' })
    expect(terminalFor(true)).toEqual({ name: 'Terminal 4', changedFrom: 'Terminal 2' })
  })

  it('tracks bags from the porters to the stateroom', () => {
    const hour = 3_600_000
    expect(luggageStatus(null, 100 * hour, 0)).toBe('notDropped')
    expect(luggageStatus(10 * hour, 11 * hour, 0)).toBe('dropped')
    expect(luggageStatus(10 * hour, 13 * hour, 0)).toBe('delivered')
    expect(luggageStatus(10 * hour, 13 * hour, 20 * hour)).toBe('dropped')
  })

  it('walks the companion cards in order', () => {
    expect(currentCompanion([])).toBe('terminal')
    expect(currentCompanion(['terminal', 'security'])).toBe('photo')
    expect(currentCompanion(['terminal', 'security', 'photo', 'gangway', 'muster', 'cabin'])).toBeNull()
  })
})

describe('offline copies', () => {
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
  }
  const asNumber = (raw: unknown) => (typeof raw === 'number' ? raw : null)

  it('keeps a copy with the time it was saved', () => {
    const s = memory()
    expect(cachePut(s, 'pass', 'PC1', 42, 1000)).toBe(true)
    expect(cacheGet(s, 'pass', 'PC1', asNumber)).toEqual({ savedAt: 1000, value: 42 })
    expect(cacheGet(s, 'pass', 'PC2', asNumber)).toBeNull()
  })

  it('treats damaged or foreign contents as no copy', () => {
    const s = memory()
    s.setItem(cacheKey('pass', 'x'), 'not json')
    expect(cacheGet(s, 'pass', 'x', asNumber)).toBeNull()
    s.setItem(cacheKey('pass', 'y'), JSON.stringify({ savedAt: 'noon', value: 1 }))
    expect(cacheGet(s, 'pass', 'y', asNumber)).toBeNull()
    s.setItem(cacheKey('pass', 'z'), JSON.stringify({ savedAt: 1, value: 'text' }))
    expect(cacheGet(s, 'pass', 'z', asNumber)).toBeNull()
  })

  it('copes with no storage or a full one', () => {
    expect(cachePut(null, 'pass', 'a', 1, 1)).toBe(false)
    expect(cacheGet(null, 'pass', 'a', asNumber)).toBeNull()
    const full = { setItem: () => { throw new Error('quota') } }
    expect(cachePut(full, 'pass', 'a', 1, 1)).toBe(false)
  })
})
