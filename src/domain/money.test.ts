import { describe, expect, it } from 'vitest'
import { canResetPin, pinReset, PIN_DESK_MIN, PIN_RESET_VALID_MIN } from './pinReset'
import { inCurrencyAt, normalizeRates, rateAgeDays, RATE_DRIFT, ratesStale, RATES_STALE_DAYS, SAMPLE_TABLE, stubRates } from './rates'
import { canDeliver, canGift, deliveryOf, deliveryWindow, EMPTY_EXTRAS, giftProblem, normalizeExtras, pruneExtras, setDelivery, setGift, type Gift } from './shopExtras'
import { CURRENCIES } from './services'

const MIN = 60_000
const DAY = 86_400_000

describe('PIN reset (ACC-03)', () => {
  it('waits for the desk, is ready for a day, then lapses', () => {
    expect(pinReset(0, 0).stage).toBe('waiting')
    expect(pinReset(0, PIN_DESK_MIN * MIN - 1).stage).toBe('waiting')
    expect(pinReset(0, PIN_DESK_MIN * MIN).stage).toBe('ready')
    expect(pinReset(0, (PIN_DESK_MIN + PIN_RESET_VALID_MIN) * MIN - 1).stage).toBe('ready')
    expect(pinReset(0, (PIN_DESK_MIN + PIN_RESET_VALID_MIN) * MIN).stage).toBe('expired')
  })
  it('allows a new PIN only when ready', () => {
    expect(canResetPin(null, 0)).toBe(false)
    expect(canResetPin(undefined, 0)).toBe(false)
    expect(canResetPin(0, 10 * MIN)).toBe(false)
    expect(canResetPin(0, 40 * MIN)).toBe(true)
  })
})

describe('exchange rates (ACC-07)', () => {
  const now = Date.UTC(2026, 10, 1, 12)
  it('gives the same table for the same day and keeps dollars fixed', () => {
    expect(stubRates(now)).toEqual(stubRates(now + 3600_000))
    expect(stubRates(now).perUsd.USD).toBe(1)
    expect(stubRates(now).asOf).toBe('2026-11-01')
  })
  it('keeps every rate near its sample value', () => {
    for (const c of CURRENCIES) expect(Math.abs(stubRates(now).perUsd[c.code] / c.perUsd - 1)).toBeLessThanOrEqual(RATE_DRIFT + 0.001)
  })
  it('calls an old table out of date', () => {
    const t = stubRates(now)
    expect(ratesStale(t, now)).toBe(false)
    expect(ratesStale(t, now + (RATES_STALE_DAYS + 1) * DAY)).toBe(true)
    expect(rateAgeDays(t, now - DAY)).toBe(0)
    expect(rateAgeDays({ asOf: 'nonsense', perUsd: {} }, now)).toBe(Infinity)
  })
  it('reads a stored table safely', () => {
    expect(normalizeRates(null)).toBe(SAMPLE_TABLE)
    expect(normalizeRates({ asOf: 'x', perUsd: {} })).toBe(SAMPLE_TABLE)
    const fixed = normalizeRates({ asOf: '2026-11-01', perUsd: { EUR: -3, GBP: 0.8, USD: 5 } })
    expect(fixed.perUsd.EUR).toBe(0.92)
    expect(fixed.perUsd.GBP).toBe(0.8)
    expect(fixed.perUsd.USD).toBe(1)
  })
  it('formats with the table’s rate', () => {
    expect(inCurrencyAt(10_000, 'EUR', { asOf: '2026-11-01', perUsd: { EUR: 0.5 } })).toBe('€50.00')
    expect(inCurrencyAt(-1_000, 'GBP', SAMPLE_TABLE)).toBe('-£7.90')
    expect(inCurrencyAt(1_000, 'XXX', SAMPLE_TABLE)).toBe('$10.00')
  })
})

describe('cabin delivery and gifting (SHP-05, POS-13)', () => {
  const gift: Gift = { to: 'Maria', how: 'email', where: 'maria@example.com', message: 'Enjoy!' }
  it('delivers goods and cabin gifts, never gift cards or bookings', () => {
    expect(canDeliver('shop-hat')).toBe(true)
    expect(canDeliver('gift-flowers')).toBe(true)
    expect(canDeliver('gift-50')).toBe(false)
    expect(canDeliver('spa-swedish')).toBe(false)
    expect(canDeliver('nope')).toBe(false)
  })
  it('lets only gift cards be given', () => {
    expect(canGift('gift-25')).toBe(true)
    expect(canGift('shop-hat')).toBe(false)
  })
  it('checks a gift', () => {
    expect(giftProblem(gift)).toBeNull()
    expect(giftProblem({ ...gift, to: ' ' })).toBe('noName')
    expect(giftProblem({ ...gift, to: 'M' })).toBe('badName')
    expect(giftProblem({ ...gift, where: 'maria@' })).toBe('badEmail')
    expect(giftProblem({ ...gift, how: 'cabin', where: '12' })).toBe('badCabin')
    expect(giftProblem({ ...gift, how: 'cabin', where: '9042' })).toBeNull()
    expect(giftProblem({ ...gift, message: 'x'.repeat(141) })).toBe('longMessage')
  })
  it('keeps and forgets choices per line', () => {
    let e = setDelivery(EMPTY_EXTRAS, 'a', 'cabin')
    e = setGift(e, 'b', gift)
    expect(deliveryOf(e, 'a')).toBe('cabin')
    expect(deliveryOf(e, 'z')).toBe('pickup')
    expect(setDelivery(e, 'a', 'pickup').delivery).toEqual({})
    expect(pruneExtras(e, ['b'])).toEqual({ delivery: {}, gifts: { b: gift } })
    expect(setGift(e, 'b', null).gifts).toEqual({})
  })
  it('drops broken stored choices', () => {
    expect(normalizeExtras('x')).toBe(EMPTY_EXTRAS)
    const e = normalizeExtras({ delivery: { a: 'cabin', b: 'pickup' }, gifts: { ok: gift, bad: { to: '', how: 'email', where: '', message: '' }, odd: 3 } })
    expect(e.delivery).toEqual({ a: 'cabin' })
    expect(Object.keys(e.gifts)).toEqual(['ok'])
  })
  it('says when goods arrive', () => {
    expect(deliveryWindow(9)).toBe('today')
    expect(deliveryWindow(16)).toBe('tomorrow')
  })
})
