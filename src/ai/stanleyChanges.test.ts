import { describe, expect, it } from 'vitest'
import {
  DIGEST, cardFor, deliveryLevel, emptySession, loadSession, needsConfirm, normalizeCard, normalizeDelivery, normalizeExplanation, normalizeList, normalizeMissed, recordShown, safeRoute, saveSession, savedParam, shownElsewhere,
} from './stanleyChanges'

const option = (extra: Record<string, unknown> = {}) => ({ id: 'o', label: 'Do it', detail: 'Details', action: null, route: null, ...extra })
const raw = (extra: Record<string, unknown> = {}) => ({
  id: 'portCall:cozumel:3:skipped', fingerprint: 'abcd1234', kind: 'portCall', status: 'verified', source: 'Ship notice', sourceAt: 5, sourceAtText: '12:00 ship time', consequence: 'lostReservation', critical: true, day: 3,
  title: 'Cozumel has been skipped', what: 'What', why: 'Why', recommended: option({ route: '/home/disruption' }), others: [option({ id: 'person', label: 'Ask a person', route: '/me/cases' })],
  affects: [{ kind: 'tour', name: 'Reef snorkel by boat', day: 3, time: '08:30' }], ifNothing: 'Nothing', tip: false, where: ['home', 'port'], noticedAt: 9, ...extra,
})

describe('reading a change card', () => {
  it('reads a whole card', () => {
    const c = normalizeCard(raw())!
    expect(c.id).toBe('portCall:cozumel:3:skipped')
    expect(c.consequence).toBe('lostReservation')
    expect(c.affects[0]).toEqual({ kind: 'tour', name: 'Reef snorkel by boat', day: 3, time: '08:30' })
    expect(c.where).toEqual(['home', 'port'])
    expect(c.recommended.route).toBe('/home/disruption')
  })
  it('rejects a card without the agreed fields', () => {
    expect(normalizeCard(null)).toBeNull()
    expect(normalizeCard(raw({ kind: 'weird' }))).toBeNull()
    expect(normalizeCard(raw({ status: 'sure' }))).toBeNull()
    expect(normalizeCard(raw({ consequence: 'huge' }))).toBeNull()
    expect(normalizeCard(raw({ recommended: null }))).toBeNull()
    expect(normalizeCard(raw({ id: '' }))).toBeNull()
  })
  it('lets the consequence, not the card, decide whether it is an alert', () => {
    expect(normalizeCard(raw({ consequence: 'conflict', critical: true }))!.critical).toBe(false)
    expect(normalizeCard(raw({ consequence: 'safety', critical: false }))!.critical).toBe(true)
  })
  it('keeps a link only when it stays inside the app', () => {
    expect(safeRoute('/home/disruption')).toBe('/home/disruption')
    expect(safeRoute('https://evil.example/x')).toBeNull()
    expect(safeRoute('//evil.example')).toBeNull()
    expect(safeRoute('//evil')).toBeNull()
    expect(safeRoute('/a?b=1')).toBeNull()
    expect(safeRoute('javascript:alert(1)')).toBeNull()
    expect(normalizeCard(raw({ recommended: option({ route: 'https://evil.example' }) }))!.recommended.route).toBeNull()
  })
  it('knows an option does one thing: an action wins over a link', () => {
    const c = normalizeCard(raw({ recommended: option({ route: '/ship', action: { kind: 'plan_change', args: { op: 'drop', itemId: 'trivia', day: '2' } } }) }))!
    expect(c.recommended.action).toEqual({ kind: 'plan_change', args: { op: 'drop', itemId: 'trivia', day: '2' } })
    expect(c.recommended.route).toBeNull()
    expect(needsConfirm(c)).toBe(true)
    expect(needsConfirm(normalizeCard(raw())!)).toBe(false)
  })
  it('refuses any action that is not one of the confirmable kinds, and drops odd arguments', () => {
    expect(normalizeCard(raw({ recommended: option({ action: { kind: 'pay_balance', args: {} } }) }))!.recommended.action).toBeNull()
    expect(normalizeCard(raw({ recommended: option({ action: { kind: 'cancel_booking', args: {} } }) }))!.recommended.action).toBeNull()
    const c = normalizeCard(raw({ recommended: option({ action: { kind: 'remind_me', args: { at: '14:30', text: 'Back', 'bad key!': 'x', n: 5 } } }) }))!
    expect(c.recommended.action!.args).toEqual({ at: '14:30', text: 'Back' })
  })
  it('keeps what the guest holds that is touched, and at most eight others', () => {
    const many = Array.from({ length: 12 }, (_, i) => option({ id: `o${i}` }))
    expect(normalizeCard(raw({ others: many }))!.others).toHaveLength(8)
    expect(normalizeCard(raw({ affects: [{ kind: 'tour' }, { name: 'Dinner', day: 2, time: '19:00' }] }))!.affects).toHaveLength(1)
  })
})

