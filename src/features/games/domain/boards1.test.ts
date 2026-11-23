import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import * as five from './fiveRow'
import * as hex from './hex'
import * as rev from './reversi'
import { SKILL_LIST, type Skill } from './search'

describe('Reversi', () => {
  it('starts with four discs and four legal moves for black', () => {
    const g = rev.start()
    expect(rev.counts(g.board)).toEqual({ black: 2, white: 2 })
    expect(rev.legalMoves(g.board, 1).sort((a, b) => a - b)).toEqual([19, 26, 37, 44])
  })
  it('flips trapped discs, switches turn, and rejects illegal moves', () => {
    const g = rev.start()
    const r = rev.play(g, 19)!
    expect(r.flipped).toEqual([27])
    expect(r.game.board[27]).toBe(1)
    expect(r.game.turn).toBe(2)
    expect(rev.play(g, 0)).toBeNull()
  })
  it('plays whole games to the end, each side only ever making legal moves', () => {
    for (const skill of SKILL_LIST) {
      const rng = seededRng(skill.length)
      let g = rev.start()
      let guard = 0
      while (!rev.isOver(g) && guard++ < 70) {
        const m = rev.chooseMove(g, g.turn === 1 ? skill : 'cadet', rng)!
        expect(rev.legalMoves(g.board, g.turn)).toContain(m)
        g = rev.play(g, m)!.game
      }
      expect(rev.isOver(g)).toBe(true)
    }
  })
  it('the Admiral beats a random player, and answers quickly', () => {
    let wins = 0
    let slowest = 0
    for (let s = 1; s <= 4; s++) {
      const rng = seededRng(s * 13)
      let g = rev.start()
      const admiral = s % 2 === 0 ? 1 : 2
      let guard = 0
      while (!rev.isOver(g) && guard++ < 70) {
        const moves = rev.legalMoves(g.board, g.turn)
        const t0 = performance.now()
        const m = g.turn === admiral ? rev.chooseMove(g, 'admiral', rng)! : moves[Math.floor(rng() * moves.length)]
        if (g.turn === admiral) slowest = Math.max(slowest, performance.now() - t0)
        g = rev.play(g, m)!.game
      }
      if (rev.winner(g) === admiral) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
    expect(slowest).toBeLessThan(1500)
  }, 60000)
})

describe('Gomoku and Pente', () => {
  it('wins with five in a row, in any direction', () => {
    let g = five.start('gomoku')
    const seq = [112, 0, 113, 1, 114, 2, 115, 3, 116]
    for (const i of seq) g = five.place(g, i)!
    expect(g.winner).toBe(1)
    expect(g.line.sort((a, b) => a - b)).toEqual([112, 113, 114, 115, 116])
    expect(five.place(g, 50)).toBeNull()
  })
  it('captures a flanked pair in Pente, and counts it', () => {
    const n = five.start('pente').n
    const at = (r: number, c: number) => r * n + c
    let h = five.start('pente')
    for (const i of [at(9, 5), at(9, 6), at(3, 3), at(9, 7)]) h = five.place(h, i)!
    h = five.place(h, at(9, 8))!
    expect(h.captures).toEqual([1, 0])
    expect(h.cells[at(9, 6)]).toBe(0)
    expect(h.cells[at(9, 7)]).toBe(0)
    expect(h.removed.sort((a, b) => a - b)).toEqual([at(9, 6), at(9, 7)])
  })
  it('the computer takes a win and blocks one', () => {
    for (const skill of SKILL_LIST) {
      let g = five.start('gomoku')
      for (const i of [112, 0, 113, 1, 114, 2, 115]) g = five.place(g, i)!
      // White (turn 2) must block the four at 111 or 116.
      const m = five.chooseMove(g, skill === 'cadet' ? 'captain' : skill, seededRng(3))!
      expect([111, 116]).toContain(m)
    }
    let g = five.start('gomoku')
    for (const i of [112, 0, 113, 1, 114, 2, 115, 3]) g = five.place(g, i)!
    expect([111, 116]).toContain(five.chooseMove(g, 'admiral', seededRng(4))!)
  })
  it('plays only empty points and finishes a game against itself', () => {
    for (const skill of ['captain', 'admiral'] as Skill[]) {
      let g = five.start('gomoku')
      const rng = seededRng(7)
      let guard = 0
      while (!g.winner && guard++ < 120) {
        const m = five.chooseMove(g, skill, rng)!
        expect(g.cells[m]).toBe(0)
        g = five.place(g, m)!
      }
      expect(g.moves).toBeGreaterThan(8)
    }
  })
})

describe('Hex', () => {
  it('detects a chain across the board for each side', () => {
    const n = 5
    const red = Array(25).fill(0)
    for (let r = 0; r < n; r++) red[r * n + 2] = 1
    expect(hex.chainOf(red, n, 1)).not.toBeNull()
    expect(hex.chainOf(red, n, 2)).toBeNull()
    const blue = Array(25).fill(0)
    for (let c = 0; c < n; c++) blue[2 * n + c] = 2
    expect(hex.chainOf(blue, n, 2)).not.toBeNull()
  })
  it('places only on empty hexes and ends the game on a join', () => {
    let g = hex.start(3)
    const seq = [1, 0, 4, 3, 7]
    for (const i of seq) g = hex.place(g, i)!
    expect(g.winner).toBe(1)
    expect(hex.place(g, 2)).toBeNull()
    expect(hex.place(hex.start(3), 0) && hex.place(hex.place(hex.start(3), 0)!, 0)).toBeNull()
  })
  it('the computer blocks a winning threat and the Admiral beats a random player', () => {
    // Red has three of four in a column on a 4x4; blue to move must block the end.
    let g = hex.start(4)
    for (const i of [0, 3, 4, 7, 8, 11]) g = hex.place(g, i)!
    // red: 0,4,8 (col 0 rows 0..2); next red move at 12 would win; blue to move.
    expect(hex.chooseMove(g, 'captain', seededRng(2))).toBe(12)
    let wins = 0
    for (let s = 1; s <= 4; s++) {
      const rng = seededRng(s * 5)
      let h = hex.start(5)
      const ai = s % 2 === 0 ? 1 : 2
      let guard = 0
      while (!h.winner && guard++ < 40) {
        const empties = h.cells.flatMap((v, i) => (v === 0 ? [i] : []))
        const m = h.turn === ai ? hex.chooseMove(h, 'admiral', rng)! : empties[Math.floor(rng() * empties.length)]
        h = hex.place(h, m)!
      }
      if (h.winner === ai) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
  })
})
