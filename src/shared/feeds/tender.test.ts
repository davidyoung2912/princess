import { describe, expect, it } from 'vitest'
import { normalizeTender } from './tender'

const good = { source: 'sim', port: 'belize', date: '2027-03-23', band: 'mixed', percent: 12, youCan: ['early', 'plan', 'excursion'] }

describe('normalizeTender', () => {
  it('reads a good answer', () => {
    expect(normalizeTender(good)).toEqual({ port: 'belize', date: '2027-03-23', band: 'mixed', percent: 12, youCan: ['early', 'plan', 'excursion'] })
  })
  it('ignores anything unreadable', () => {
    expect(normalizeTender(null)).toBeNull()
    expect(normalizeTender({ ...good, band: 'stormy' })).toBeNull()
    expect(normalizeTender({ ...good, percent: 120 })).toBeNull()
    expect(normalizeTender({ ...good, date: 'soon' })).toBeNull()
    expect(normalizeTender({ ...good, youCan: ['swim'] })).toBeNull()
  })
})
