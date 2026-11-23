import { describe, expect, it } from 'vitest'
import { errorFor, referenceOf } from './http'

describe('error reference', () => {
  it('carries the server trace id for support, made safe to print', () => {
    const e = errorFor(409, { type: 'conflict', title: 'alreadyLinked', traceId: '0hn3k2/<b>abc:01' })
    expect(e.code).toBe('conflict')
    expect(e.message).toBe('alreadyLinked')
    expect(e.reference).toBe('0HN3K2BABC:01')
  })
  it('has none when the server gave none', () => {
    expect(errorFor(500, {}).reference).toBeUndefined()
    expect(errorFor(404, undefined).reference).toBeUndefined()
    expect(referenceOf(42)).toBeUndefined()
    expect(referenceOf('///')).toBeUndefined()
  })
  it('caps the length', () => { expect(referenceOf('a'.repeat(100))).toHaveLength(40) })
})
