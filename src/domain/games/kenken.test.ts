import { describe, expect, it } from 'vitest'
import { KENKEN_LEVELS, brokenCages, cageHolds, cageLabel, candidatesOf, findMove, generateKenKen, kenkenConflicts, kenkenDeadCells, logicSolveKenKen, nextKenKenHint, type KCage } from './kenken'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(KENKEN_LEVELS) as Difficulty[]

const isLatin = (g: readonly number[], n: number) => {
  for (let k = 0; k < n; k++) {
    const row = new Set(Array.from({ length: n }, (_, c) => g[k * n + c]))
    const col = new Set(Array.from({ length: n }, (_, r) => g[r * n + k]))
    if (row.size !== n || col.size !== n || row.has(0)) return false
  }
  return true
}

describe('KenKen', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to the one answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateKenKen(level, seeded(seed * 31 + level.length))
        const { size, maxCage } = KENKEN_LEVELS[level]
        expect(p.size).toBe(size)
        expect(isLatin(p.solution, size)).toBe(true)
        expect(p.puzzle.every((v, i) => v === 0 || v === p.solution[i])).toBe(true)
        // Every cell is in exactly one cage, cages are small, and each is made by the solution.
        const seen = p.cages.flatMap((c) => [...c.cells]).sort((a, b) => a - b)
        expect(seen).toEqual(Array.from({ length: size * size }, (_, i) => i))
        for (const c of p.cages) {
          expect(c.cells.length).toBeLessThanOrEqual(maxCage)
          expect(cageHolds(c, c.cells.map((i) => p.solution[i]))).toBe(true)
          if (c.op === 'sub' || c.op === 'div') expect(c.cells).toHaveLength(2)
          if (c.cells.length === 1) expect(p.puzzle[c.cells[0]]).toBe(p.solution[c.cells[0]])
        }
        expect(logicSolveKenKen(p.puzzle, size, p.cages)).toEqual(p.solution)
        expect(kenkenConflicts(p.puzzle, size, p.cages).size).toBe(0)
      }
    })
  }

  it('checks each operation', () => {
    const cage = (op: KCage['op'], target: number): KCage => ({ cells: [0, 1], op, target })
    expect(cageHolds(cage('add', 7), [3, 4])).toBe(true)
    expect(cageHolds(cage('sub', 2), [5, 3])).toBe(true)
    expect(cageHolds(cage('sub', 2), [3, 5])).toBe(true)
    expect(cageHolds(cage('div', 3), [6, 2])).toBe(true)
    expect(cageHolds(cage('div', 3), [5, 2])).toBe(false)
    expect(cageHolds(cage('mul', 12), [3, 4])).toBe(true)
    expect(cageLabel(cage('div', 3))).toBe('3÷')
  })

  it('trims candidates with a cage', () => {
    const n = 4
    // A 2-cell "7+" cage in the top row can only hold 3 and 4.
    const cages: KCage[] = [{ cells: [0, 1], op: 'add', target: 7 }]
    const cand = candidatesOf(Array(16).fill(0), n, cages)
    expect(cand[0]).toBe(0b1100)
    expect(cand[1]).toBe(0b1100)
    expect(cand[2]).toBe(0b1111)
  })

  it('flags repeats, broken cages and dead squares', () => {
    const n = 4
    const cages: KCage[] = [{ cells: [0, 1], op: 'add', target: 3 }, { cells: [2, 3], op: 'mul', target: 12 }]
    const g = Array(16).fill(0)
    g[0] = 1; g[2] = 1
    expect(kenkenConflicts(g, n, cages).has(0)).toBe(true) // 1 and 1 in a row
    const h = Array(16).fill(0)
    h[0] = 3
    expect(brokenCages(h, cages)).toHaveLength(1) // 3 already reaches the sum of 3 with a cell to go
    const d = Array(16).fill(0)
    d[4] = 1; d[8] = 2
    expect(kenkenDeadCells(d, n, [{ cells: [0, 12], op: 'add', target: 2 }]).size).toBeGreaterThan(0)
  })

  it('hints mistakes first, then a move that names its cage, then the answer', () => {
    const p = generateKenKen('medium', seeded(5))
    const wrong = [...p.puzzle]
    const at = wrong.indexOf(0)
    wrong[at] = (p.solution[at] % p.size) + 1
    expect(nextKenKenHint(wrong, p.solution, p.size, p.cages)).toEqual({ kind: 'mistake', cells: [at] })
    const move = findMove(p.puzzle, p.size, p.cages)
    expect(move).not.toBeNull()
    expect(move!.value).toBe(p.solution[move!.index])
    const h = nextKenKenHint(p.puzzle, p.solution, p.size, p.cages)
    expect(h?.kind).toBe('move')
    expect(nextKenKenHint(p.solution, p.solution, p.size, p.cages)).toBeNull()
  })
})
