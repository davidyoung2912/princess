import { describe, expect, it } from 'vitest'
import { CROSSED, EMPTY, FILLED, NONOGRAM_LEVELS, cluesOf, findNonogramMove, generateNonogram, isNonogramSolved, lineOptions, lineStatus, nextNonogramHint, runsOf, solveNonogram, wrongMarks } from './nonogram'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(NONOGRAM_LEVELS) as Difficulty[]

/** Brute force: every arrangement of the runs in a short line, to check the line solver against. */
function arrangements(clue: number[], n: number): number[][] {
  const out: number[][] = []
  for (let m = 0; m < 1 << n; m++) {
    const line = Array.from({ length: n }, (_, i) => ((m >> i) & 1 ? FILLED : EMPTY))
    const r = runsOf(line)
    if (r.length === clue.length && r.every((x, i) => x === clue[i])) out.push(line)
  }
  return out
}

describe('Nonogram', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that line logic alone solves to the one picture`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateNonogram(level, seeded(seed * 13 + level.length))
        const n = NONOGRAM_LEVELS[level].size
        expect(p.size).toBe(n)
        expect(p.solution).toHaveLength(n * n)
        expect(cluesOf(p.solution, n)).toEqual({ rows: p.rows, cols: p.cols })
        const solved = solveNonogram(p.rows, p.cols)!
        expect(solved.map((v) => (v === FILLED ? FILLED : EMPTY))).toEqual([...p.solution])
        expect(solved.every((v) => v !== EMPTY)).toBe(true)
        expect(isNonogramSolved(solved, p.solution)).toBe(true)
      }
    })
  }

  it('line options match every arrangement for all short lines and partial marks', () => {
    const n = 6
    const rnd = seeded(4)
    for (let t = 0; t < 300; t++) {
      const clue = runsOf(Array.from({ length: n }, () => (rnd() < 0.5 ? FILLED : EMPTY)))
      const cells = Array.from({ length: n }, () => [EMPTY, EMPTY, FILLED, CROSSED][Math.floor(rnd() * 4)])
      const fit = arrangements(clue, n).filter((a) => a.every((v, i) => cells[i] === EMPTY || (cells[i] === FILLED) === (v === FILLED)))
      const opt = lineOptions(clue, cells)
      expect(opt.ok).toBe(fit.length > 0)
      if (fit.length) {
        expect(opt.canFill).toEqual(Array.from({ length: n }, (_, i) => fit.some((a) => a[i] === FILLED)))
        expect(opt.canEmpty).toEqual(Array.from({ length: n }, (_, i) => fit.some((a) => a[i] !== FILLED)))
      }
    }
  })

  it('reports a line as met, open or bad', () => {
    expect(lineStatus([2, 1], [1, 1, 2, 1, 2])).toBe('met')
    expect(lineStatus([2, 1], [1, 0, 0, 0, 0])).toBe('open')
    expect(lineStatus([2, 1], [1, 2, 1, 0, 0])).toBe('bad')
  })

  it('hints name wrong marks first, then forced squares, and finish the picture by following them', () => {
    const p = generateNonogram('medium', seeded(21))
    const marks = Array<number>(p.size * p.size).fill(EMPTY)
    const wrong = [...marks]
    const i = p.solution.findIndex((v) => v !== FILLED)
    wrong[i] = FILLED
    expect(wrongMarks(wrong, p.solution)).toEqual([i])
    expect(nextNonogramHint(p, wrong)).toEqual({ kind: 'mistake', cells: [i] })
    for (let guard = 0; guard < p.size * p.size && !isNonogramSolved(marks, p.solution); guard++) {
      const h = nextNonogramHint(p, marks)!
      expect(h.kind).toBe('move')
      if (h.kind === 'move') marks[h.move.index] = h.move.mark
    }
    expect(isNonogramSolved(marks, p.solution)).toBe(true)
    expect(wrongMarks(marks, p.solution)).toEqual([])
  })

  it('names the simple reasons first', () => {
    const rows = [[], [5], [1], [1], [1]]
    const cols = [[1], [2], [2], [2], [2]]
    expect(findNonogramMove(rows, cols, Array(25).fill(EMPTY))).toMatchObject({ technique: 'blank', kind: 'row', line: 0, mark: CROSSED })
    expect(findNonogramMove([[5], [1], [1], [1], [1]], [[5], [1], [1], [1], [1]], Array(25).fill(EMPTY))).toMatchObject({ technique: 'full', mark: FILLED })
  })
})
