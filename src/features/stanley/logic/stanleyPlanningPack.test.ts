import { describe, expect, it } from 'vitest'
import { normalizePlanning } from './stanleyPlanningPack'

const f = (id: string, route = '/plan/dining') => ({ id, rule: 'SR-1.3', title: 'T', detail: 'D', route })

describe('normalizePlanning', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizePlanning(null)).toBeNull()
    expect(normalizePlanning({ findings: [] })).toBeNull()
  })
  it('keeps the server order', () => {
    expect(normalizePlanning({ planning: true, findings: [f('b'), f('a')] })!.findings.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('drops findings with an outside route or no title', () => {
    const r = normalizePlanning({ planning: true, findings: [f('a', '//evil.example'), f('b', 'https://x'), { ...f('c'), title: '' }, f('d')] })!
    expect(r.findings.map((x) => x.id)).toEqual(['d'])
  })
})
