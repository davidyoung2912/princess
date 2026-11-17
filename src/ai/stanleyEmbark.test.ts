import { describe, expect, it } from 'vitest'
import { normalizeEmbark } from './stanleyEmbark'

const f = (id: string, route = '/plan/dining') => ({ id, rule: 'SR-6.1', title: 'T', detail: 'D', route })

describe('normalizeEmbark', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeEmbark(null)).toBeNull()
    expect(normalizeEmbark({ findings: [] })).toBeNull()
  })
  it('keeps the server order', () => {
    expect(normalizeEmbark({ hasTrip: true, findings: [f('b'), f('a')] })!.findings.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('drops findings with an outside route or no title', () => {
    const r = normalizeEmbark({ hasTrip: true, findings: [f('a', '//evil.example'), f('b', 'https://x'), { ...f('c'), title: '' }, f('d')] })!
    expect(r.findings.map((x) => x.id)).toEqual(['d'])
  })
})
