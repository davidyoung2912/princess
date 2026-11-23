import { describe, expect, it } from 'vitest'
import { BLANK, CROSS, LINE, NONE, SLITHER_LEVELS, edgeCount, findMove, generateSlitherlink, isOneLoop, isSlitherSolved, logicSolveSlither, moveEdge, nextSlitherHint, slitherConflicts, topology } from './slitherlink'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(SLITHER_LEVELS) as Difficulty[]

describe('Slitherlink', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles whose one loop logic alone finds`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateSlitherlink(level, seeded(seed * 31 + level.length))
        const { size } = SLITHER_LEVELS[level]
        expect(p.size).toBe(size)
        expect(p.clues).toHaveLength(size * size)
        expect(p.solution).toHaveLength(edgeCount(size))
        expect(isOneLoop(p.solution, size)).toBe(true)
        expect(isSlitherSolved(p.clues, p.solution, size)).toBe(true)
        expect(logicSolveSlither(p.clues, Array(edgeCount(size)).fill(BLANK), size)).toEqual(p.solution)
        expect(slitherConflicts(p.clues, p.solution, size).edges.size).toBe(0)
        const { squares, dots } = slitherConflicts(p.clues, p.solution, size)
        expect(squares.size + dots.size).toBe(0)
      }
    })
  }

  it('lays out the edges around each square and dot', () => {
    const topo = topology(3)
    expect(topo.edgeDots).toHaveLength(edgeCount(3))
    expect(topo.sqEdges[0]).toEqual([0, 3, 12, 13])
    expect(topo.dotEdges[0]).toHaveLength(2)
    expect(topo.dotEdges[5]).toHaveLength(4)
  })

  it('finds the number, dot and corner rules', () => {
    const n = 3
    const blank = Array(edgeCount(n)).fill(BLANK)
    const none = Array(n * n).fill(NONE)
    expect(findMove([0, ...none.slice(1)], blank, n)).toMatchObject({ technique: 'full', mark: CROSS, at: 0 })
    expect(findMove([4, ...none.slice(1)], blank, n)).toMatchObject({ technique: 'need', mark: LINE, at: 0 })
    expect(findMove([1, ...none.slice(1)], blank, n)).toMatchObject({ technique: 'corner', mark: CROSS, at: 0 })
    expect(findMove([3, ...none.slice(1)], blank, n)).toMatchObject({ technique: 'corner', mark: LINE, at: 0 })
    const threes = [...none]
    threes[4] = 3
    threes[5] = 3
    expect(findMove(threes, blank, n)).toMatchObject({ technique: 'threes', mark: LINE })
    const marks = [...blank]
    const topo = topology(n)
    topo.dotEdges[5].slice(0, 2).forEach((e) => { marks[e] = LINE })
    expect(findMove(none, marks, n)).toMatchObject({ technique: 'dotFull', mark: CROSS, at: 5 })
  })

  it('flags a dot with three lines, an over-filled number and a small closed loop', () => {
    const n = 4
    const none = Array(n * n).fill(NONE)
    const topo = topology(n)
    const three = Array(edgeCount(n)).fill(BLANK)
    topo.dotEdges[6].slice(0, 3).forEach((e) => { three[e] = LINE })
    expect(slitherConflicts(none, three, n).dots.has(6)).toBe(true)
    const over = Array(edgeCount(n)).fill(BLANK)
    topo.sqEdges[0].slice(0, 2).forEach((e) => { over[e] = LINE })
    expect([...slitherConflicts([1, ...none.slice(1)], over, n).squares]).toEqual([0])
    const small = Array(edgeCount(n)).fill(BLANK)
    topo.sqEdges[0].forEach((e) => { small[e] = LINE })
    topo.sqEdges[15].slice(0, 1).forEach((e) => { small[e] = LINE })
    expect(slitherConflicts(none, small, n).edges.size).toBe(4)
  })

  it('moves the cursor to the nearest edge in each direction', () => {
    const n = 3
    expect(moveEdge(0, 'right', n)).toBe(1)
    expect(moveEdge(1, 'left', n)).toBe(0)
    expect(moveEdge(0, 'left', n)).toBe(0)
    expect(moveEdge(0, 'down', n)).toBe(topology(n).sqEdges[0][2])
    expect(moveEdge(12, 'right', n)).toBe(0)
    expect(moveEdge(12, 'down', n)).toBe(16)
  })

  it('hints name wrong marks first, then a move, and recognise a finished loop', () => {
    const p = generateSlitherlink('easy', seeded(5))
    const n = p.size
    const blank = Array(edgeCount(n)).fill(BLANK)
    const at = p.solution.findIndex((m) => m === CROSS)
    const wrong = [...blank]
    wrong[at] = LINE
    expect(nextSlitherHint(p.clues, wrong, p.solution, n)).toEqual({ kind: 'mistake', edges: [at] })
    expect(nextSlitherHint(p.clues, blank, p.solution, n)?.kind).toBe('move')
    expect(isSlitherSolved(p.clues, p.solution, n)).toBe(true)
    expect(isSlitherSolved(p.clues, blank, n)).toBe(false)
  })
})
