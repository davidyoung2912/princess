import { describe, expect, it } from 'vitest'
import { MINE_LEVELS, badNumbers, chordTargets, generateMinesweeper, isMinesweeperSolved, neighboursOf, nextMineHint, revealFrom, solvableByLogic, wrongFlags } from './minesweeper'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(MINE_LEVELS) as Difficulty[]

describe('Minesweeper', () => {
  for (const level of LEVELS) {
    it(`makes ${level} boards that logic alone clears, with a safe opening`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateMinesweeper(level, seeded(seed * 17 + level.length))
        const { rows, cols, mines } = MINE_LEVELS[level]
        expect(p.mines.filter(Boolean)).toHaveLength(mines)
        expect(p.values[p.start]).toBe(0)
        expect(p.mines[p.start]).toBe(false)
        for (const nb of neighboursOf(p.start, rows, cols)) expect(p.mines[nb]).toBe(false)
        expect(solvableByLogic(p, mines)).toBe(true)
      }
    })
  }

  it('hints name wrong flags first, then follow certain squares to the end', () => {
    const p = generateMinesweeper('medium', seeded(5))
    const n = p.rows * p.cols
    let revealed = revealFrom(p, Array<boolean>(n).fill(false), p.start)
    const flags = Array<boolean>(n).fill(false)
    const wrong = [...flags]
    const i = p.mines.findIndex((m) => !m)
    wrong[i] = true
    expect(wrongFlags(p, wrong)).toEqual([i])
    expect(nextMineHint(p, revealed, wrong)).toEqual({ kind: 'mistake', cells: [i] })
    for (let guard = 0; guard < n * 2 && !isMinesweeperSolved(p, revealed); guard++) {
      const h = nextMineHint(p, revealed, flags)!
      expect(h.kind).toBe('move')
      if (h.kind !== 'move') break
      expect(p.mines[h.move.index]).toBe(h.move.kind === 'mine')
      if (h.move.kind === 'mine') flags[h.move.index] = true
      else revealed = revealFrom(p, revealed, h.move.index)
    }
    expect(isMinesweeperSolved(p, revealed)).toBe(true)
  })

  it('chords only when the flags match the number, and flags a bad number in red', () => {
    const p = { rows: 3, cols: 3, mines: [false, false, false, false, false, false, true, false, false], values: [0, 0, 0, 1, 1, 0, 0, 1, 0], start: 2 }
    const revealed = revealFrom(p, Array<boolean>(9).fill(false), 2)
    expect(revealed[6]).toBe(false)
    const flags = Array<boolean>(9).fill(false)
    expect(chordTargets(p, revealed, flags, 4)).toBeNull()
    flags[6] = true
    expect(chordTargets(p, revealed, flags, 4)).toEqual([7].filter((k) => !revealed[k]).length ? [7] : null)
    flags[7] = true
    expect(badNumbers(p, revealed, flags).has(4)).toBe(true)
  })
})
