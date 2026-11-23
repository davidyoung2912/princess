import { describe, expect, it } from 'vitest'
import { normalizeNauticalPage } from './nauticalPage'

describe('nautical page feed', () => {
  it('ignores an answer that is not an object', () => {
    expect(normalizeNauticalPage(null)).toBeNull()
    expect(normalizeNauticalPage('x')).toBeNull()
  })

  it('ignores an answer with nothing usable in it', () => {
    expect(normalizeNauticalPage({ position: {}, sea: 1, nautical: null })).toBeNull()
  })
})
