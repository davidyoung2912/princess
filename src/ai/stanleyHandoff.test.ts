import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { en } from '../i18n/locales/en'
import { CREW_CARDS, CREW_DETAIL_MAX, crewCard } from '../domain/crewCards'
import { CASE_TOPICS, caseProblemOf, caseState, normalizeCase, normalizeCases, topicForHandoff, topicFromWords, type StanleyCase } from './stanleyHandoff'

const raw = { id: 'abc', topic: 'cabin', reference: 'GS-K4M7QX', owner: 'Housekeeping and Guest Services', status: 'submitted', openedAt: 1_000, nextUpdateAt: 2_000, overdue: false, escalated: false, issue: 'No air conditioning', outcome: '' }

describe('the case the server opens', () => {
  it('is read only with a reference, a known topic and a status', () => {
    expect(normalizeCase(raw)?.reference).toBe('GS-K4M7QX')
    expect(normalizeCase({ ...raw, reference: '' })).toBeNull()
    expect(normalizeCase({ ...raw, reference: 'ABC' })).toBeNull()
    expect(normalizeCase({ ...raw, topic: 'emergency' })).toBeNull()
    expect(normalizeCase({ ...raw, status: 'solved' })).toBeNull()
    expect(normalizeCase({ ...raw, openedAt: 'x' })).toBeNull()
    expect(normalizeCase(null)).toBeNull()
    expect(normalizeCases([raw, { nope: 1 }])).toHaveLength(1)
    expect(normalizeCases('x')).toEqual([])
  })
  it('has a topic for every wording and none for an emergency', () => {
    expect(topicForHandoff('emergency')).toBeNull()
    expect(topicForHandoff('medical')).toBe('person')
    expect(topicForHandoff('person')).toBe('person')
    for (const k of CASE_TOPICS) expect(en[`handoff.topic.${k}` as keyof typeof en]).toBeTruthy()
  })
  it('guesses the topic from the guest’s words and falls back to a person', () => {
    expect(topicFromWords('I have missed the ship')).toBe('missedShip')
    expect(topicFromWords('I have a gluten allergy')).toBe('allergy')
    expect(topicFromWords('I lost my wallet')).toBe('lostProperty')
    expect(topicFromWords('I was double charged on my bill')).toBe('billing')
    expect(topicFromWords('the air conditioning is broken')).toBe('cabin')
    expect(topicFromWords('my flight was cancelled')).toBe('disruption')
    expect(topicFromWords('hello')).toBe('person')
  })
  it('names why a send failed', () => {
    expect(caseProblemOf(new ApiError('conflict', 'off'))).toBe('off')
    expect(caseProblemOf(new ApiError('conflict', 'tooManyCases'))).toBe('tooMany')
    expect(caseProblemOf(new ApiError('forbidden'))).toBe('forbidden')
    expect(caseProblemOf(new ApiError('invalid', 'consent'))).toBe('invalid')
    expect(caseProblemOf(new ApiError('network'))).toBe('other')
    expect(caseProblemOf(null)).toBe('other')
  })
})

describe('what a case says', () => {
  const base = normalizeCase(raw) as StanleyCase
  it('waits quietly while the update is not yet due', () => {
    expect(caseState(base, 1_500)).toEqual({ key: 'submitted', callNow: false })
    expect(caseState({ ...base, status: 'acknowledged' }, 1_500)).toEqual({ key: 'acknowledged', callNow: false })
  })
  it('says overdue, then escalated, and offers the number to call', () => {
    expect(caseState({ ...base, status: 'acknowledged' }, 2_000)).toEqual({ key: 'overdue', callNow: true })
    expect(caseState({ ...base, status: 'acknowledged', overdue: true }, 1_500)).toEqual({ key: 'overdue', callNow: true })
    expect(caseState({ ...base, status: 'acknowledged', overdue: true, escalated: true }, 1_500)).toEqual({ key: 'escalated', callNow: true })
  })
  it('calls a case done only when the server did', () => {
    expect(caseState({ ...base, status: 'fulfilled' }, 99_999).key).toBe('fulfilled')
    expect(caseState({ ...base, status: 'acknowledged' }, 99_999).key).not.toBe('fulfilled')
  })
  it('has wording for every state and never claims a hand-over before a reference exists', () => {
    for (const k of ['submitted', 'acknowledged', 'fulfilled', 'overdue', 'escalated']) expect(en[`handoff.status.${k}` as keyof typeof en]).toBeTruthy()
    expect(en['handoff.notSent']).toMatch(/Nothing has reached Guest Services/)
    expect(en['handoff.sent']).toMatch(/\{reference\}/)
    const card = readFileSync('src/ui/ai/HandoffCard.tsx', 'utf8')
    // The success wording is shown only inside the branch that holds a case read from the server.
    expect(card).toMatch(/if \(made\) \{[\s\S]*handoff\.sent/)
    expect(card.match(/handoff\.sent/g)).toHaveLength(1)
    expect(card).toMatch(/normalizeCase\(r\)/)
    expect(card).toMatch(/disabled=\{send\.busy \|\| !agreed/)
    expect(card).toMatch(/consent: agreed/)
  })
})

describe('show this to crew cards', () => {
  it('has the four cards in plain English with a request each', () => {
    expect(CREW_CARDS).toEqual(['dietary', 'mobility', 'lostItem', 'lostPassport'])
    for (const k of CREW_CARDS) { const c = crewCard(k, ''); expect(c.headline.length).toBeGreaterThan(10); expect(c.ask.length).toBeGreaterThan(10); expect(c.detail).toBe('') }
  })
  it('shows what the guest typed on one line, trimmed and bounded', () => {
    expect(crewCard('dietary', '  peanuts\n and   shellfish ').detail).toBe('peanuts and shellfish')
    expect(crewCard('lostItem', 'x'.repeat(500)).detail).toHaveLength(CREW_DETAIL_MAX)
  })
  it('reads nothing from the guest’s records and sends nothing', () => {
    const text = readFileSync('src/ui/ai/CrewCards.tsx', 'utf8') + readFileSync('src/domain/crewCards.ts', 'utf8')
    expect(text).not.toMatch(/api\.|fetch\(|useMemory|runtime|localStorage|useEffect/)
  })
})
