import { describe, expect, it } from 'vitest'
import { BINAIRO_LEVELS, CIRCLE, SQUARE, binairoConflicts, binairoDeadCells, findMove, fullBinairo, generateBinairo, isValidBinairo, logicSolveBinairo, nextBinairoHint } from './binairo'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(BINAIRO_LEVELS) as Difficulty[]
const C = CIRCLE
const S = SQUARE

describe('Binairo', () => {
  it('builds valid full grids at every size', () => {
    for (const { size } of Object.values(BINAIRO_LEVELS)) {
      const g = fullBinairo(size, seeded(size)) ?? fullBinairo(size, seeded(size + 1))
      expect(g).not.toBeNull()
      expect(isValidBinairo(g!, size)).toBe(true)
    }
  })

  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to the one answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateBinairo(level, seeded(seed * 31 + level.length))
        const { size, unique, minGivenShare } = BINAIRO_LEVELS[level]
        expect(p.size).toBe(size)
        expect(isValidBinairo(p.solution, size)).toBe(true)
        expect(p.puzzle.every((v, i) => v === 0 || v === p.solution[i])).toBe(true)
        expect(p.puzzle.filter((v) => v !== 0).length).toBeGreaterThanOrEqual(Math.ceil(size * size * minGivenShare))
        expect(logicSolveBinairo(p.puzzle, size, unique)).toEqual(p.solution)
        expect(binairoConflicts(p.puzzle, size).size).toBe(0)
      }
    })
  }

  it('finds a pair and a gap', () => {
    const e = (rows: string) => rows.replace(/\s/g, '').split('').map((ch) => (ch === '.' ? 0 : ch === 'o' ? C : S))
    // pair: two circles at the start of the row force a square after them
    expect(findMove(e('oo.... ...... ...... ...... ...... ......'), 6)).toMatchObject({ technique: 'pair', index: 2, value: S })
    // gap
    expect(findMove(e('o.o... ...... ...... ...... ...... ......'), 6)).toMatchObject({ technique: 'gap', index: 1, value: S })
  })

  it('marks threes, over-full lines and identical lines', () => {
    const n = 6
    const g = Array(n * n).fill(0)
    ;[C, C, C].forEach((v, c) => { g[c] = v })
    expect([...binairoConflicts(g, n)].sort()).toEqual([0, 1, 2])
    const over = Array(n * n).fill(0)
    ;[S, 0, S, 0, S, 0].forEach((v, c) => { over[c] = v })
    over[1] = S
    expect(binairoConflicts(over, n).size).toBeGreaterThan(0)
    const p = generateBinairo('easy', seeded(3))
    const same = [...p.solution]
    for (let c = 0; c < n; c++) same[n + c] = same[c]
    expect(binairoConflicts(same, n).size).toBeGreaterThan(0)
  })

  it('marks a cell that neither symbol can fill', () => {
    const n = 6
    const g = Array(n * n).fill(0)
    ;[C, C, 0, S, S, 0].forEach((v, c) => { g[c] = v })
    // cell 2 cannot be a circle (three in a row) nor a square (three in a row with the pair after it)
    expect(binairoDeadCells(g, n).has(2)).toBe(true)
    expect(binairoDeadCells(g, n).has(5)).toBe(false)
  })

  it('hints name wrong entries first, then a logical move', () => {
    const p = generateBinairo('easy', seeded(8))
    const wrongAt = p.puzzle.indexOf(0)
    const bad = [...p.puzzle]
    bad[wrongAt] = 3 - p.solution[wrongAt]
    expect(nextBinairoHint(bad, p.solution, p.size)).toEqual({ kind: 'mistake', cells: [wrongAt] })
    const h = nextBinairoHint(p.puzzle, p.solution, p.size)
    expect(h?.kind).toBe('move')
    if (h?.kind === 'move') expect(h.move.value).toBe(p.solution[h.move.index])
    expect(nextBinairoHint(p.solution, p.solution, p.size)).toBeNull()
  })
})
