import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { STAGE_IDS } from './sailings'
import {
  EMPTY_OFFER_STATE, MARKETING_WEEKLY_CAP, OFFERS, countsAgainstCap, dismissOffer, dismissedFor, homeOffer, isOfferFree, marketingLeft, normalizeOfferState,
  offerStageOf, offersFor, restoreOffer, sendMarketing, type OfferContext,
} from './offers'

const before: OfferContext = { stage: 'before', tier: 'none', package: 'none', dismissed: [] }
const DAY = 24 * 3_600_000

describe('offers (UX-02, CNT-02)', () => {
  it('maps every stage to a part of the trip', () => {
    expect(offerStageOf('preCruise')).toBe('before')
    expect(offerStageOf('seaDay')).toBe('aboard')
    expect(offerStageOf('postCruise')).toBe('after')
    for (const s of STAGE_IDS) expect(['before', 'aboard', 'after']).toContain(offerStageOf(s))
  })

  it('offers by part of the trip and tier', () => {
    expect(offersFor(before).map((o) => o.id)).toContain('package')
    expect(offersFor({ ...before, stage: 'aboard' }).map((o) => o.id)).toContain('wifi')
    expect(offersFor({ ...before, stage: 'after', tier: 'none' }).map((o) => o.id)).toEqual(['rebook'])
    expect(offersFor({ ...before, stage: 'after', tier: 'elite' })).toEqual([])
  })

  it('stops offering a package to someone who has one', () => {
    expect(offersFor({ ...before, package: 'plus' }).map((o) => o.id)).not.toContain('package')
  })

  it('hides a dismissed offer and lets it come back', () => {
    const c = { ...before, dismissed: ['package'] }
    expect(offersFor(c).map((o) => o.id)).not.toContain('package')
    expect(dismissedFor(c).map((o) => o.id)).toEqual(['package'])
    const s = dismissOffer(EMPTY_OFFER_STATE, 'B1', 'package')
    expect(s.dismissed.B1).toEqual(['package'])
    expect(dismissOffer(s, 'B1', 'package').dismissed.B1).toEqual(['package'])
    expect(dismissOffer(s, 'B2', 'upgrade').dismissed.B1).toEqual(['package'])
    expect(restoreOffer(s, 'B1', 'package').dismissed.B1).toEqual([])
  })

  it('puts required tasks first: no home card while one waits, at embarkation or checkout, or after', () => {
    const ok = { ...before, stageId: 'preCruise' as const, taskWaiting: false }
    expect(homeOffer(ok)).not.toBeNull()
    expect(homeOffer({ ...ok, taskWaiting: true })).toBeNull()
    for (const stageId of ['embarkation', 'farewell', 'disembark'] as const) expect(homeOffer({ ...ok, stageId, stage: offerStageOf(stageId) })).toBeNull()
    expect(homeOffer({ ...ok, stage: 'after', stageId: 'postCruise' })).toBeNull()
  })

  it('gives at most one home card, and none when everything is dismissed', () => {
    const all = OFFERS.map((o) => o.id)
    expect(homeOffer({ ...before, stageId: 'preCruise', taskWaiting: false, dismissed: all })).toBeNull()
  })

  it('keeps offers off safety, emergency and checkout screens', () => {
    for (const p of ['/ship/muster', '/ship/emergency', '/home/disembark/customs', '/home/check-in/receipt', '/me/bill/final']) expect(isOfferFree(p), p).toBe(true)
    expect(isOfferFree('/plan/upgrades')).toBe(false)
    expect(OFFERS.every((o) => !isOfferFree(o.to))).toBe(true)
  })

  it('has words for every offer, with no countdowns or scarcity', () => {
    const banned = /\b(hurry|last chance|running out|selling fast|only \d|left at this price|ends (today|soon|tonight)|expires?|limited time|don.t miss|act now)\b/i
    for (const o of OFFERS) {
      for (const k of ['title', 'body'] as const) {
        const text = (en as Record<string, string>)[`offer.${o.id}.${k}`]
        expect(text, `${o.id}.${k}`).toBeTruthy()
        expect(text).not.toMatch(banned)
      }
    }
    expect(en['offer.restraint']).toBeTruthy()
  })
})

describe('offer state and the weekly cap (NOT-04)', () => {
  it('reads stored state safely', () => {
    expect(normalizeOfferState(null)).toEqual(EMPTY_OFFER_STATE)
    expect(normalizeOfferState('x')).toEqual(EMPTY_OFFER_STATE)
    const s = normalizeOfferState({ dismissed: { B1: ['package', 'nonsense', 4, 'package'], B2: 'x' }, sent: [5, 'a', 1, NaN] })
    expect(s.dismissed).toEqual({ B1: ['package'] })
    expect(s.sent).toEqual([1, 5])
  })

  it('allows two marketing messages a week and then holds the rest', () => {
    expect(MARKETING_WEEKLY_CAP).toBe(2)
    const t0 = 100 * DAY
    let s = EMPTY_OFFER_STATE
    const first = sendMarketing(s, t0); expect(first.allowed).toBe(true); s = first.state
    const second = sendMarketing(s, t0 + DAY); expect(second.allowed).toBe(true); s = second.state
    expect(marketingLeft(s, t0 + 2 * DAY)).toBe(0)
    const third = sendMarketing(s, t0 + 2 * DAY); expect(third.allowed).toBe(false); expect(third.state.sent).toHaveLength(2)
  })

  it('frees a place once the oldest message is a week old', () => {
    const t0 = 100 * DAY
    const s = { dismissed: {}, sent: [t0, t0 + DAY] }
    expect(marketingLeft(s, t0 + 6 * DAY)).toBe(0)
    expect(marketingLeft(s, t0 + 7 * DAY + 1)).toBe(1)
    expect(sendMarketing(s, t0 + 7 * DAY + 1).allowed).toBe(true)
  })

  it('counts only marketing against the cap', () => {
    expect(countsAgainstCap('offers')).toBe(true)
    for (const c of ['critical', 'payments', 'documents', 'checkin'] as const) expect(countsAgainstCap(c)).toBe(false)
  })
})
