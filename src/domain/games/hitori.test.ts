import { describe, expect, it } from 'vitest'
import { BLANK, CIRCLED, HITORI_LEVELS, SHADED, findMove, generateHitori, hitoriConflicts, isHitoriSolved, isValidHitori, logicSolveHitori, neighboursOf, nextHitoriHint, twinsOf } from './hitori'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(HITORI_LEVELS) as Difficulty[]

describe('Hitori', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to the one shading`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateHitori(level, seeded(seed * 17 + level.length))
        const { size, split } = HITORI_LEVELS[level]
        expect(p.size).toBe(size)
        expect(p.values).toHaveLength(size * size)
        expect(isValidHitori(p.values, p.solution, size)).toBe(true)
        // every shaded square repeats a digit that stays
        p.solution.forEach((m, i) => { if (m === SHADED) expect(twinsOf(p.values, i, size).some((j) => p.solution[j] !== SHADED)).toBe(true) })
        expect(logicSolveHitori(p.values, Array(size * size).fill(BLANK), size, split)).toEqual(p.solution)
        expect(hitoriConflicts(p.values, p.solution, size).size).toBe(0)
      }
    })
  }

  it('finds the pair, sandwich and neighbour rules', () => {
    const n = 5
    const blank = Array(n * n).fill(BLANK)
    // 3 3 1 2 3 across the top: the pair of threes shades the third three
    const pair = [3, 3, 1, 2, 3, ...Array(20).fill(9)]
    expect(findMove(pair, blank, n)).toMatchObject({ technique: 'pair', index: 4, mark: SHADED })
    // 4 1 4: the middle stays
    const sandwich = [4, 1, 4, 2, 3, ...[1, 2, 3, 4, 5].map((d) => d + 10), ...Array(15).fill(9).map((_, k) => 20 + k)]
    expect(findMove(sandwich, blank, n)).toMatchObject({ technique: 'sandwich', index: 1, mark: CIRCLED })
    const marks = [...blank]
    marks[0] = SHADED
    expect(findMove(sandwich, marks, n)).toMatchObject({ technique: 'neighbour', mark: CIRCLED })
    expect(neighboursOf(0, n)).toEqual([1, 5])
  })

  it('flags touching shaded squares, repeated circles and a split group', () => {
    const n = 4
    const values = Array.from({ length: 16 }, (_, i) => i + 1)
    const touching = Array(16).fill(BLANK)
    touching[0] = SHADED
    touching[1] = SHADED
    expect([...hitoriConflicts(values, touching, n)].sort((a, b) => a - b)).toEqual([0, 1])
    const same = [1, 1, 3, 4, ...Array(12).fill(0).map((_, k) => 20 + k)]
    const circled = Array(16).fill(BLANK)
    circled[0] = CIRCLED
    circled[1] = CIRCLED
    expect([...hitoriConflicts(same, circled, n)].sort((a, b) => a - b)).toEqual([0, 1])
    const split = Array(16).fill(BLANK)
    ;[1, 4, 6].forEach((i) => { split[i] = SHADED })
    expect(hitoriConflicts(values, split, n).has(0)).toBe(true)
  })

  it('hints name wrong marks first, then a move, and recognise a finished grid', () => {
    const p = generateHitori('easy', seeded(5))
    const n = p.size
    const blank = Array(n * n).fill(BLANK)
    const wrongAt = p.solution.findIndex((m) => m !== SHADED)
    const wrong = [...blank]
    wrong[wrongAt] = SHADED
    expect(nextHitoriHint(p.values, wrong, p.solution, n)).toEqual({ kind: 'mistake', cells: [wrongAt] })
    expect(nextHitoriHint(p.values, blank, p.solution, n)?.kind).toBe('move')
    expect(isHitoriSolved(p.values, p.solution, n)).toBe(true)
    expect(isHitoriSolved(p.values, blank, n)).toBe(false)
  })
})
