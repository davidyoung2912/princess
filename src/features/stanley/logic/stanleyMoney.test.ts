import { describe, expect, it } from 'vitest'
import {
  BUDGET_MAX, budgetFromText, canQuestion, disputeReady, disputeRequest, entitlementRequest, normalizeBudget, normalizeEntitlement, normalizeFolio, normalizeLoyalty, normalizePace, normalizePackageValue,
  normalizeScenario, packageUseRequest, priceTextIsValid, scenarioRequest, usageCount, verdictTone, type FolioLineView,
} from './stanleyMoney'

const answer = (extra: Record<string, unknown> = {}) => ({ item: 'drink', traveller: 'Anna', verdict: 'partly', lines: ['Partly, for Anna.'], basis: 'Your booking', youPayCents: 472, ...extra })

describe('reading an entitlement answer', () => {
  it('reads the verdict, the lines and the exact figure the server gave', () => {
    const r = normalizeEntitlement({ asOf: 5, answers: [answer()], note: 'Princess’s terms are the last word.' })!
    expect(r.answers[0]).toEqual({ item: 'drink', traveller: 'Anna', verdict: 'partly', lines: ['Partly, for Anna.'], basis: 'Your booking', youPayCents: 472 })
    expect(r.note).toContain('last word')
  })
  it('drops an answer with an item or verdict it does not know, and anything that is not an answer', () => {
    expect(normalizeEntitlement({ answers: [answer({ item: 'yacht' }), answer({ verdict: 'maybe' }), answer()] })!.answers).toHaveLength(1)
    expect(normalizeEntitlement(null)).toBeNull()
    expect(normalizeEntitlement({ answers: 'x' })).toBeNull()
  })
  it('never invents a figure: a missing or odd youPayCents is null', () => {
    expect(normalizeEntitlement({ answers: [answer({ youPayCents: undefined })] })!.answers[0].youPayCents).toBeNull()
    expect(normalizeEntitlement({ answers: [answer({ youPayCents: '472' })] })!.answers[0].youPayCents).toBeNull()
    expect(normalizeEntitlement({ answers: [answer({ youPayCents: 0 })] })!.answers[0].youPayCents).toBe(0)
  })
})

describe('asking is this included', () => {
  it('sends the item, the traveller or everyone, and a drink price only for a drink', () => {
    expect(entitlementRequest('drink', 'anna-id', false, '19', true, 's1')).toEqual({ item: 'drink', sailingId: 's1', traveller: 'anna-id', alcohol: true, priceCents: 1900 })
    expect(entitlementRequest('wifi', 'anna-id', false, '19', true, 's1')).toEqual({ item: 'wifi', sailingId: 's1', traveller: 'anna-id' })
    expect(entitlementRequest('wifi', 'anna-id', true, '', false, 's1')).toEqual({ item: 'wifi', sailingId: 's1', everyone: true })
    expect(entitlementRequest('drink', '', false, '', false, 's1')).toEqual({ item: 'drink', sailingId: 's1', alcohol: false })
  })
  it('will not send a price that is not an amount or is out of range', () => {
    expect(entitlementRequest('drink', '', false, 'lots', true, 's1')).toBeNull()
    expect(entitlementRequest('drink', '', false, '0', true, 's1')).toBeNull()
    expect(entitlementRequest('drink', '', false, '5001', true, 's1')).toBeNull()
    expect(priceTextIsValid('')).toBe(true)
    expect(priceTextIsValid('$14.50')).toBe(true)
    expect(priceTextIsValid('x')).toBe(false)
  })
  it('colours a plain yes as good and anything that costs something as a warning', () => {
    expect(verdictTone('included')).toBe('good')
    expect(verdictTone('partly')).toBe('neutral')
    expect(verdictTone('notIncluded')).toBe('warn')
    expect(verdictTone('allUsed')).toBe('warn')
  })
})

