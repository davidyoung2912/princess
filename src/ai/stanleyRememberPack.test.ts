import { describe, expect, it } from 'vitest'
import { normalizeRemember } from './stanleyRememberPack'

const f = (id: string, route = '/plan/dining') => ({ id, rule: 'SR-11.1', title: 'T', detail: 'D', route })

describe('normalizeRemember', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeRemember(null)).toBeNull()
    expect(normalizeRemember({ findings: [] })).toBeNull()
  })
  it('keeps the server order', () => {
    expect(normalizeRemember({ hasTrip: true, findings: [f('b'), f('a')] })!.findings.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('drops findings with an outside route or no title', () => {
    const r = normalizeRemember({ hasTrip: true, findings: [f('a', '//evil.example'), f('b', 'https://x'), { ...f('c'), title: '' }, f('d')] })!
    expect(r.findings.map((x) => x.id)).toEqual(['d'])
  })
})
