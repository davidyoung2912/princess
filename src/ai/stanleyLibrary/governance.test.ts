import { describe, expect, it } from 'vitest'
import { decideStanley } from '../stanleyDecide'
import { LIBRARY, PAGE_QA, questionOf } from '.'
import { HIGH_RISK_IDS, REVIEWED_ON, SHELF_MONTHS, isLive, libraryCoverage, liveLibrary, metaOf, mentionsRiskTopic, riskOf } from './governance'

describe('library governance', () => {
  it('gives every entry, general and page, an owner, review and expiry dates, a risk, a scope and a fallback (entries missing metadata = 0)', () => {
    const report = libraryCoverage(Date.now())
    expect(report.entries).toBe(LIBRARY.length + PAGE_QA.length)
    expect(report.missing).toEqual([])
    expect(report.byRisk.low + report.byRisk.medium + report.byRisk.high).toBe(report.entries)
    expect(report.byRisk.high).toBe(HIGH_RISK_IDS.size)
  })

  it('fails when an entry is past its expiry date, until it is reviewed and the date moved on', () => {
    const report = libraryCoverage(Date.now())
    expect(report.expired, `entries expired: review them and move REVIEWED_ON (now ${REVIEWED_ON}) forward`).toEqual([])
  })

  it('expires the sooner the riskier the entry is, and the whole of the expiry day still counts', () => {
    const high = LIBRARY.find((e) => e.id === 'port.tender')!
    const low = LIBRARY.find((e) => e.id === 'remember.photos')!
    expect(riskOf(high)).toBe('high')
    expect(riskOf(low)).toBe('low')
    expect(metaOf(high).expiresOn < metaOf(low).expiresOn).toBe(true)
    expect(SHELF_MONTHS.high).toBeLessThan(SHELF_MONTHS.medium)
    expect(SHELF_MONTHS.medium).toBeLessThan(SHELF_MONTHS.low)
    const day = Date.parse(`${metaOf(high).expiresOn}T12:00:00Z`)
    expect(isLive(high, day)).toBe(true)
    expect(isLive(high, day + 86_400_000)).toBe(false)
  })

  it('names only real entries as high risk, and sends every high-risk entry to a person when it cannot answer', () => {
    const ids = new Set(LIBRARY.map((e) => e.id))
    expect([...HIGH_RISK_IDS].filter((id) => !ids.has(id))).toEqual([])
    for (const e of LIBRARY.filter((x) => HIGH_RISK_IDS.has(x.id))) expect(metaOf(e).fallback, e.id).toBe('person')
  })

  it('treats page questions as low risk, owned by the product team', () => {
    for (const e of PAGE_QA) expect(metaOf(e), e.id).toMatchObject({ risk: 'low', owner: 'Product', scope: 'fleet' })
  })

  it('stops using an expired entry: the question goes to the server instead', () => {
    const e = LIBRARY.find((x) => x.id === 'manage.balanceDue')!
    const now = Date.parse('2026-11-10')
    const later = Date.parse('2032-01-01')
    expect(liveLibrary(now)).toHaveLength(LIBRARY.length)
    expect(liveLibrary(later)).toHaveLength(0)
    expect(decideStanley(questionOf(e), { stage: 'manage', hasBooking: true, now }).kind).toBe('library')
    expect(decideStanley(questionOf(e), { stage: 'manage', hasBooking: true, now: later }).kind).toBe('server')
  })
})

describe('risk topics', () => {
  it('recognises the topics a general written answer must not settle', () => {
    for (const t of ['Is today a tender port', 'what is my payment deadline', 'do I need a visa', 'is the tour wheelchair accessible', 'is it safe to swim']) expect(mentionsRiskTopic(t), t).toBe(true)
    for (const t of ['What is on today', 'Where should I eat first', 'tell me about the pool']) expect(mentionsRiskTopic(t), t).toBe(false)
  })

  it('keeps a question about now or about the guest\'s own booking off the written answers when it is on a risk topic', () => {
    const asked = (text: string) => decideStanley(text, { stage: 'port', hasBooking: true, now: Date.parse('2026-11-10') }).kind
    expect(asked('Is today a tender port')).toBe('server')
    expect(asked('Is the tender running late today')).toBe('server')
    expect(asked('What does tender mean')).toBe('library')
  })
})
