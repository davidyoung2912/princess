import { describe, expect, it } from 'vitest'
import { CONSENT_REGIONS } from './ahead'
import { consentsFor } from './privacy'
import { parentDecidesIn, regionRules, REGION_RULES } from './regions'

describe('region rules (SEC-04)', () => {
  it('has rules for every region the guest can choose', () => {
    expect(REGION_RULES.map((r) => r.id).sort()).toEqual(CONSENT_REGIONS.map((r) => r.id).sort())
    for (const r of REGION_RULES) expect(r.rights).toContain('access')
  })

  it('lets a parent decide for teenagers where the age is higher than 13', () => {
    expect(regionRules('eu').consentAge).toBe(16)
    expect(parentDecidesIn('eu', 14)).toBe(true)
    expect(parentDecidesIn('eu', 16)).toBe(false)
    expect(parentDecidesIn('us', 14)).toBe(false)
    expect(parentDecidesIn('au', 14)).toBe(true)
    expect(parentDecidesIn('eu', 12)).toBe(false) // under 13 is already handled by the child rules
    expect(consentsFor(14).some((c) => c.id === 'marketingEmail')).toBe(true)
  })

  it('says the sale opt-out only where the law has one', () => {
    expect(regionRules('us').rights).toContain('noSale')
    expect(regionRules('eu').rights).not.toContain('noSale')
  })
})
