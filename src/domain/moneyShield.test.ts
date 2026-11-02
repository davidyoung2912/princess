import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import type { FolioLine } from './folio'
import { CHARGE_CHECKS, canQuestion, drinkLimitPerDay, explainCharge, feeLedger, needsConfirm, renewalNotice, spendCoach, type ExplainId } from './moneyShield'
import { PLANS } from './wifi'

const line = (patch: Partial<FolioLine>): FolioLine => ({ id: 'x', day: 2, at: 1, category: 'shops', description: 'Item', guest: 'g', cents: 1000, ...patch })

describe('explain this charge (XT-02, S7-05)', () => {
  it('gives a plain reason for every kind of line', () => {
    expect(explainCharge(line({ category: 'credit', cents: -5000 })).id).toBe('credit')
    expect(explainCharge(line({ category: 'gratuities', cents: 1600 })).id).toBe('gratuity')
    expect(explainCharge(line({ category: 'gratuities', cents: 0, value: 1600, coveredBy: 'package' })).id).toBe('gratuityCovered')
    expect(explainCharge(line({ category: 'tips', description: 'Bar service charge (18%)' })).id).toBe('barService')
    expect(explainCharge(line({ category: 'dining', description: 'Cover charge, Crown Grill' })).id).toBe('cover')
    expect(explainCharge(line({ category: 'dining', description: 'Specialty dinner, Crown Grill', cents: 0, value: 0, coveredBy: 'package' })).id).toBe('dinnerCovered')
    expect(explainCharge(line({ category: 'drinks' })).id).toBe('drink')
    expect(explainCharge(line({ category: 'drinks', cents: 0, value: 1400, coveredBy: 'package' })).id).toBe('drinkCovered')
    expect(explainCharge(line({ category: 'internet', cents: 0, value: 1999, coveredBy: 'package' })).id).toBe('wifiCovered')
    expect(explainCharge(line({ category: 'spa' })).id).toBe('spa')
  })

  it('says how much of a drink the package paid when it is over the cap', () => {
    const e = explainCharge(line({ category: 'drinks', cents: 400, value: 1900, coveredBy: 'package' }))
    expect(e.id).toBe('drinkOverCap')
    expect(e.params.cap).toBe(15)
  })

  it('has words for every explanation', () => {
    const ids: ExplainId[] = ['credit', 'gratuity', 'gratuityCovered', 'barService', 'cover', 'dinnerCovered', 'drink', 'drinkCovered', 'drinkOverCap', 'wifi', 'wifiCovered', 'spa', 'shop', 'photo', 'laundry', 'excursion', 'dining', 'other']
    for (const id of ids) expect((en as Record<string, string>)[`explain.${id}`], id).toBeTruthy()
  })

  it('lets only an actual charge be questioned', () => {
    expect(canQuestion(line({ cents: 100 }))).toBe(true)
    expect(canQuestion(line({ cents: 0, coveredBy: 'package' }))).toBe(false)
    expect(canQuestion(line({ cents: -500, category: 'credit' }))).toBe(false)
  })
})

describe('where the money goes (XT-02)', () => {
  const lines = [
    line({ id: 'a', category: 'gratuities', cents: 1600 }),
    line({ id: 'b', category: 'gratuities', cents: 0, value: 1600, coveredBy: 'package' }),
    line({ id: 'c', category: 'tips', cents: 200 }),
    line({ id: 'd', category: 'dining', description: 'Cover charge, Crown Grill', cents: 400 }),
    line({ id: 'e', category: 'shops', cents: 1800 }),
    line({ id: 'f', category: 'credit', cents: -5000 }),
  ]

  it('splits charged money into fees and purchases, leaving out covered items and credits', () => {
    const { rows, total } = feeLedger(lines)
    expect(total).toBe(4000)
    expect(Object.fromEntries(rows.map((r) => [r.id, r.cents]))).toEqual({ gratuities: 1600, service: 200, cover: 400, purchases: 1800 })
    expect(rows.reduce((n, r) => n + r.cents, 0)).toBe(total)
  })

  it('is empty when nothing was charged', () => {
    expect(feeLedger([]).total).toBe(0)
    expect(feeLedger([]).rows.every((r) => r.percent === 0)).toBe(true)
  })
})

