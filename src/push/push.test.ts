import { describe, expect, it } from 'vitest'
import { badgeCount, bytesToKey, cleanWatch, feedUrl, isIos, keyToBytes, normalizeLogEntry, pushSupport, shouldDispatch, webcalUrl, type PushEnvironment } from './push'

const CHROME: PushEnvironment = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, permission: 'default', userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', standalone: false, maxTouchPoints: 5 }
const IPHONE_TAB: PushEnvironment = { ...CHROME, hasPushManager: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604', standalone: false }

describe('what this browser can do about alerts (N3.1)', () => {
  it('can ask in a browser that supports push, and says so once allowed or blocked', () => {
    expect(pushSupport(CHROME)).toBe('ask')
    expect(pushSupport({ ...CHROME, permission: 'granted' })).toBe('granted')
    expect(pushSupport({ ...CHROME, permission: 'denied' })).toBe('denied')
  })

  it('tells an iPhone in the browser to add the app to the Home Screen first, even though push looks missing there', () => {
    expect(pushSupport(IPHONE_TAB)).toBe('needsInstall')
    expect(pushSupport({ ...IPHONE_TAB, standalone: true, hasPushManager: true })).toBe('ask')
  })

  it('knows an iPad that calls itself a Mac', () => {
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(true)
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(false)
  })

  it('says unsupported, not blocked, when a piece is missing', () => {
    expect(pushSupport({ ...CHROME, hasPushManager: false })).toBe('unsupported')
    expect(pushSupport({ ...CHROME, hasServiceWorker: false })).toBe('unsupported')
    expect(pushSupport({ ...CHROME, hasNotification: false, permission: null })).toBe('unsupported')
  })
})

describe('keys, watched events and the badge', () => {
  it('turns the server key into bytes and back', () => {
    const key = 'BP4zFq-_xK1Q'
    expect(bytesToKey(keyToBytes(key).buffer)).toBe(key)
    expect(keyToBytes('AAECAw').length).toBe(4)
    expect(bytesToKey(null)).toBe('')
  })

  it('keeps only clean, unique event ids and no more than the server keeps', () => {
    expect(cleanWatch(['bingo', 'bingo', 'bad id', '', 'trivia_2'])).toEqual(['bingo', 'trivia_2'])
    expect(cleanWatch(Array.from({ length: 40 }, (_, i) => `e${i}`))).toHaveLength(20)
  })

  it('shows no badge at zero and never more than 99', () => {
    expect([badgeCount(0), badgeCount(-3), badgeCount(Number.NaN), badgeCount(4.9), badgeCount(500)]).toEqual([0, 0, 0, 4, 99])
  })

  it('checks with the server at most once a minute', () => {
    expect(shouldDispatch(null, 1000)).toBe(true)
    expect(shouldDispatch(1000, 30_000)).toBe(false)
    expect(shouldDispatch(1000, 61_000)).toBe(true)
  })
})

describe('the delivery log from untrusted data (N3.6)', () => {
  it('reads a held entry with its reason', () => {
    const e = normalizeLogEntry({ key: 'payment:dueSoon:2027-01-20', kind: 'payment', outcome: 'held', reason: 'quiet', critical: false, devices: 0, params: { date: '2027-01-20', x: { nested: 1 } }, at: 5, read: false })
    expect(e).toMatchObject({ outcome: 'held', reason: 'quiet', params: { date: '2027-01-20' } })
    expect(e?.params).not.toHaveProperty('x')
  })

  it('drops anything it does not recognise instead of showing it half-formed', () => {
    expect(normalizeLogEntry(null)).toBeNull()
    expect(normalizeLogEntry({ key: 'a', kind: 'mystery', outcome: 'sent' })).toBeNull()
    expect(normalizeLogEntry({ key: 'a', kind: 'payment', outcome: 'maybe' })).toBeNull()
    expect(normalizeLogEntry({ key: 'a', kind: 'payment', outcome: 'sent', reason: 'because' })?.reason).toBeNull()
  })
})

describe('the calendar address', () => {
  it('joins a relative or absolute API address with the path the server returned', () => {
    expect(feedUrl('/api/v1', 'https://app.example', '/calendar/abc.ics')).toBe('https://app.example/api/v1/calendar/abc.ics')
    expect(feedUrl('https://api.example/api/v1/', 'https://app.example', '/calendar/abc.ics')).toBe('https://api.example/api/v1/calendar/abc.ics')
  })

  it('offers the webcal form that calendar apps keep following', () => {
    expect(webcalUrl('https://api.example/x.ics')).toBe('webcal://api.example/x.ics')
  })
})
