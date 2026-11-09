import { describe, expect, it } from 'vitest'
import { preferenceUse } from './preferenceUse'

const base = { dietary: [], needs: [], bedding: 'noPreference', specialRequests: '  ' } as const

describe('preferenceUse', () => {
  it('lists nothing when nothing is saved', () => {
    expect(preferenceUse({ ...base, dietary: [], needs: [] }, false)).toEqual([])
  })
  it('marks food and access needs as sensitive and says where they are used', () => {
    const l = preferenceUse({ ...base, dietary: ['vegan', 'halal'], needs: ['hearing'] }, false)
    expect(l).toEqual([
      { group: 'dietary', count: 2, uses: ['dining'], sensitive: true, keptOut: false },
      { group: 'needs', count: 1, uses: ['excursions', 'checklist'], sensitive: true, keptOut: false },
    ])
  })
  it('treats bedding and requests as sensitive only for a child', () => {
    const p = { ...base, dietary: [], needs: [], bedding: 'twin' as const, specialRequests: 'Birthday' }
    expect(preferenceUse(p, false).every((x) => !x.sensitive)).toBe(true)
    expect(preferenceUse(p, true).every((x) => x.sensitive)).toBe(true)
  })
})

import { canKeepOut, toggleKeepOut } from './preferenceUse'
describe('leaving a preference out of later bookings (MNG-16)', () => {
  it('flags the groups kept out, and only food and access can be', () => {
    const p = { ...base, dietary: ['vegan'], needs: ['hearing'], keepOut: ['dietary'] } as never
    const lines = preferenceUse(p, false)
    expect(lines.find((l) => l.group === 'dietary')?.keptOut).toBe(true)
    expect(lines.find((l) => l.group === 'needs')?.keptOut).toBe(false)
    expect(canKeepOut('dietary')).toBe(true)
    expect(canKeepOut('bedding')).toBe(false)
  })
  it('toggles a group in and out', () => {
    expect(toggleKeepOut(undefined, 'needs')).toEqual(['needs'])
    expect(toggleKeepOut(['needs', 'dietary'], 'needs')).toEqual(['dietary'])
  })
})
