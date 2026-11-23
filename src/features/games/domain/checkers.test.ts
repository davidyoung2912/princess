import { describe, expect, it } from 'vitest'
import * as ck from './checkers'
import { seededRng } from './cards'
import { SKILL_LIST } from './search'

describe('Checkers', () => {
  it('sets up twelve men each and red has seven opening moves', () => {
    const g = ck.start()
    expect(ck.countOf(g, 1)).toBe(12)
    expect(ck.countOf(g, 2)).toBe(12)
    expect(ck.legalMoves(g)).toHaveLength(7)
  })
  it('makes jumps compulsory, continues multi-jumps and crowns', () => {
    const g = ck.start()
    const board = Array(64).fill(0) as ck.Piece[]
    board[5 * 8 + 2] = 1; board[4 * 8 + 3] = 2; board[2 * 8 + 3] = 2; board[7 * 8 + 0] = 1
    const m = ck.legalMoves({ ...g, board })
    expect(m).toHaveLength(1)
    expect(m[0].captured).toHaveLength(2) // double jump
    const after = ck.apply({ ...g, board }, m[0])
    expect(after.board[m[0].path[m[0].path.length - 1]]).toBe(1)
    const crown = Array(64).fill(0) as ck.Piece[]
    crown[8 + 2] = 1; crown[7 * 8 + 6] = 2
    const c = ck.apply({ ...g, board: crown }, { path: [10, 3], captured: [] })
    expect(c.board[3]).toBe(3)
  })
  it('ends the game when a side has no moves', () => {
    const g = ck.start()
    const board = Array(64).fill(0) as ck.Piece[]
    board[2 * 8 + 1] = 2; board[5 * 8 + 4] = 1
    const next = ck.apply({ ...g, board }, { path: [37, 28], captured: [] })
    expect(next.winner).toBe(0)
    const last = Array(64).fill(0) as ck.Piece[]
    last[10] = 1; last[3] = 2
    expect(ck.apply({ ...g, board: last }, { path: [10, 1], captured: [] }).winner).toBe(0)
  })
  it('plays whole games with legal moves for every strength, and the Admiral beats a random mover', () => {
    for (const skill of SKILL_LIST) {
      const rng = seededRng(3 + skill.length)
      let g = ck.start()
      let guard = 0
      while (!g.winner && guard++ < 200) { const m = ck.chooseMove(g, skill, rng)!; expect(ck.legalMoves(g)).toContainEqual(m); g = ck.apply(g, m) }
      expect(guard).toBeGreaterThan(8)
    }
    let wins = 0
    for (let s = 1; s <= 4; s++) {
      const rng = seededRng(s * 17)
      let g = ck.start()
      const ai = s % 2 ? 1 : 2
      let guard = 0
      while (!g.winner && guard++ < 160) {
        const ms = ck.legalMoves(g)
        g = ck.apply(g, g.turn === ai ? ck.chooseMove(g, 'admiral', rng)! : ms[Math.floor(rng() * ms.length)])
      }
      if (g.winner === ai) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
  }, 120000)
})