describe('the spend scenario', () => {
  const raw = (extra: Record<string, unknown> = {}) => ({
    now: { packages: 10_000, tours: 20_000, dining: 5_000 }, adds: [{ kind: 'addOn', id: 'drinks', label: 'Drinks package', units: 14, unitCents: 5200, totalCents: 72_800, basis: 'The price now' }], addedCents: 72_800, newTotalCents: 107_800,
    budgetCents: 110_000, leftCents: 2_200, state: 'near', lines: ['With this: $1,078 for the family.'], notCounted: ['The fare and taxes'], illustrative: false, ...extra,
  })
  it('reads the figures as given and always marks it illustrative, whatever the server said', () => {
    const s = normalizeScenario(raw())!
    expect(s.newTotalCents).toBe(107_800)
    expect(s.leftCents).toBe(2_200)
    expect(s.illustrative).toBe(true)
    expect(s.adds[0].totalCents).toBe(72_800)
  })
  it('rejects a state it does not know or a missing sum', () => {
    expect(normalizeScenario(raw({ state: 'fine' }))).toBeNull()
    expect(normalizeScenario(raw({ now: null }))).toBeNull()
    expect(normalizeScenario(raw({ adds: 'x' }))).toBeNull()
  })
  it('sends one to five distinct picks and nothing for none', () => {
    expect(scenarioRequest([], 's1')).toBeNull()
    expect(scenarioRequest([{ kind: 'addOn', id: 'drinks' }, { kind: 'addOn', id: 'drinks' }, { kind: 'upgrade', id: 'premier' }], 's1')).toEqual({ sailingId: 's1', items: [{ kind: 'addOn', id: 'drinks' }, { kind: 'upgrade', id: 'premier' }] })
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ kind: 'addOn' as const, id }))
    expect((scenarioRequest(many, 's1')!.items as unknown[]).length).toBe(5)
  })
})

describe('the budget and the pace', () => {
  it('takes a budget only as a sensible amount', () => {
    expect(budgetFromText('2,500')).toBe(250_000)
    expect(budgetFromText('$1200.50')).toBe(120_050)
    expect(budgetFromText('')).toBeNull()
    expect(budgetFromText('0')).toBeNull()
    expect(budgetFromText('abc')).toBeNull()
    expect(budgetFromText(String(BUDGET_MAX / 100 + 1))).toBeNull()
    expect(normalizeBudget({ cents: 250_000 })).toBe(250_000)
    expect(normalizeBudget({ cents: null })).toBeNull()
    expect(normalizeBudget({ cents: -5 })).toBeNull()
    expect(normalizeBudget(null)).toBeNull()
  })
  it('reads a pace and keeps it illustrative', () => {
    const p = normalizePace({ state: 'over', budgetCents: 85_000, committedCents: 20_000, onboardCents: 30_000, pendingCents: 5_000, day: 3, nights: 7, projectedOnboardCents: 70_000, projectedTotalCents: 90_000, overCents: 5_000, lines: ['At this pace'], illustrative: false })!
    expect(p.projectedTotalCents).toBe(90_000)
    expect(p.overCents).toBe(5_000)
    expect(p.illustrative).toBe(true)
    expect(normalizePace({ state: 'wild' })).toBeNull()
    expect(normalizePace({ state: 'tooEarly' })!.projectedTotalCents).toBeNull()
  })
})

const line = (extra: Record<string, unknown> = {}) => ({ id: 'x-1', short: 'L-ab12cd34', day: 2, at: 5, description: 'Cocktail', guest: 'Anna', category: 'drinks', cents: 1400, state: 'posted', why: 'A charge you made.', caseReference: null, ...extra })
const folio = (extra: Record<string, unknown> = {}) => ({
  asOf: 9, final: false, throughDay: 4, postedCents: 1400, pendingCents: 600, creditsCents: 5000, coveredCents: 1900,
  groups: [
    { state: 'posted', heading: 'Posted', meaning: 'Final.', cents: 1400, count: 1, lines: [line()] },
    { state: 'pending', heading: 'Pending', meaning: 'Not final yet.', cents: 600, count: 1, lines: [line({ id: 'x-2', short: 'L-00000002', state: 'pending', cents: 600 })] },
  ],
  estimate: { cents: 2667, text: 'Still to come.', illustrative: true }, lines: ['Posted: $14.'], ...extra,
})

describe('reading the bill explanation', () => {
  it('keeps each state as its own group with its own total', () => {
    const f = normalizeFolio(folio())!
    expect(f.groups.map((g) => g.state)).toEqual(['posted', 'pending'])
    expect(f.postedCents).toBe(1400)
    expect(f.pendingCents).toBe(600)
    expect(f.estimate!.cents).toBe(2667)
    expect(f.groups[1].lines[0].state).toBe('pending')
  })
  it('keeps the estimate apart (null when the server gave none) and drops unknown states', () => {
    expect(normalizeFolio(folio({ estimate: null }))!.estimate).toBeNull()
    const f = normalizeFolio(folio({ groups: [{ state: 'settled', heading: 'x', meaning: 'x', cents: 1, count: 1, lines: [] }] }))!
    expect(f.groups).toHaveLength(0)
    expect(normalizeFolio({})).toBeNull()
    expect(normalizeFolio(null)).toBeNull()
  })
  it('drops a line with no id or an unknown state, and carries a case reference', () => {
    const f = normalizeFolio(folio({ groups: [{ state: 'disputed', heading: 'Questioned', meaning: 'm', cents: 1400, count: 3, lines: [line({ id: '' }), line({ state: 'weird' }), line({ state: 'disputed', caseReference: 'GS-ABC234' })] }] }))!
    expect(f.groups[0].lines).toHaveLength(1)
    expect(f.groups[0].lines[0].caseReference).toBe('GS-ABC234')
  })
})

