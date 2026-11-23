import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import { autoStep, bestDest, canAutoFinish, canMove, deal, drawFromStock, hint, isWon, move, type Klondike } from './klondike'

describe('Klondike', () => {
  it('deals 28 cards to seven columns (1 to 7, top one up) and leaves 24 in the stock', () => {
    const g = deal('draw1', seededRng(1))
    expect(g.columns.map((c) => c.down.length + c.up.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(g.columns.every((c) => c.up.length === 1)).toBe(true)
    expect(g.stock).toHaveLength(24)
    const all = [...g.stock, ...g.columns.flatMap((c) => [...c.down, ...c.up])]
    expect(new Set(all.map((c) => c.id)).size).toBe(52)
  })

  it('draws one or three and turns the waste over when the stock runs out', () => {
    let g = deal('draw3', seededRng(2))
    g = drawFromStock(g)
    expect([g.stock.length, g.waste.length]).toEqual([21, 3])
    for (let i = 0; i < 7; i++) g = drawFromStock(g)
    expect([g.stock.length, g.waste.length]).toEqual([0, 24])
    g = drawFromStock(g)
    expect([g.stock.length, g.waste.length, g.redeals]).toEqual([24, 0, 1])
    const one = drawFromStock(deal('draw1', seededRng(2)))
    expect(one.waste).toHaveLength(1)
  })

  it('only allows descending alternating colours on a column, Kings on empty columns, and suits up from the Ace', () => {
    const g = deal('draw1', seededRng(3))
    const c = (id: number, suit: 0 | 1 | 2 | 3, rank: number) => ({ id, suit, rank: rank as 1 })
    const custom: Klondike = {
      ...g, stock: [], waste: [c(90, 0, 6)],
      foundations: [[], [], [], []],
      columns: [{ down: [], up: [c(91, 1, 7)] }, { down: [], up: [] }, { down: [c(95, 0, 2)], up: [c(92, 3, 13)] }, ...g.columns.slice(3)],
    }
    expect(canMove(custom, { kind: 'waste' }, { kind: 'column', col: 0 })).toBe(true)
    expect(canMove({ ...custom, waste: [c(90, 1, 6)] }, { kind: 'waste' }, { kind: 'column', col: 0 })).toBe(false)
    expect(canMove(custom, { kind: 'column', col: 2, index: 0 }, { kind: 'column', col: 1 })).toBe(true)
    expect(canMove({ ...custom, waste: [c(90, 0, 5)] }, { kind: 'waste' }, { kind: 'column', col: 1 })).toBe(false)
    expect(canMove({ ...custom, waste: [c(90, 0, 1)] }, { kind: 'waste' }, { kind: 'foundation', pile: 0 })).toBe(true)
    expect(canMove({ ...custom, waste: [c(90, 0, 2)] }, { kind: 'waste' }, { kind: 'foundation', pile: 0 })).toBe(false)
    const moved = move(custom, { kind: 'column', col: 2, index: 0 }, { kind: 'column', col: 1 })
    expect(moved.columns[2].up.map((x) => x.id)).toEqual([95]) // the hidden 2 turned up
    expect(moved.columns[1].up.map((x) => x.id)).toEqual([92])
  })

  it('moves a run of cards together and turns up what it covered', () => {
    const g = deal('draw1', seededRng(4))
    const c = (id: number, suit: 0 | 1 | 2 | 3, rank: number) => ({ id, suit, rank: rank as 1 })
    const custom: Klondike = { ...g, columns: [{ down: [c(80, 0, 9)], up: [c(81, 0, 8), c(82, 1, 7), c(83, 3, 6)] }, { down: [], up: [c(84, 1, 9)] }, ...g.columns.slice(2)] }
    const m = move(custom, { kind: 'column', col: 0, index: 0 }, { kind: 'column', col: 1 })
    expect(m.columns[1].up.map((x) => x.id)).toEqual([84, 81, 82, 83])
    expect(m.columns[0].up.map((x) => x.id)).toEqual([80])
  })

  it('suggests a move, and a bestDest for a tapped Ace is the foundation', () => {
    for (let s = 1; s <= 20; s++) {
      const g = deal('draw1', seededRng(s))
      const h = hint(g)
      expect(h).not.toBeNull()
      if (h && h.to !== 'draw') expect(canMove(g, h.from, h.to)).toBe(true)
    }
    const g = deal('draw1', seededRng(5))
    const ace = { id: 1, suit: 2 as const, rank: 1 as const }
    const custom = { ...g, waste: [ace] }
    expect(bestDest(custom, { kind: 'waste' })).toEqual({ kind: 'foundation', pile: 0 })
  })

  it('finishes by itself once every card is face up, and a full set of foundations is a win', () => {
    const g = deal('draw1', seededRng(6))
    const full = (s: 0 | 1 | 2 | 3) => Array.from({ length: 13 }, (_, i) => ({ id: s * 13 + i, suit: s, rank: (i + 1) as 1 }))
    const nearly: Klondike = { ...g, stock: [], waste: [], foundations: [full(0), full(1), full(2), full(3).slice(0, 12)], columns: [{ down: [], up: [full(3)[12]] }, ...Array.from({ length: 6 }, () => ({ down: [], up: [] }))] }
    expect(canAutoFinish(nearly)).toBe(true)
    const step = autoStep(nearly)!
    const done = move(nearly, step.from, step.to)
    expect(isWon(done)).toBe(true)
  })
})
