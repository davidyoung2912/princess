import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import * as lights from './lights'
import * as peg from './peg'
import * as slide from './slide'
import { search } from './search'

describe('Peg solitaire', () => {
  it('has the right number of holes and starts with one empty', () => {
    expect(peg.LAYOUTS.english.holes).toHaveLength(33)
    expect(peg.LAYOUTS.french.holes).toHaveLength(37)
    expect(peg.LAYOUTS.triangle.holes).toHaveLength(15)
    expect(peg.count(peg.start('english'))).toBe(32)
    expect(peg.count(peg.start('french'))).toBe(36)
    expect(peg.count(peg.start('triangle'))).toBe(14)
    expect(peg.movesOf('english', peg.start('english'))).toHaveLength(4)
  })
  it('jumps remove the jumped peg', () => {
    const p = peg.start('english')
    const m = peg.movesOf('english', p)[0]
    const q = peg.jump(p, m)
    expect([q[m.from], q[m.over], q[m.to]]).toEqual([false, false, true])
    expect(peg.count(q)).toBe(31)
  })
  it('finds a winning line on the triangle and the English cross', () => {
    for (const b of ['triangle', 'english'] as const) {
      let p = peg.start(b)
      const line = peg.solve(b, p, 400000, seededRng(3))
      expect(line, b).not.toBeNull()
      for (const m of line!) { expect(peg.movesOf(b, p)).toContainEqual(m); p = peg.jump(p, m) }
      expect(peg.isWon(p)).toBe(true)
    }
  })
  it('rates the finish', () => {
    expect([1, 2, 3, 4, 9].map(peg.rating)).toEqual(['genius', 'excellent', 'good', 'ok', 'again'])
  })
})

describe('Lights Out', () => {
  it('flips a tile and its neighbours, and solves every puzzle with the fewest presses', () => {
    expect(lights.press(Array(25).fill(false), 12, 5).filter(Boolean)).toHaveLength(5)
    expect(lights.press(Array(25).fill(false), 0, 5).filter(Boolean)).toHaveLength(3)
    for (const level of lights.LIGHTS_LEVELS) {
      for (let s = 1; s <= 10; s++) {
        const n = lights.SIZE_OF[level]
        const b = lights.generate(level, seededRng(s * 7))
        expect(lights.isOff(b)).toBe(false)
        const sol = lights.solution(b, n)
        expect(sol).not.toBeNull()
        expect(sol!.length).toBeLessThanOrEqual(lights.SCRAMBLE_OF[level])
        let cur = b
        for (const i of sol!) cur = lights.press(cur, i, n)
        expect(lights.isOff(cur)).toBe(true)
      }
    }
  })
})

describe('Sliding tiles', () => {
  it('makes solvable shuffles and slides a line of tiles', () => {
    for (const n of [3, 4, 5]) {
      const t = slide.generate(n, seededRng(n))
      expect(slide.isSolved(t)).toBe(false)
      expect([...t].sort((a, b) => a - b)).toEqual(slide.solved(n).sort((a, b) => a - b))
    }
    const t = [1, 2, 3, 4, 5, 6, 7, 0, 8]
    expect(slide.tap(t, 8, 3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0])
    expect(slide.tap(t, 0, 3)).toEqual(t) // not in line
    const row = [1, 2, 3, 0, 5, 6, 4, 7, 8]
    expect(slide.tap(row, 6, 3)).toEqual([1, 2, 3, 4, 5, 6, 0, 7, 8]) // slides a column? tile 4 is below the blank
  })
  it('hints lead to the solution on a small board', () => {
    let t = slide.generate(3, seededRng(11))
    let guard = 0
    while (!slide.isSolved(t) && guard++ < 60) {
      const h = slide.hint(t, 3)!
      expect(slide.line(t, h, 3).length).toBe(1)
      t = slide.tap(t, h, 3)
    }
    expect(slide.isSolved(t)).toBe(true)
  })
  it('hints on a 4 by 4 board stay legal', () => {
    const t = slide.generate(4, seededRng(5))
    const h = slide.hint(t, 4, 20000)
    expect(h).not.toBeNull()
    expect(slide.line(t, h!, 4).length).toBe(1)
  })
})

describe('search', () => {
  it('finds the winning move in a tiny take-away game', () => {
    // Players alternately take 1 or 2 from a pile; taking the last wins. From 4, take 1 (leaving 3, a loss for the mover).
    interface S { n: number; p: 0 | 1 }
    const ctx = {
      moves: (s: S) => (s.n >= 2 ? [1, 2] : s.n === 1 ? [1] : []),
      apply: (s: S, m: number): S => ({ n: s.n - m, p: s.p === 0 ? 1 : 0 }),
      player: (s: S) => s.p,
      over: (s: S) => s.n === 0,
      value: (s: S) => (s.n === 0 ? (s.p === 0 ? -1 : 1) : 0),
    }
    expect(search({ n: 4, p: 0 }, 6, ctx, { rng: seededRng(1) })).toBe(1)
    expect(search({ n: 0, p: 0 }, 3, ctx)).toBeNull()
  })
})
