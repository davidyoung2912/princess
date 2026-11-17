import { describe, expect, it } from 'vitest'
import { normalizeTripSoFar } from './stanleyTripSoFar'

const s = (id: string, route = '/me/stanley-can', direction = 'more') => ({ id, direction, text: 'T', route })

describe('normalizeTripSoFar', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeTripSoFar(null)).toBeNull()
    expect(normalizeTripSoFar({ done: 1 })).toBeNull()
  })
  it('keeps counts as safe whole numbers', () => {
    const r = normalizeTripSoFar({ enabled: true, done: 2.9, confirmed: -4, undone: 'x', suggestions: [], notMeasured: [] })!
    expect([r.done, r.confirmed, r.undone]).toEqual([2, 0, 0])
  })
  it('drops suggestions with an unknown direction or an outside route', () => {
    const r = normalizeTripSoFar({ enabled: true, suggestions: [s('a', '/me/stanley-can', 'auto'), s('b', '//evil.example'), s('c', 'https://x'), s('d')] })!
    expect(r.suggestions.map((x) => x.id)).toEqual(['d'])
  })
})