describe('check before a charge (XT-03)', () => {
  it('asks above the chosen amount only', () => {
    expect(needsConfirm(5001, 'over50')).toBe(true)
    expect(needsConfirm(5000, 'over50')).toBe(false)
    expect(needsConfirm(2501, 'over25')).toBe(true)
    expect(needsConfirm(10001, 'over100')).toBe(true)
    expect(needsConfirm(10000, 'over100')).toBe(false)
  })

  it('never asks when switched off, always asks when told to, and never for nothing', () => {
    expect(needsConfirm(999_999, 'never')).toBe(false)
    expect(needsConfirm(1, 'always')).toBe(true)
    for (const c of CHARGE_CHECKS) { expect(needsConfirm(0, c), c).toBe(false); expect(needsConfirm(-500, c), c).toBe(false) }
  })

  it('has words for every choice', () => {
    for (const c of CHARGE_CHECKS) expect((en as Record<string, string>)[`money.check.${c}`], c).toBeTruthy()
  })
})

describe('the pace coach (S6-06)', () => {
  const day = (d: number, cents: number) => line({ id: `s${d}`, day: d, cents })

  it('says nothing useful before the cruise begins', () => {
    expect(spendCoach([], 0, 100_000).pace).toBe('notYet')
  })

  it('forecasts in a straight line over seven nights', () => {
    const c = spendCoach([day(1, 10_000), day(2, 10_000)], 2, null)
    expect(c).toMatchObject({ spent: 20_000, perDay: 10_000, forecast: 70_000, pace: 'noBudget' })
  })

  it('compares the forecast with a budget: on track, close, above', () => {
    const lines = [day(1, 10_000), day(2, 10_000)]
    expect(spendCoach(lines, 2, 100_000).pace).toBe('onTrack')
    expect(spendCoach(lines, 2, 72_000).pace).toBe('close')
    expect(spendCoach(lines, 2, 60_000).pace).toBe('above')
  })

  it('does not count what a package covered, and reports its value', () => {
    const lines = [day(1, 5_000), line({ id: 'cov', day: 1, category: 'drinks', cents: 0, value: 1400, coveredBy: 'package' })]
    const c = spendCoach(lines, 1, null)
    expect(c.spent).toBe(5_000)
    expect(c.covered).toBe(1_400)
    expect(c.drinksToday).toBe(1)
  })

  it('counts a drinks package limit only where there is one', () => {
    expect(drinkLimitPerDay(15)).toBe(15)
    expect(drinkLimitPerDay(20)).toBeNull()
    expect(drinkLimitPerDay(0)).toBeNull()
  })

  it('is worded without blame', () => {
    const banned = /\b(overspen|too much|careless|wasteful|you should have|blow|splurg|reckless)/i
    for (const k of Object.keys(en).filter((x) => x.startsWith('coach.'))) expect((en as Record<string, string>)[k], k).not.toMatch(banned)
  })
})

describe('nothing renews by itself (XT-06)', () => {
  it('gives no notice for an ordinary item', () => {
    expect(renewalNotice({})).toBeNull()
  })

  it('refuses a renewing item with no date or amount', () => {
    expect(() => renewalNotice({ recurring: true })).toThrow()
    expect(renewalNotice({ recurring: true, nextChargeOn: '2027-04-01', cents: 999 })).toEqual({ date: '2027-04-01', cents: 999 })
  })

  it('has no renewing Wi-Fi plan', () => {
    for (const p of PLANS) expect((p as unknown as { recurring?: boolean }).recurring ?? false).toBe(false)
  })
})

describe('private gratuities (XT-04)', () => {
  it('says so, and never labels guests by tipping', () => {
    expect(en['money.gratPrivate']).toMatch(/private/i)
    expect(en['priv.tips.body']).toMatch(/never/i)
    const banned = /\b(non-?tipper|early tipper|tipped|didn.t tip|stingy|generous guests?|top tippers?)\b/i
    for (const [k, v] of Object.entries(en)) if (/grat|tip/i.test(k)) expect(v as string, k).not.toMatch(banned)
  })
})
