import { describe, expect, it } from 'vitest'
import { BLANK, DOT, NURIKABE_LEVELS, WALL, findMove, generateNurikabe, isNurikabeSolved, isValidNurikabe, logicSolveNurikabe, nextNurikabeHint, nurikabeConflicts } from './nurikabe'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(NURIKABE_LEVELS) as Difficulty[]

describe('Nurikabe', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to a valid answer`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const p = generateNurikabe(level, seeded(seed * 17 + level.length))
        const { rows, cols, split } = NURIKABE_LEVELS[level]
        expect([p.rows, p.cols]).toEqual([rows, cols])
        expect(isValidNurikabe(p.clues, p.solution, rows, cols)).toBe(true)
        const done = logicSolveNurikabe(p.clues, Array(rows * cols).fill(BLANK), rows, cols, split)
        done.forEach((m, i) => { if (p.clues[i] === 0) expect(m === WALL).toBe(p.solution[i] === 1) })
        expect(done.some((m, i) => m === BLANK && p.clues[i] === 0)).toBe(false)
        expect(isNurikabeSolved(p, done)).toBe(true)
      }
    })
  }

  it('rejects a 2 by 2 wall, a split wall and a wrong island size', () => {
    // 1 . / . .  -> clue 1 at 0, the rest wall makes a 2x2 wall? Use a 3 by 3: clue 1 in the middle.
    const clues = [0, 0, 0, 0, 1, 0, 0, 0, 0]
    expect(isValidNurikabe(clues, [1, 1, 1, 1, 0, 1, 1, 1, 1], 3, 3)).toBe(true)
    expect(isValidNurikabe(clues, [1, 1, 1, 1, 0, 1, 1, 1, 0], 3, 3)).toBe(false) // an island with no number
    expect(isValidNurikabe([1, 0, 0, 0], [0, 1, 1, 1], 2, 2)).toBe(true)
    expect(isValidNurikabe([2, 0, 0, 0], [0, 1, 1, 1], 2, 2)).toBe(false)
    expect(isValidNurikabe([0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 1, 0, 1, 1, 0, 0, 0, 0], 3, 3)).toBe(false)
  })

  it('applies the rules: between two islands, a full island, a 2 by 2, one way to grow', () => {
    // 1 _ 1 in a row: the middle is between two islands.
    expect(findMove([1, 0, 1], [0, 0, 0], 1, 3)).toMatchObject({ index: 1, mark: WALL, technique: 'between' })
    // 2 _ _ : after a dot the 2 is full, so its other neighbour is wall.
    expect(findMove([2, 0, 0], [0, DOT, 0], 1, 3)).toMatchObject({ index: 2, mark: WALL, technique: 'complete' })
    // 2 on a one-wide strip with one free neighbour has only one way to grow.
    expect(findMove([2, 0, 0], [0, 0, 0], 1, 3)).toMatchObject({ index: 1, mark: DOT, technique: 'single' })
    // Three wall squares of a block force the fourth white.
    expect(findMove([0, 0, 0, 0, 0, 0, 0, 0, 3], [WALL, WALL, 0, WALL, 0, 0, 0, 0, 0], 3, 3, false)).toMatchObject({ index: 4, mark: DOT, technique: 'block' })
  })

  it('flags certain mistakes only', () => {
    const clues = [1, 0, 0, 0]
    expect([...nurikabeConflicts(clues, [0, WALL, WALL, WALL], 2, 2)]).toEqual([])
    expect(nurikabeConflicts([0, 0, 0, 0], [WALL, WALL, WALL, WALL], 2, 2).size).toBe(4)
    // A numbered square walled in too tightly.
    expect(nurikabeConflicts([3, 0, 0, 0], [0, WALL, WALL, 0], 2, 2).has(0)).toBe(true)
    // Two numbers in one region.
    expect(nurikabeConflicts([1, 0, 1], [0, 0, 0], 1, 3).size).toBe(2)
  })

  it('hints name a wrong mark first, then follow the logic to the answer', () => {
    const p = generateNurikabe('medium', seeded(5))
    const marks: number[] = Array(p.rows * p.cols).fill(BLANK)
    const i = p.solution.findIndex((s, k) => s === 0 && p.clues[k] === 0)
    const wrong = [...marks]
    wrong[i] = WALL
    expect(nextNurikabeHint(p, wrong)).toEqual({ kind: 'mistake', cells: [i] })
    for (let guard = 0; guard < 400 && !isNurikabeSolved(p, marks); guard++) {
      const h = nextNurikabeHint(p, marks)!
      expect(h.kind).toBe('move')
      if (h.kind !== 'move') break
      expect(h.move.mark === WALL).toBe(p.solution[h.move.index] === 1)
      marks[h.move.index] = h.move.mark
    }
    expect(isNurikabeSolved(p, marks)).toBe(true)
  })
})
