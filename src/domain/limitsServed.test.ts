import { afterEach, describe, expect, it } from 'vitest'
import { applyLimits, normalizeLimits } from './limitsServed'
import { limitNames } from './limits'
import { MAX_OPEN_REQUESTS, QUIET_FROM } from './services'
import { REDOWNLOAD_DAYS } from './photos'
import { SERVICE_RATE } from './orders'

describe('normalizeLimits', () => {
  it('reads numbers and strings', () => {
    expect(normalizeLimits({ version: 'a', values: { MAX_OPEN_REQUESTS: 4, QUIET_FROM: '22:00' } })).toEqual({ version: 'a', values: { MAX_OPEN_REQUESTS: 4, QUIET_FROM: '22:00' } })
  })

  it.each([
    ['not an object', () => 1],
    ['a boolean value', () => ({ version: 'a', values: { MAX_OPEN_REQUESTS: true } })],
    ['a non-finite number', () => ({ version: 'a', values: { MAX_OPEN_REQUESTS: null } })],
    ['a lower-case name', () => ({ version: 'a', values: { maxOpen: 3 } })],
    ['no version', () => ({ values: {} })],
  ])('rejects %s', (_n, make) => {
    expect(normalizeLimits(make())).toBeNull()
  })
})

describe('applyLimits', () => {
  const saved = { MAX_OPEN_REQUESTS, QUIET_FROM, REDOWNLOAD_DAYS, SERVICE_RATE }
  afterEach(() => applyLimits({ version: 'back', values: saved }))

  it('registers the limits the server serves, so a missing registration is noticed', () => {
    expect(limitNames().length).toBeGreaterThanOrEqual(64)
    expect(limitNames()).toContain('DELIVERY_FEE')
  })

  it('changes a limit in place for every importer', () => {
    applyLimits({ version: 'b', values: { MAX_OPEN_REQUESTS: 3, QUIET_FROM: '22:30', REDOWNLOAD_DAYS: 30, SERVICE_RATE: 0.2 } })
    expect(MAX_OPEN_REQUESTS).toBe(3)
    expect(QUIET_FROM).toBe('22:30')
    expect(REDOWNLOAD_DAYS).toBe(30)
    expect(SERVICE_RATE).toBe(0.2)
  })

  it('skips a value of the wrong kind and a name nobody registered', () => {
    applyLimits({ version: 'c', values: { MAX_OPEN_REQUESTS: 'many', NOT_A_LIMIT: 9 } })
    expect(MAX_OPEN_REQUESTS).toBe(saved.MAX_OPEN_REQUESTS)
  })
})
