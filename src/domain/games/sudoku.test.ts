import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, deadCells, LEVELS, UNITS, candidateDigits, clock, conflicts, countSolutions, fullGrid, generatePuzzle, isSolved, nextHint, solvableByLogic, solve } from './sudoku'

/** A small repeatable random number generator, so a failing puzzle can be reproduced. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const valid = (g: readonly number[]) => UNITS.every((u) => new Set(u.map((c) => g[c])).size === 9 && u.every((c) => g[c] >= 1 && g[c] <= 9))

describe('full grid', () => {
  it('is a valid complete grid and differs between runs', () => {
    const a = fullGrid(seeded(1))
    expect(valid(a)).toBe(true)
    expect(fullGrid(seeded(2))).not.toEqual(a)
  })
})

describe('solver', () => {
  it('counts one solution for a puzzle with a unique answer and several for an empty-ish one', () => {
    const { puzzle, solution } = generatePuzzle('easy', seeded(3))
    expect(countSolutions(puzzle)).toBe(1)
    expect(solve(puzzle)).toEqual(solution)
    expect(countSolutions(Array(81).fill(0), 2)).toBe(2)
  })
  it('finds no solution when the clues contradict each other', () => {
    const bad = Array(81).fill(0)
    bad[0] = 5; bad[1] = 5
    expect(solve(bad)).toBeNull()
  })
})

describe('generator', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`makes a unique, logic-solvable ${difficulty} puzzle with a sensible number of clues`, () => {
      for (const seed of [11, 12, 13]) {
        const p = generatePuzzle(difficulty, seeded(seed))
        const clues = p.puzzle.filter((v) => v !== 0).length
        expect(valid(p.solution)).toBe(true)
        expect(p.puzzle.every((v, i) => v === 0 || v === p.solution[i])).toBe(true)
        expect(countSolutions(p.puzzle)).toBe(1)
        expect(solvableByLogic(p.puzzle, LEVELS[difficulty].logic)).toBe(true)
        expect(clues).toBeGreaterThanOrEqual(17)
        expect(clues).toBeLessThanOrEqual(LEVELS[difficulty].clues + 6)
      }
    })
  }
  it('keeps the clues symmetric through the centre', () => {
    const { puzzle } = generatePuzzle('medium', seeded(5))
    expect(puzzle.every((v, i) => (v === 0) === (puzzle[80 - i] === 0))).toBe(true)
  })
  it('gets harder: fewer clues on average from easy to expert', () => {
    const avg = (d: (typeof DIFFICULTIES)[number]) => [21, 22, 23, 24].map((s) => generatePuzzle(d, seeded(s)).puzzle.filter(Boolean).length).reduce((a, b) => a + b) / 4
    expect(avg('easy')).toBeGreaterThan(avg('medium'))
    expect(avg('medium')).toBeGreaterThan(avg('expert'))
  })
})

describe('conflicts and completion', () => {
  it('flags both cells of a repeated digit', () => {
    const g = Array(81).fill(0)
    g[0] = 4; g[8] = 4; g[40] = 9
    expect([...conflicts(g)].sort((a, b) => a - b)).toEqual([0, 8])
  })
  it('knows a finished grid', () => {
    const { solution, puzzle } = generatePuzzle('easy', seeded(7))
    expect(isSolved(solution, solution)).toBe(true)
    expect(isSolved(puzzle, solution)).toBe(false)
  })
})

describe('dead cells', () => {
  it('marks an empty cell that has no digit left, and clears it when the cause is removed', () => {
    const g = Array(81).fill(0)
    // Cell 0 sees 1-4 in its row and 5-8 in its column, and 9 in its box.
    ;[1, 2, 3, 4].forEach((d, k) => { g[1 + k] = d })
    ;[5, 6, 7, 8].forEach((d, k) => { g[9 * (3 + k)] = d })
    g[10] = 9
    expect([...deadCells(g)]).toContain(0)
    g[10] = 0
    expect(deadCells(g).has(0)).toBe(false)
  })
  it('marks the empty cells of a unit where a digit has nowhere to go', () => {
    const g = Array(81).fill(0)
    // Row 0 is empty, and a 9 in each of its three boxes' lower rows leaves no cell in it that can hold a 9.
    g[1 * 9 + 0] = 9
    g[2 * 9 + 3] = 9
    g[1 * 9 + 6] = 9
    expect([...deadCells(g)].filter((c) => c < 9).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    g[1 * 9 + 6] = 0
    expect(deadCells(g).size).toBe(0)
  })
  it('finds nothing wrong on a fresh puzzle or the matching solution', () => {
    const p = generatePuzzle('hard', seeded(31))
    expect(deadCells(p.puzzle).size).toBe(0)
    expect(deadCells(p.solution).size).toBe(0)
  })
})

describe('hints', () => {
  const p = generatePuzzle('easy', seeded(9))
  it('points at a mistake first', () => {
    const g = [...p.puzzle]
    const i = g.findIndex((v) => v === 0)
    g[i] = (p.solution[i] % 9) + 1
    expect(nextHint(g, p.solution)).toEqual({ kind: 'mistake', cells: [i] })
  })
  it('names a cell and the right digit, with the technique that finds it', () => {
    const h = nextHint(p.puzzle, p.solution)
    expect(h?.kind).toBe('single')
    if (h?.kind === 'single') {
      expect(p.puzzle[h.index]).toBe(0)
      expect(h.value).toBe(p.solution[h.index])
    }
  })
  it('following hints always finishes an easy puzzle, then returns null', () => {
    const g = [...p.puzzle]
    for (let n = 0; n < 81; n++) {
      const h = nextHint(g, p.solution)
      if (h === null) break
      expect(h.kind).not.toBe('mistake')
      if (h.kind !== 'mistake') g[h.index] = h.value
    }
    expect(isSolved(g, p.solution)).toBe(true)
    expect(nextHint(g, p.solution)).toBeNull()
  })
  it('lists the digits a cell can still hold', () => {
    const i = p.puzzle.findIndex((v) => v === 0)
    expect(candidateDigits(p.puzzle, i)).toContain(p.solution[i])
  })
})

it('formats the clock', () => { expect(clock(7)).toBe('0:07'); expect(clock(754)).toBe('12:34') })
