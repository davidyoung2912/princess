import { describe, expect, it } from 'vitest'
import { FUTOSHIKI_LEVELS, allSigns, brokenSigns, candidatesOf, findMove, futoshikiConflicts, futoshikiDeadCells, generateFutoshiki, latinSquare, logicSolveFutoshiki, nextFutoshikiHint } from './futoshiki'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(FUTOSHIKI_LEVELS) as Difficulty[]

const isLatin = (g: readonly number[], n: number) => {
  for (let k = 0; k < n; k++) {
    const row = new Set(Array.from({ length: n }, (_, c) => g[k * n + c]))
    const col = new Set(Array.from({ length: n }, (_, r) => g[r * n + k]))
    if (row.size !== n || col.size !== n || row.has(0)) return false
  }
  return true
}

describe('Futoshiki', () => {
  it('builds Latin squares at every size', () => {
    for (let n = 4; n <= 7; n++) expect(isLatin(latinSquare(n, seeded(n)), n)).toBe(true)
  })

  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to the one answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateFutoshiki(level, seeded(seed * 17 + level.length))
        const { size, minGivens } = FUTOSHIKI_LEVELS[level]
        expect(p.size).toBe(size)
        expect(isLatin(p.solution, size)).toBe(true)
        expect(p.puzzle.every((v, i) => v === 0 || v === p.solution[i])).toBe(true)
        expect(p.puzzle.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(minGivens)
        expect(brokenSigns(p.solution, p.signs)).toEqual([])
        expect(logicSolveFutoshiki(p.puzzle, size, p.signs)).toEqual(p.solution)
        expect(futoshikiConflicts(p.puzzle, size, p.signs).size).toBe(0)
      }
    })
  }

  it('trims candidates with signs, including along a chain', () => {
    const n = 4
    // squares 0 < 1 < 2 < 3 along the top row: the chain forces 1, 2, 3, 4
    const signs = [{ lo: 0, hi: 1 }, { lo: 1, hi: 2 }, { lo: 2, hi: 3 }]
    const c = candidatesOf(Array(n * n).fill(0), n, signs)
    expect(c.slice(0, 4)).toEqual([0b0001, 0b0010, 0b0100, 0b1000])
    expect(candidatesOf(Array(n * n).fill(0), n, signs, false)[0]).toBe(0b1111)
  })

  it('names the sign that forces a digit', () => {
    const n = 4
    const grid = Array(n * n).fill(0)
    grid[1] = 3 // top row: _ 3 _ _ and the first square must be larger than the 3, so it can only be a 4
    const move = findMove(grid, n, [{ lo: 1, hi: 0 }])
    expect(move).toMatchObject({ index: 0, value: 4, technique: 'sign', sign: { other: 1, dir: 'right', smaller: false } })
  })

  it('marks repeats, broken signs and squares with no digit left', () => {
    const n = 4
    const g = Array(n * n).fill(0)
    g[0] = 3
    g[1] = 3
    expect([...futoshikiConflicts(g, n, [])].sort()).toEqual([0, 1])
    const h = Array(n * n).fill(0)
    h[0] = 2
    h[1] = 1
    expect([...futoshikiConflicts(h, n, [{ lo: 0, hi: 1 }])].sort()).toEqual([0, 1])
    const d = Array(n * n).fill(0)
    d[1] = 1; d[2] = 2; d[3] = 3; d[4] = 4
    expect(futoshikiDeadCells(d, n, []).has(0)).toBe(true)
  })

  it('hints name wrong entries first, then a logical move', () => {
    const p = generateFutoshiki('easy', seeded(8))
    const at = p.puzzle.indexOf(0)
    const bad = [...p.puzzle]
    bad[at] = (p.solution[at] % p.size) + 1
    expect(nextFutoshikiHint(bad, p.solution, p.size, p.signs)).toEqual({ kind: 'mistake', cells: [at] })
    const h = nextFutoshikiHint(p.puzzle, p.solution, p.size, p.signs)
    expect(h?.kind).toBe('move')
    if (h?.kind === 'move') expect(h.move.value).toBe(p.solution[h.move.index])
    expect(nextFutoshikiHint(p.solution, p.solution, p.size, p.signs)).toBeNull()
    expect(allSigns(p.solution, p.size).length).toBe(2 * p.size * (p.size - 1))
  })
})
