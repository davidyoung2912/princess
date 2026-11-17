import { describe, expect, it } from 'vitest'
import { CROSSMATH_LEVELS, blanksOf, brokenCrossmath, equationText, findCrossmathMove, generateCrossmath, holds, isCrossmathSolved, logicSolveCrossmath, missingNumber, nextCrossmathHint, type CrossmathPuzzle } from './crossmath'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(CROSSMATH_LEVELS) as Difficulty[]

/** Counts the ways to fill the blanks from the tray so every equation holds (stops at `limit`). */
function countFills(p: CrossmathPuzzle, limit = 2): number {
  const blanks = blanksOf(p)
  const vals = [...p.start]
  const left = [...p.tray]
  let found = 0
  const ok = (i: number) => p.equations.every((e) => ![e.a, e.b, e.c].includes(i) || vals[e.a] === 0 || vals[e.b] === 0 || vals[e.c] === 0 || holds(e.sign, vals[e.a], vals[e.b], vals[e.c]))
  const go = (k: number) => {
    if (found >= limit) return
    if (k === blanks.length) { found++; return }
    const i = blanks[k]
    for (const v of new Set(left)) {
      left.splice(left.indexOf(v), 1)
      vals[i] = v
      if (ok(i)) go(k + 1)
      vals[i] = 0
      left.push(v)
    }
  }
  go(0)
  return found
}

describe('Crossmath', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles with true equations, a matching tray and one answer found by logic`, () => {
      const cfg = CROSSMATH_LEVELS[level]
      for (let seed = 1; seed <= 4; seed++) {
        const p = generateCrossmath(level, seeded(seed * 31 + level.length))
        expect(p.equations.length).toBeGreaterThanOrEqual(2)
        for (const e of p.equations) {
          expect(cfg.signs).toContain(e.sign)
          expect(holds(e.sign, p.solution[e.a], p.solution[e.b], p.solution[e.c])).toBe(true)
          for (const s of [e.a, e.b, e.c]) { expect(p.solution[s]).toBeGreaterThanOrEqual(1); expect(p.solution[s]).toBeLessThanOrEqual(cfg.max) }
        }
        const blanks = blanksOf(p)
        expect(blanks.length).toBeGreaterThan(0)
        expect(p.tray).toEqual(blanks.map((i) => p.solution[i]).sort((a, b) => a - b))
        expect(logicSolveCrossmath(p, p.start, cfg.techniques)).toEqual(p.solution.map((v, i) => (p.kind[i] === 'num' ? v : 0)).map((v, i) => (p.kind[i] === 'num' ? v : p.start[i])))
        expect(isCrossmathSolved(p, p.solution)).toBe(true)
        if (level === 'easy' || level === 'medium') expect(countFills(p)).toBe(1)
      }
    })
  }

  it('finds the missing number in an equation', () => {
    expect(missingNumber('+', 0, 5, 12)).toBe(7)
    expect(missingNumber('−', 9, 0, 4)).toBe(5)
    expect(missingNumber('×', 6, 0, 42)).toBe(7)
    expect(missingNumber('÷', 0, 4, 3)).toBe(12)
    expect(missingNumber('÷', 7, 2, 0)).toBeNull()
    expect(holds('÷', 12, 4, 3)).toBe(true)
  })

  it('flags a filled equation that is not true, and writes an equation out', () => {
    const p = generateCrossmath('easy', seeded(3))
    const bad = [...p.solution]
    bad[p.equations[0].a] += 1
    expect(brokenCrossmath(p.equations, bad).equations).toContain(0)
    expect(brokenCrossmath(p.equations, p.solution).equations).toEqual([])
    expect(equationText(p.equations[0], p.start)).toMatch(/^[\d?]+ [+−×÷] [\d?]+ = [\d?]+$/)
  })

  it('hints name wrong numbers first, then a move, and finish the grid by following them', () => {
    const p = generateCrossmath('hard', seeded(9))
    const blanks = blanksOf(p)
    const vals = [...p.start]
    const wrong = [...vals]
    wrong[blanks[0]] = p.solution[blanks[0]] === 1 ? 2 : 1
    expect(nextCrossmathHint(p, wrong)).toEqual({ kind: 'mistake', cells: [blanks[0]] })
    for (let guard = 0; guard < 100 && !isCrossmathSolved(p, vals); guard++) {
      const h = nextCrossmathHint(p, vals)!
      expect(h.kind).toBe('move')
      if (h.kind === 'move') vals[h.move.index] = h.move.value
    }
    expect(vals).toEqual(p.solution.map((v, i) => (p.kind[i] === 'num' ? v : p.start[i])))
    expect(nextCrossmathHint(p, vals)).toBeNull()
    expect(findCrossmathMove(p.equations, vals, blanks, p.tray, ['one'])).toBeNull()
  })
})
