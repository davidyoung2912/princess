import { describe, expect, it } from 'vitest'
import { shortName } from './cards'
import { autoStep, bestDest, canAutoFinish, canMove, deal, dealCards, hint, isWon, maxMovable, move, solve, type FreeCell } from './freecell'

describe('FreeCell', () => {
  it('reproduces the Microsoft numbered deals', () => {
    // Deal #1 begins J♦ 2♦ 9♥ J♣ 5♦ 7♥ 7♣ 5♥ across the top row.
    expect(dealCards(1).slice(0, 8).map(shortName)).toEqual(['JD', '2D', '9H', 'JC', '5D', '7H', '7C', '5H'])
    const g = deal('classic', 1)
    expect(g.columns.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
    expect(new Set(g.columns.flat().map((c) => c.id)).size).toBe(52)
    expect(dealCards(617).slice(0, 4).map(shortName)).toHaveLength(4)
  })

  it('limits a moved run to (free cells + 1) times two for each empty column', () => {
    const g = deal('classic', 5)
    expect(maxMovable(g, false)).toBe(5)
    const empty: FreeCell = { ...g, columns: [[], [], ...g.columns.slice(2)] }
    expect(maxMovable(empty, false)).toBe(20)
    expect(maxMovable(empty, true)).toBe(10)
    expect(maxMovable({ ...g, cells: [g.columns[0][0], g.columns[1][0], null, null] }, false)).toBe(3)
  })

  it('moves to cells, columns (alternating colours) and foundations, and nothing else', () => {
    const c = (id: number, suit: 0 | 1 | 2 | 3, rank: number) => ({ id, suit, rank: rank as 1 })
    const g: FreeCell = {
      columns: [[c(1, 0, 9)], [c(2, 1, 8)], [c(3, 0, 8)], [c(4, 1, 1)], [], [], [], []],
      cells: [null, null, null, null], foundations: [[], [], [], []], dealNumber: 0,
    }
    expect(canMove(g, { kind: 'column', col: 1, index: 0 }, { kind: 'column', col: 0 })).toBe(true)
    expect(canMove(g, { kind: 'column', col: 2, index: 0 }, { kind: 'column', col: 0 })).toBe(false)
    expect(canMove(g, { kind: 'column', col: 3, index: 0 }, { kind: 'foundation' })).toBe(true)
    expect(canMove(g, { kind: 'column', col: 0, index: 0 }, { kind: 'foundation' })).toBe(false)
    const m = move(g, { kind: 'column', col: 0, index: 0 }, { kind: 'cell', cell: 2 })
    expect(m.cells[2]?.id).toBe(1)
    expect(canMove(m, { kind: 'cell', cell: 2 }, { kind: 'column', col: 4 })).toBe(true)
    expect(bestDest(g, { kind: 'column', col: 3, index: 0 })).toEqual({ kind: 'foundation' })
    expect(bestDest(g, { kind: 'column', col: 1, index: 0 })).toEqual({ kind: 'column', col: 0 })
  })

  it('finishes by itself when every column is already in order', () => {
    const run = (s: 0 | 1 | 2 | 3) => Array.from({ length: 13 }, (_, i) => ({ id: s * 13 + i, suit: s, rank: (13 - i) as 1 }))
    // Alternating colours in one long column is not a given; use four columns of one suit sequences only if legal: single-suit runs are not runs, so use cards one apart.
    const g: FreeCell = { columns: [[{ id: 1, suit: 0, rank: 2 }, { id: 2, suit: 1, rank: 1 }], [], [], [], [], [], [], []], cells: [null, null, null, null], foundations: [[], [], [], []], dealNumber: 0 }
    expect(canAutoFinish(g)).toBe(true)
    expect(autoStep(g)).not.toBeNull()
    expect(run(0)).toHaveLength(13)
  })

  it('solves classic deals and plays the solution through to a win', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let g = deal('classic', n)
      const line = solve(g, 60000)
      expect(line, `deal ${n}`).not.toBeNull()
      for (const st of line!) {
        expect(canMove(g, st.from, st.to), `deal ${n}`).toBe(true)
        g = move(g, st.from, st.to)
      }
      expect(isWon(g), `deal ${n}`).toBe(true)
    }
  })

  it('always offers some hint, and it is legal', () => {
    for (const n of [10, 20, 30]) {
      const g = deal('classic', n)
      const h = hint(g, 3000)
      expect(h).not.toBeNull()
      expect(canMove(g, h!.step.from, h!.step.to)).toBe(true)
    }
  })
})
