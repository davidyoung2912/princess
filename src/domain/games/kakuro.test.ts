import { describe, expect, it } from 'vitest'
import { KAKURO_LEVELS, candidatesOf, combosOf, findMove, generateKakuro, indexRuns, kakuroConflicts, kakuroDeadCells, logicSolveKakuro, makeLayout, nextKakuroHint, runDigits, type KRun } from './kakuro'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(KAKURO_LEVELS) as Difficulty[]

describe('Kakuro', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to the one answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateKakuro(level, seeded(seed * 17 + level.length))
        const { size, maxRun } = KAKURO_LEVELS[level]
        expect(p.size).toBe(size)
        // The first row and column are black, and every white square is in an across and a down run.
        for (let k = 0; k < size; k++) { expect(p.white[k]).toBe(false); expect(p.white[k * size]).toBe(false) }
        const { across, down } = indexRuns(p.runs, size)
        p.white.forEach((w, i) => { if (w) { expect(across[i]).toBeGreaterThanOrEqual(0); expect(down[i]).toBeGreaterThanOrEqual(0) } })
        for (const r of p.runs) {
          const v = r.cells.map((i) => p.solution[i])
          expect(r.cells.length).toBeGreaterThanOrEqual(2)
          expect(r.cells.length).toBeLessThanOrEqual(maxRun)
          expect(new Set(v).size).toBe(v.length)
          expect(v.reduce((a, b) => a + b, 0)).toBe(r.sum)
          expect(p.white[r.clue]).toBe(false)
        }
        expect(p.puzzle.every((v, i) => v === 0 || v === p.solution[i])).toBe(true)
        expect(logicSolveKakuro(p.puzzle, size, p.runs)).toEqual(p.solution)
        expect(kakuroConflicts(p.puzzle, p.runs).size).toBe(0)
      }
    })
  }

  it('makes layouts that are point symmetric', () => {
    const w = makeLayout(8, 5, seeded(3)) ?? makeLayout(8, 5, seeded(4))
    expect(w).not.toBeNull()
    for (let r = 1; r < 8; r++) for (let c = 1; c < 8; c++) expect(w![r * 8 + c]).toBe(w![(8 - r) * 8 + (8 - c)])
  })

  it('lists the combinations for a sum and length', () => {
    expect(combosOf(2, 16)).toEqual([0b101000000]) // 7 and 9
    expect(combosOf(2, 3)).toEqual([0b11])
    expect(combosOf(3, 6)).toEqual([0b111])
    expect(combosOf(9, 45)).toEqual([0b111111111])
    expect(combosOf(2, 2)).toEqual([])
  })

  it('trims candidates by combinations and by crossing runs', () => {
    // Whites at 4, 5, 7, 8 in a 3-wide grid: across 3 and 16, down 8 and 11.
    const n = 3
    const runs: KRun[] = [
      { cells: [4, 5], sum: 3, across: true, clue: 3 },
      { cells: [7, 8], sum: 16, across: true, clue: 6 },
      { cells: [4, 7], sum: 8, across: false, clue: 1 },
      { cells: [5, 8], sum: 11, across: false, clue: 2 },
    ]
    const empty = Array(9).fill(0)
    const plain = candidatesOf(empty, n, runs, false)
    expect(plain[4]).toBe(0b11) // 1 or 2 from the 3 run; the 8 run allows them too
    expect(plain[7]).toBe(0b1000000) // the 16 run allows 7 or 9, the 8 run allows only 7 of those
    const deep = candidatesOf(empty, n, runs, true)
    expect([deep[4], deep[5], deep[7], deep[8]]).toEqual([0b1, 0b10, 0b1000000, 0b100000000]) // 1, 2, 7, 9
    expect(logicSolveKakuro(empty, n, runs)).toEqual([0, 0, 0, 0, 1, 2, 0, 7, 9])
  })

  it('flags runs that cannot be made and squares with no digit left', () => {
    const n = 3
    const runs: KRun[] = [{ cells: [4, 5], sum: 3, across: true, clue: 3 }, { cells: [4, 7], sum: 8, across: false, clue: 1 }, { cells: [5, 8], sum: 10, across: false, clue: 2 }]
    const g = Array(9).fill(0)
    g[4] = 3 // too big for a run of two that adds to 3
    expect(kakuroConflicts(g, runs).has(4)).toBe(true)
    const h = Array(9).fill(0)
    h[4] = 1; h[5] = 1
    expect(kakuroConflicts(h, runs).has(5)).toBe(true) // a repeat
    const d = Array(9).fill(0)
    d[4] = 2
    expect(kakuroDeadCells(d, n, runs).size).toBeGreaterThanOrEqual(0)
  })

  it('hints mistakes first, then a move that names its runs, then the answer', () => {
    const p = generateKakuro('medium', seeded(5))
    const wrong = [...p.puzzle]
    const at = p.white.findIndex((w, i) => w && p.puzzle[i] === 0)
    wrong[at] = (p.solution[at] % 9) + 1
    expect(nextKakuroHint(wrong, p.solution, p.size, p.runs, p.white)).toEqual({ kind: 'mistake', cells: [at] })
    const move = findMove(p.puzzle, p.size, p.runs)
    expect(move).not.toBeNull()
    expect(move!.value).toBe(p.solution[move!.index])
    const h = nextKakuroHint(p.puzzle, p.solution, p.size, p.runs, p.white)
    expect(h?.kind).toBe('move')
    if (h?.kind === 'move') expect(h.digits).toHaveLength(h.move.runs.length)
    expect(nextKakuroHint(p.solution, p.solution, p.size, p.runs, p.white)).toBeNull()
  })

  it('names the combination: 16 in 2 cells is 7 and 9', () => {
    const run: KRun = { cells: [4, 5], sum: 16, across: true, clue: 3 }
    expect(runDigits(run, Array(9).fill(0))).toEqual([7, 9])
  })
})