describe('the lists', () => {
  it('reads a list, dropping bad cards and keeping the sources that could not be read', () => {
    const l = normalizeList({ asOf: 5, asOfText: '12:00 ship time', cards: [raw(), { nonsense: true }], unread: ['the flight status', 7] })!
    expect(l.cards).toHaveLength(1)
    expect(l.unread).toEqual(['the flight status'])
    expect(normalizeList({})).toBeNull()
  })
  it('reads what was missed, with a null since the first time', () => {
    expect(normalizeMissed({ since: null, cards: [], total: 0 })).toEqual({ since: null, cards: [], total: 0 })
    expect(normalizeMissed({ since: 10, cards: [raw()], total: 3 })!.total).toBe(3)
    expect(normalizeMissed(null)).toBeNull()
  })
  it('reads a delivery and never lets a critical card pose as the one suggestion', () => {
    const d = normalizeDelivery({ alerts: [raw(), raw({ id: 'x', consequence: 'conflict' })], suggestion: raw({ id: 's', consequence: 'safety' }), held: [{ id: 'a', reason: 'quiet' }, 4], digest: null })!
    expect(d.alerts.map((c) => c.id)).toEqual(['portCall:cozumel:3:skipped'])
    expect(d.suggestion).toBeNull()
    expect(d.held).toEqual([{ id: 'a', reason: 'quiet' }])
    const e = normalizeDelivery({ alerts: [], suggestion: raw({ id: 's', consequence: 'conflict', critical: false }), held: [], digest: { since: 1, cards: [raw({ consequence: 'conflict' })], total: 1 } })!
    expect(e.suggestion!.id).toBe('s')
    expect(e.digest!.cards).toHaveLength(1)
    expect(normalizeDelivery({})).toBeNull()
  })
  it('reads an explanation of the six questions', () => {
    const e = normalizeExplanation({ id: 'x', title: 'T', questions: ['what', 'sure', 'affects', 'recommend', 'others', 'nothing'].map((key) => ({ key, question: `${key}?`, answer: `${key}.` })) })!
    expect(e.questions).toHaveLength(6)
    expect(normalizeExplanation({ questions: [{ key: 'what', answer: '' }] })).toBeNull()
    expect(normalizeExplanation(null)).toBeNull()
  })
})

describe('the guest’s level', () => {
  it('maps the four Stanley levels to what is said unprompted', () => {
    expect(['off', 'asked', 'helpful', 'chatty'].map((l) => deliveryLevel(l as 'off'))).toEqual(['off', 'affects', 'suggest', 'guide'])
  })
})

describe('the session count', () => {
  it('sends only the elements on other screens, so the one here can be drawn again', () => {
    let s = recordShown(emptySession(), 'home', 'a')
    s = recordShown(s, 'ship', 'b')
    expect(shownElsewhere(s, 'home')).toEqual(['b'])
    expect(shownElsewhere(s, 'port').sort()).toEqual(['a', 'b'])
    expect(shownElsewhere(recordShown(s, 'ship', null), 'home')).toEqual([])
    expect(shownElsewhere(recordShown(emptySession(), 'home', DIGEST), 'ship')).toEqual([DIGEST])
  })
  it('survives a reload within the visit and shrugs off broken storage', () => {
    const store: Record<string, string> = {}
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }
    saveSession(storage, recordShown(emptySession(), 'home', 'portCall:cozumel:3:skipped'))
    expect(loadSession(storage).byScreen.home).toBe('portCall:cozumel:3:skipped')
    expect(loadSession({ getItem: () => 'not json' })).toEqual(emptySession())
    expect(loadSession({ getItem: () => JSON.stringify({ byScreen: { home: '<b>', nowhere: 'x', ship: 'ok' } }) }).byScreen).toEqual({ ship: 'ok' })
    expect(loadSession(null)).toEqual(emptySession())
    expect(() => saveSession({ setItem: () => { throw new Error('full') } }, emptySession())).not.toThrow()
  })
})

describe('the saved events sent with a request', () => {
  it('sends clean ids only, at most thirty, or nothing', () => {
    expect(savedParam([])).toBeUndefined()
    expect(savedParam(['stage-show', 'bad id', '<x>', 'trivia_2'])).toBe('stage-show,trivia_2')
    expect(savedParam(Array.from({ length: 40 }, (_, i) => `e${i}`))!.split(',')).toHaveLength(30)
  })
})

describe('the card a thread notice is about', () => {
  const list = normalizeList({ asOf: 1, asOfText: '12:00', cards: [raw(), raw({ id: 'dinner:2' })], unread: [] })
  it('finds it by the id the notice carries', () => {
    expect(cardFor(list, 'dinner:2')?.id).toBe('dinner:2')
  })
  it('is null when the card is gone, the notice names none or the list did not load', () => {
    expect(cardFor(list, 'gone')).toBeNull()
    expect(cardFor(list, undefined)).toBeNull()
    expect(cardFor(null, 'dinner:2')).toBeNull()
  })
})
