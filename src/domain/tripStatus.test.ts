import { describe, expect, it } from 'vitest'
import { REFERENCE_SAILING } from './sailings'
import { tripStatus } from './tripStatus'

describe('tripStatus', () => {
  it('counts the days before and after the cruise', () => {
    expect(tripStatus(REFERENCE_SAILING, { kind: 'daysToDeparture', days: 12 }).count).toEqual({ kind: 'to', days: 12 })
    expect(tripStatus(REFERENCE_SAILING, { kind: 'daysSinceReturn', days: 3 }).count).toEqual({ kind: 'since', days: 3 })
  })
  it('says nothing without a trip', () => {
    expect(tripStatus(REFERENCE_SAILING, null)).toEqual({ day: null, where: null, count: null })
  })
  it('keeps the cruise day when the itinerary is not loaded', () => {
    expect(tripStatus(REFERENCE_SAILING, { kind: 'cruiseDay', day: 99, of: 99 })).toEqual({ day: 99, where: null, count: null })
  })
})