describe('questioning a charge', () => {
  const l = (extra: Partial<FolioLineView> = {}): FolioLineView => ({ ...(normalizeFolio(folio())!.groups[0].lines[0]), ...extra })
  it('only a charge nobody has questioned can be questioned', () => {
    expect(canQuestion(l())).toBe(true)
    expect(canQuestion(l({ cents: -5000 }))).toBe(false)
    expect(canQuestion(l({ cents: 0 }))).toBe(false)
    expect(canQuestion(l({ caseReference: 'GS-ABC234' }))).toBe(false)
    expect(canQuestion(l({ state: 'refunded' }))).toBe(false)
  })
  it('needs the guest to agree, and keeps the note short', () => {
    expect(disputeReady({ consent: false, note: '' })).toBe(false)
    expect(disputeReady({ consent: true, note: 'x'.repeat(301) })).toBe(false)
    expect(disputeReady({ consent: true, note: '' })).toBe(true)
  })
  it('sends only the line id, the note and the consent: the amount and text are read from the account on the server', () => {
    expect(disputeRequest(l(), { consent: true, note: '  I did not order this ' }, 's1')).toEqual({ lineId: 'x-1', note: 'I did not order this', consent: true, sailingId: 's1' })
    expect(disputeRequest(l(), { consent: false, note: '' }, 's1')).toBeNull()
    expect(disputeRequest(l({ cents: -1 }), { consent: true, note: '' }, 's1')).toBeNull()
  })
})

describe('package value', () => {
  const raw = (extra: Record<string, unknown> = {}) => ({
    asOf: 3, rows: [{ id: 'drinks', name: 'Drinks package', people: 2, packageCents: 72_800, payAsYouGoCents: 72_688, differenceCents: -112, verdict: 'notWorth', basis: 'An average drink', lines: ['costs more'] }], lines: ['not a prediction'], illustrative: false, ...extra,
  })
  it('reads the rows and the verdict the server gave, and marks it illustrative', () => {
    const v = normalizePackageValue(raw())!
    expect(v.rows[0].differenceCents).toBe(-112)
    expect(v.rows[0].verdict).toBe('notWorth')
    expect(v.illustrative).toBe(true)
    expect(normalizePackageValue(raw({ rows: [{ id: 'x', verdict: 'great' }] }))!.rows).toHaveLength(0)
    expect(normalizePackageValue(null)).toBeNull()
  })
  it('only sends a use the guest typed, inside the limits', () => {
    expect(packageUseRequest('3', '7', '1', 's1')).toEqual({ drinksPerDay: 3, wifiDays: 7, specialtyDinners: 1, sailingId: 's1' })
    expect(packageUseRequest('', '7', '1', 's1')).toBeNull()
    expect(packageUseRequest('13', '7', '1', 's1')).toBeNull()
    expect(packageUseRequest('3', '31', '1', 's1')).toBeNull()
    expect(packageUseRequest('3', '7', '11', 's1')).toBeNull()
    expect(packageUseRequest('-1', '7', '1', 's1')).toBeNull()
    expect(packageUseRequest('1.5', '7', '1', 's1')).toBeNull()
    expect(usageCount(' 4 ', 12)).toBe(4)
    expect(usageCount('12', 12)).toBe(12)
    expect(usageCount('012', 12)).toBeNull()
  })
})

describe('Captain’s Circle', () => {
  const raw = (extra: Record<string, unknown> = {}) => ({
    asOf: 4, tier: 'ruby', days: 28, nextTier: 'platinum', daysToNext: 62, counted: false,
    credits: [{ source: 'Refund credit', remainingCents: 25_000, expiresOn: '2027-04-20', daysLeft: 30, expired: false, expiresSoon: true }], usableCreditCents: 25_000, perks: ['memberEvents'], lines: ['Your record shows 28 days.'], ...extra,
  })
  it('reads the record, the credits and when they expire', () => {
    const l = normalizeLoyalty(raw())!
    expect(l.tier).toBe('ruby')
    expect(l.daysToNext).toBe(62)
    expect(l.counted).toBe(false)
    expect(l.credits[0]).toEqual({ source: 'Refund credit', remainingCents: 25_000, expiresOn: '2027-04-20', daysLeft: 30, expired: false, expiresSoon: true })
    expect(l.usableCreditCents).toBe(25_000)
  })
  it('has no next level at the top and rejects a record with no tier', () => {
    expect(normalizeLoyalty(raw({ nextTier: null, daysToNext: null }))!.nextTier).toBeNull()
    expect(normalizeLoyalty(raw({ tier: '' }))).toBeNull()
    expect(normalizeLoyalty(null)).toBeNull()
  })
})
