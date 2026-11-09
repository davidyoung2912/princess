// proves: REM-10
import { describe, expect, it } from 'vitest'
import { daysToExpiry, walletTotals } from './wallet'

describe('credit wallet', () => {
  const credits = [
    { original: 150_000, remaining: 100_000, expired: false },
    { original: 20_000, remaining: 20_000, expired: true },
  ]
  it('splits what can be used from what has run out', () => {
    const t = walletTotals(credits, [{ amount: 50_000 }])
    expect([t.usable, t.lapsed, t.spent, t.redeemed]).toEqual([100_000, 20_000, 50_000, 50_000])
    expect(t.reconciles).toBe(true)
  })
  it('says so when the history does not add up to what was spent', () => {
    expect(walletTotals(credits, [{ amount: 40_000 }]).reconciles).toBe(false)
    expect(walletTotals(credits, []).reconciles).toBe(false)
  })
  it('counts days to the expiry date', () => {
    expect(daysToExpiry('2027-11-30', '2027-11-01')).toBe(29)
    expect(daysToExpiry('2027-11-01', '2027-11-02')).toBe(-1)
  })
})
