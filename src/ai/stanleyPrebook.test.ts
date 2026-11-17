import { describe, expect, it } from 'vitest'
import { normalizePrebook } from './stanleyPrebook'

const f = (id: string, route = '/plan/dining') => ({ id, rule: 'SR-4.5', title: 'T', detail: 'D', route })

describe('normalizePrebook', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizePrebook(null)).toBeNull()
    expect(normalizePrebook({ findings: [] })).toBeNull()
  })
  it('keeps the server order', () => {
    expect(normalizePrebook({ hasTrip: true, findings: [f('b'), f('a')] })!.findings.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('drops findings with an outside route or no title', () => {
    const r = normalizePrebook({ hasTrip: true, findings: [f('a', '//evil.example'), f('b', 'https://x'), { ...f('c'), title: '' }, f('d')] })!
    expect(r.findings.map((x) => x.id)).toEqual(['d'])
  })
})
