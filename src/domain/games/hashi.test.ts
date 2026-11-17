import { describe, expect, it } from 'vitest'
import { HASHI_LEVELS, crossingsOf, cycleCount, generateHashi, isHashiSolved, islandStatus, nextHashiHint, solveByLogic } from './hashi'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(HASHI_LEVELS) as Difficulty[]

describe('Hashi', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that logic alone solves to a valid answer`, () => {
      for (let seed = 1; seed <= 2; seed++) {
        const p = generateHashi(level, seeded(seed * 31 + level.length))
        const { rows, cols } = HASHI_LEVELS[level]
        expect(p.rows).toBe(rows)
        expect(p.cols).toBe(cols)
        expect(solveByLogic(p)).toEqual(p.solution)
        expect(isHashiSolved(p, p.solution)).toBe(true)
        // No two bridges of the answer cross, and no island shares a square.
        p.solution.forEach((k, i) => { if (k > 0) for (const x of p.crosses[i]) expect(p.solution[x]).toBe(0) })
        expect(new Set(p.islands.map((i) => i.r * cols + i.c)).size).toBe(p.islands.length)
      }
    })
  }

  it('finds crossings only where a bridge would pass through another', () => {
    const islands = [{ r: 1, c: 0, n: 1 }, { r: 1, c: 2, n: 1 }, { r: 0, c: 1, n: 1 }, { r: 2, c: 1, n: 1 }]
    const links = [{ a: 0, b: 1, horizontal: true, cap: 1 }, { a: 2, b: 3, horizontal: false, cap: 1 }]
    expect(crossingsOf(islands, links)).toEqual([[1], [0]])
  })

  it('cycles none, one, two and blocks a bridge that would cross', () => {
    const p = generateHashi('easy', seeded(3))
    const l = p.links.findIndex((x) => x.cap === 2 && p.crosses[p.links.indexOf(x)].length === 0)
    const counts = p.links.map(() => 0)
    expect(cycleCount(p, counts, l)).toBe(1)
    counts[l] = 1
    expect(cycleCount(p, counts, l)).toBe(2)
    counts[l] = 2
    expect(cycleCount(p, counts, l)).toBe(0)
    const x = p.crosses.findIndex((c) => c.length > 0)
    if (x >= 0) {
      const c2 = p.links.map(() => 0)
      c2[p.crosses[x][0]] = 1
      expect(cycleCount(p, c2, x)).toBeNull()
    }
  })

  it('hints name an over-full link first, then follow the logic to the answer', () => {
    const p = generateHashi('medium', seeded(9))
    const counts = p.links.map(() => 0)
    const i = p.solution.findIndex((k, n) => k < p.links[n].cap)
    const wrong = [...counts]
    wrong[i] = p.solution[i] + 1
    expect(nextHashiHint(p, wrong)).toEqual({ kind: 'mistake', links: [i] })
    for (let guard = 0; guard < 400 && !isHashiSolved(p, counts); guard++) {
      const h = nextHashiHint(p, counts)!
      expect(h.kind).toBe('move')
      if (h.kind !== 'move') break
      expect(h.move.lo).toBeLessThanOrEqual(p.solution[h.move.link])
      expect(h.move.lo).toBeGreaterThan(counts[h.move.link])
      counts[h.move.link] = h.move.lo
    }
    expect(isHashiSolved(p, counts)).toBe(true)
    const st = islandStatus(p, counts)
    expect(st.bad.some(Boolean)).toBe(false)
    expect(st.closed.some(Boolean)).toBe(false)
  })
})
