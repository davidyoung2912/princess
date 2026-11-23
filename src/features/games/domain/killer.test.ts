import { describe, expect, it } from 'vitest'
import { CLASSIC, type Difficulty } from './sudoku'
import { KILLER_LEVELS, generateKiller, killerConflicts, killerDeadCells, logicSolve, nextKillerHint } from './killer'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(KILLER_LEVELS) as Difficulty[]

describe('Killer Sudoku', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles whose cages are sound and which logic alone solves to the one answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateKiller(level, seeded(seed * 17 + level.length))
        const { cages } = p.rules
        expect(cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual(Array.from({ length: 81 }, (_, i) => i))
        for (const c of cages) {
          expect(c.cells.length).toBeGreaterThanOrEqual(1)
          expect(c.cells.length).toBeLessThanOrEqual(KILLER_LEVELS[level].maxCage)
          expect(new Set(c.cells.map((i) => p.solution[i])).size).toBe(c.cells.length)
          expect(c.cells.reduce((s, i) => s + p.solution[i], 0)).toBe(c.sum)
          // connected
          const seen = new Set([c.cells[0]])
          for (let grew = true; grew;) { grew = false; for (const i of c.cells) if (!seen.has(i) && [...seen].some((j) => Math.abs(i - j) === 9 || (Math.abs(i - j) === 1 && Math.floor(i / 9) === Math.floor(j / 9)))) { seen.add(i); grew = true } }
          expect(seen.size).toBe(c.cells.length)
        }
        expect(logicSolve(p.puzzle, p.rules, KILLER_LEVELS[level].logic)).toEqual(p.solution)
        expect(p.puzzle.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(0)
        expect(killerConflicts(p.solution, p.rules).size).toBe(0)
      }
    })
  }

  it('keeps the minimum of given digits on easy', () => {
    const p = generateKiller('easy', seeded(5))
    expect(p.puzzle.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(KILLER_LEVELS.easy.minGivens)
  })

  it('flags a repeat inside a cage, an over-full cage and an unreachable sum', () => {
    const p = generateKiller('medium', seeded(9))
    const cage = p.rules.cages.find((c) => c.cells.length >= 2)!
    const grid = Array<number>(81).fill(0)
    grid[cage.cells[0]] = 9
    grid[cage.cells[1]] = 9
    expect(killerConflicts(grid, p.rules).has(cage.cells[0])).toBe(true)
    const small = p.rules.cages.find((c) => c.cells.length === 2 && c.sum <= 8)
    if (small) {
      const g = Array<number>(81).fill(0)
      g[small.cells[0]] = 9 // leaves nothing that fits the sum
      expect(killerDeadCells(g, p.rules).has(small.cells[1])).toBe(true)
    }
    expect(killerConflicts(Array<number>(81).fill(0), CLASSIC).size).toBe(0)
  })

  it('hints: a mistake first, then moves that match the solution, finishing the puzzle', () => {
    const p = generateKiller('hard', seeded(3))
    const grid = [...p.puzzle]
    const empty = grid.findIndex((v) => v === 0)
    grid[empty] = p.solution[empty] === 1 ? 2 : 1
    expect(nextKillerHint(grid, p.solution, p.rules)?.kind).toBe('mistake')
    grid[empty] = 0
    for (let steps = 0; steps < 90; steps++) {
      const h = nextKillerHint(grid, p.solution, p.rules)
      if (!h) break
      if (h.kind === 'single' || h.kind === 'reveal') { expect(h.value).toBe(p.solution[h.index]); grid[h.index] = h.value }
      else if (h.kind === 'cage') {
        const cage = p.rules.cages[h.cage]
        expect(cage.cells.filter((c) => grid[c] === 0).every((c) => h.digits.includes(p.solution[c]))).toBe(true)
        const next = cage.cells.find((c) => grid[c] === 0)!
        grid[next] = p.solution[next]
      } else throw new Error('unexpected hint')
    }
    expect(grid).toEqual(p.solution)
  })
})
