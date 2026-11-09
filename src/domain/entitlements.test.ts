import { describe, expect, it } from 'vitest'
import { entitlementGroup } from './entitlements'

describe('usage window (PRE-15)', () => {
  it('keeps expired entitlements as history instead of dropping them', () => {
    expect(entitlementGroup({ from: '2027-03-01', until: '2027-03-08', status: 'expired' })).toBe('history')
    expect(entitlementGroup({ from: '2027-03-01', until: '2027-03-08', status: 'active' })).toBe('included')
    expect(entitlementGroup({ from: '2027-03-01', until: '2027-03-08', status: 'notStarted' })).toBe('included')
  })
})
