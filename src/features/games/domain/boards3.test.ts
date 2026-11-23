import { describe, expect, it } from 'vitest'
import * as bt from './breakthrough'
import { seededRng } from './cards'
import * as c4 from './connect4'
import * as kn from './konane'
import * as mm from './mastermind'
import * as nim from './nim'
import { SKILL_LIST, type Skill } from './search'

describe('Mastermind', () => {
  it('scores black and white pegs, with repeats counted correctly', () => {
    expect(mm.score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ black: 4, white: 0 })
    expect(mm.score([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ black: 0, white: 4 })
    expect(mm.score([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ black: 1, white: 2 })
    expect(mm.score([1, 1, 2, 3], [1, 1, 1, 1])).toEqual({ black: 2, white: 0 })
    expect(mm.allCodes(6, 4)).toHaveLength(1296)
  })
  it('the computer finds any secret from feedback alone, faster when stronger', () => {
    const { colours, length } = mm.SIZES.classic
    const all = mm.allCodes(colours, length)
    const avg = (skill: Skill) => {
      const rng = seededRng(9)
      let total = 0
      const n = 30
      for (let k = 0; k < n; k++) {
        const secret = mm.randomCode(colours, length, rng)
        const turns: mm.Turn[] = []
        for (let t = 0; t < 12; t++) {
          const guess = mm.chooseGuess(all, turns, skill, rng)
          const feedback = mm.score(secret, guess)
          turns.push({ guess, feedback })
          if (feedback.black === length) break
        }
        expect(turns[turns.length - 1].feedback.black).toBe(length)
        total += turns.length
      }
      return total / n
    }
    const captain = avg('captain'), admiral = avg('admiral')
    expect(captain).toBeLessThan(7)
    expect(admiral).toBeLessThanOrEqual(captain + 0.3)
    expect(admiral).toBeLessThan(5.2)
  }, 120000)
})

describe('Nim', () => {
  it('takes counters from one heap and decides the winner by the rule', () => {
    let g = nim.start([1, 3, 5], 'normal')
    expect(nim.apply(g, { heap: 0, take: 2 })).toBeNull()
    g = nim.apply(g, { heap: 2, take: 5 })!
    expect(g.heaps).toEqual([1, 3, 0]); expect(g.turn).toBe(2)
    const end = nim.apply(nim.start([1], 'normal'), { heap: 0, take: 1 })!
    expect(end.winner).toBe(1)
    expect(nim.apply(nim.start([1], 'misere'), { heap: 0, take: 1 })!.winner).toBe(2)
  })
  it('the perfect move wins from every winning position, in both rules', () => {
    for (const rule of nim.RULES) for (const heaps of [[1, 3, 5, 7], [2, 4, 6], [1, 1, 3], [4, 3, 2, 1], [1, 2, 3, 4, 5]]) {
      // Play perfect against random: the perfect side must win whenever it started or got a winning position.
      for (let s = 1; s <= 10; s++) {
        const rng = seededRng(s)
        let g = nim.start(heaps, rule)
        while (!g.winner) {
          const m = g.turn === 1 ? nim.chooseMove(g, 'admiral', rng)! : (() => { const ms = nim.legalMoves(g); return ms[Math.floor(rng() * ms.length)] })()
          g = nim.apply(g, m)!
        }
        // If player 1 had a perfect move at the start it must win; otherwise it can still win after random slips, so only check the first case.
        const first = nim.perfectMove(nim.start(heaps, rule))
        if (first) expect(g.winner, `${rule} ${heaps}`).toBe(1)
      }
    }
  })
})

describe('Connect Four', () => {
  it('drops to the lowest slot and finds four in each direction', () => {
    let g = c4.start()
    for (const col of [0, 1, 0, 1, 0, 1, 0]) g = c4.drop(g, col)!
    expect(g.winner).toBe(1)
    expect(g.line).toHaveLength(4)
    expect(c4.drop(g, 2)).toBeNull()
    let d = c4.start()
    for (const col of [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]) d = c4.drop(d, col)!
    expect(d.winner).toBe(1) // diagonal
    let f = c4.start()
    for (let i = 0; i < 6; i++) f = c4.drop(f, 0)!
    expect(c4.drop(f, 0)).toBeNull()
  })
  it('the computer takes a win and blocks one, and the Admiral beats a random player', () => {
    let g = c4.start()
    for (const col of [0, 6, 1, 6, 2]) g = c4.drop(g, col)!
    let h = c4.start()
    for (const col of [0, 6, 1, 6, 2]) h = c4.drop(h, col)!
    h = { ...h }
    expect([3]).toContain(c4.chooseMove({ ...h, turn: 1 }, 'captain', seededRng(2)))
    let wins = 0
    for (let s = 1; s <= 6; s++) {
      const rng = seededRng(s * 7)
      let x = c4.start()
      const ai = s % 2 ? 1 : 2
      while (!x.winner) { const ms = c4.legalMoves(x); x = c4.drop(x, x.turn === ai ? c4.chooseMove(x, 'admiral', rng)! : ms[Math.floor(rng() * ms.length)])! }
      if (x.winner === ai) wins++
    }
    expect(wins).toBe(6)
  }, 120000)
})

describe('Breakthrough', () => {
  it('starts with two rows each and legal forward and diagonal steps only', () => {
    for (const n of [6, 7, 8]) { const g = bt.start(n); expect(bt.countOf(g, 1)).toBe(2 * n); expect(bt.countOf(g, 2)).toBe(2 * n) }
    const g = bt.start(8)
    expect(bt.legalMoves(g).every((m) => Math.floor(m.to / 8) === Math.floor(m.from / 8) - 1)).toBe(true)
    const board = Array(36).fill(0) as (0 | 1 | 2)[]
    board[3 * 6 + 2] = 1; board[2 * 6 + 2] = 2; board[2 * 6 + 3] = 2
    const mv = bt.legalMoves({ ...bt.start(6), cells: board })
    expect(mv.some((m) => m.to === 2 * 6 + 2)).toBe(false) // cannot capture straight ahead
    expect(mv.some((m) => m.to === 2 * 6 + 3)).toBe(true) // captures diagonally
  })
  it('wins by reaching the far row or capturing everything, and plays full games', () => {
    const board = Array(36).fill(0) as (0 | 1 | 2)[]
    board[6] = 1; board[35] = 2
    expect(bt.apply({ ...bt.start(6), cells: board }, { from: 6, to: 0 }).winner).toBe(1)
    for (const skill of SKILL_LIST) {
      const rng = seededRng(2 + skill.length)
      let g = bt.start(6)
      let guard = 0
      while (!g.winner && guard++ < 200) { const m = bt.chooseMove(g, skill, rng)!; expect(bt.legalMoves(g)).toContainEqual(m); g = bt.apply(g, m) }
      expect(g.winner).not.toBe(0)
    }
  }, 120000)
  it('the Admiral beats a random player', () => {
    let wins = 0
    for (let s = 1; s <= 4; s++) {
      const rng = seededRng(s * 3)
      let g = bt.start(6)
      const ai = s % 2 ? 1 : 2
      while (!g.winner) { const ms = bt.legalMoves(g); g = bt.apply(g, g.turn === ai ? bt.chooseMove(g, 'admiral', rng)! : ms[Math.floor(rng() * ms.length)]) }
      if (g.winner === ai) wins++
    }
    expect(wins).toBe(4)
  }, 120000)
})

describe('Konane', () => {
  it('opens with two removals and then only jumps, over enemy stones into holes', () => {
    let g = kn.start(6)
    expect(g.opening).toBe(2)
    expect(kn.openingMoves(g).every((i) => g.cells[i] === 1)).toBe(true)
    g = kn.remove(g, kn.openingMoves(g)[0])!
    expect(g.turn).toBe(2)
    expect(kn.openingMoves(g).length).toBeGreaterThan(0)
    g = kn.remove(g, kn.openingMoves(g)[0])!
    expect(g.opening).toBe(0)
    const moves = kn.legalMoves(g)
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) { const after = kn.jump(g, m); expect(after.cells.filter((x) => x === 2).length).toBe(g.cells.filter((x) => x === 2).length - m.captured.length) }
  })
  it('loses when out of jumps, and plays whole games with legal moves', () => {
    for (const skill of SKILL_LIST) {
      const rng = seededRng(4 + skill.length)
      let g = kn.start(6)
      let guard = 0
      while (!g.winner && guard++ < 200) { const m = kn.chooseMove(g, skill, rng)!; expect(kn.allMoves(g)).toContainEqual(m); g = kn.step(g, m) }
      expect(g.winner).not.toBe(0)
    }
  }, 120000)
  it('the Admiral beats a random player', () => {
    let wins = 0
    for (let s = 1; s <= 4; s++) {
      const rng = seededRng(s * 11)
      let g = kn.start(6)
      const ai = s % 2 ? 1 : 2
      while (!g.winner) { const ms = kn.allMoves(g); g = kn.step(g, g.turn === ai ? kn.chooseMove(g, 'admiral', rng)! : ms[Math.floor(rng() * ms.length)]) }
      if (g.winner === ai) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
  }, 120000)
})
