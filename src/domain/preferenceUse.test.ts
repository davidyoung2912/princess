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
      { group: 'dietary', count: 2, uses: ['dining'], sensitive: true },
      { group: 'needs', count: 1, uses: ['excursions', 'checklist'], sensitive: true },
    ])
  })
  it('treats bedding and requests as sensitive only for a child', () => {
    const p = { ...base, dietary: [], needs: [], bedding: 'twin' as const, specialRequests: 'Birthday' }
    expect(preferenceUse(p, false).every((x) => !x.sensitive)).toBe(true)
    expect(preferenceUse(p, true).every((x) => x.sensitive)).toBe(true)
  })
})
