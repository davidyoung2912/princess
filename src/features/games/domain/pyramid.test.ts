import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import { canDraw, canRemove, coveredBy, deal, draw, hint, isFree, isWon, placeOf, remove, rowOf, rowStart, type Pyramid } from './pyramid'

const c = (id: number, rank: number) => ({ id, suit: 0 as const, rank: rank as 1 })

describe('Pyramid', () => {
  it('lays out seven rows of 1 to 7 cards, each resting on two below', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(rowStart)).toEqual([0, 1, 3, 6, 10, 15, 21])
    expect([rowOf(0), rowOf(2), rowOf(27), placeOf(4)]).toEqual([0, 1, 6, 1])
    expect(coveredBy(0)).toEqual([1, 2])
    expect(coveredBy(4)).toEqual([7, 8])
    expect(coveredBy(24)).toEqual([])
    const g = deal('classic', seededRng(1))
    expect(g.tableau).toHaveLength(28)
    expect(g.stock).toHaveLength(24)
    expect(new Set([...g.tableau.map((x) => x!.id), ...g.stock.map((x) => x.id)]).size).toBe(52)
    expect(Array.from({ length: 28 }, (_, i) => isFree(g, i)).filter(Boolean)).toHaveLength(7)
  })

  it('removes a King alone and two free cards that add to 13, but not covered cards', () => {
    const g = deal('classic', seededRng(2))
    const t = g.tableau.slice()
    t[21] = c(100, 6); t[22] = c(101, 7); t[23] = c(102, 13); t[15] = c(103, 7)
    const p: Pyramid = { ...g, tableau: t, waste: [c(104, 6)] }
    expect(canRemove(p, [{ kind: 'pyramid', index: 23 }])).toBe(true)
    expect(canRemove(p, [{ kind: 'pyramid', index: 21 }, { kind: 'pyramid', index: 22 }])).toBe(true)
    expect(canRemove(p, [{ kind: 'waste' }, { kind: 'pyramid', index: 22 }])).toBe(true)
    expect(canRemove(p, [{ kind: 'pyramid', index: 15 }, { kind: 'waste' }])).toBe(false) // 15 is still covered
    expect(canRemove(p, [{ kind: 'pyramid', index: 21 }, { kind: 'pyramid', index: 21 }])).toBe(false)
    const m = remove(p, [{ kind: 'waste' }, { kind: 'pyramid', index: 22 }])
    expect(m.waste).toHaveLength(0)
    expect(m.tableau[22]).toBeNull()
    expect(m.removed).toBe(2)
  })

  it('draws one card at a time and limits the passes through the stock', () => {
    let g = deal('hard', seededRng(3))
    for (let i = 0; i < 24; i++) g = draw(g)
    expect([g.stock.length, g.waste.length]).toEqual([0, 24])
    expect(canDraw(g)).toBe(false)
    let e = deal('easy', seededRng(3))
    for (let i = 0; i < 24; i++) e = draw(e)
    expect(canDraw(e)).toBe(true)
    e = draw(e)
    expect([e.stock.length, e.pass]).toEqual([24, 2])
  })

  it('wins when the pyramid is clear, and hints are legal', () => {
    const g = deal('classic', seededRng(4))
    expect(isWon({ ...g, tableau: Array(28).fill(null) })).toBe(true)
    for (let s = 1; s <= 30; s++) {
      const d = deal('classic', seededRng(s))
      const h = hint(d)
      if (h) expect(canRemove(d, h)).toBe(true)
    }
  })
})
