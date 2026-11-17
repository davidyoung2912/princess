import { describe, expect, it } from 'vitest'
import { normalizeFamily } from './stanleyFamily'

const f = (id: string, route = '/plan/dining') => ({ id, rule: 'SR-F.1', title: 'T', detail: 'D', route })

describe('normalizeFamily', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeFamily(null)).toBeNull()
    expect(normalizeFamily({ findings: [] })).toBeNull()
  })
  it('keeps the server order', () => {
    expect(normalizeFamily({ hasTrip: true, findings: [f('b'), f('a')] })!.findings.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('drops findings with an outside route or no title', () => {
    const r = normalizeFamily({ hasTrip: true, findings: [f('a', '//evil.example'), f('b', 'https://x'), { ...f('c'), title: '' }, f('d')] })!
    expect(r.findings.map((x) => x.id)).toEqual(['d'])
  })
})
