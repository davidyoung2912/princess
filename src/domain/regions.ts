import type { ConsentRegion } from './ahead'
import { COPPA_AGE } from './privacy'

/** Rights the privacy centre explains. Which apply depends on where the guest lives (SEC-04). */
export type RightId = 'access' | 'delete' | 'correct' | 'portability' | 'objectMarketing' | 'noSale' | 'withdraw'

export interface RegionRules {
  id: ConsentRegion
  /** Below this age a parent or guardian decides about marketing and analytics. Authored concept values (verify with counsel before real use). */
  consentAge: number
  rights: readonly RightId[]
}

export const REGION_RULES: readonly RegionRules[] = [
  { id: 'us', consentAge: COPPA_AGE, rights: ['access', 'delete', 'correct', 'noSale', 'objectMarketing'] },
  { id: 'ca', consentAge: COPPA_AGE, rights: ['access', 'correct', 'withdraw', 'objectMarketing'] },
  { id: 'uk', consentAge: 13, rights: ['access', 'delete', 'correct', 'portability', 'withdraw', 'objectMarketing'] },
  { id: 'eu', consentAge: 16, rights: ['access', 'delete', 'correct', 'portability', 'withdraw', 'objectMarketing'] },
  { id: 'au', consentAge: 15, rights: ['access', 'correct', 'objectMarketing'] },
]

export const regionRules = (region: ConsentRegion): RegionRules => REGION_RULES.find((r) => r.id === region) ?? REGION_RULES[0]

/** Whether a parent decides about marketing and analytics for someone of this age in this region, though they are over the under-13 line. */
export const parentDecidesIn = (region: ConsentRegion, age: number): boolean => age >= COPPA_AGE && age < regionRules(region).consentAge
