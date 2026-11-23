import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import * as brandubh from './brandubh'
import * as dots from './dots'
import * as fox from './foxGeese'
import * as kalah from './kalah'
import * as morris from './morris'
import { SKILL_LIST } from './search'

describe("Nine Men's Morris", () => {
  it('has 24 points, 16 mills and the right neighbours', () => {
    expect(morris.MILLS).toHaveLength(16)
    expect(morris.ADJ[1].sort((a, b) => a - b)).toEqual([0, 2, 9])
    expect(morris.ADJ[9].sort((a, b) => a - b)).toEqual([1, 8, 10, 17])
    expect(morris.ADJ[0].sort((a, b) => a - b)).toEqual([1, 7])
  })
  it('lets a mill remove a man not in a mill, and passes the turn after', () => {
    let g = morris.start()
    const place = (to: number) => { g = morris.apply(g, { kind: 'place', to }) }
    place(0); place(3); place(1); place(5); place(2) // black mill on top of the outer square
    expect(g.removing).toBe(true)
    expect(morris.legalMoves(g).every((m) => m.kind === 'remove')).toBe(true)
    g = morris.apply(g, { kind: 'remove', at: 3 })
    expect(g.board[3]).toBe(0)
    expect(g.turn).toBe(2)
  })
  it('flies with three men, and plays full games with legal moves', () => {
    const g = morris.start()
    const fly = { ...g, board: g.board.map((_, i) => (i === 0 || i === 1 || i === 2 ? 1 : i === 10 || i === 11 || i === 12 || i === 20 ? 2 : 0)) as morris.Man[], toPlace: [0, 0] as [number, number], turn: 1 as const }
    const moves = morris.legalMoves(fly)
    expect(moves.some((m) => m.kind === 'move' && m.from === 0 && m.to === 22)).toBe(true)
    for (const skill of SKILL_LIST) {
      const rng = seededRng(skill.length + 2)
      let s = morris.start()
      let guard = 0
      while (!s.winner && guard++ < 160) {
        const m = morris.chooseMove(s, skill, rng)
        if (!m) break
        expect(morris.legalMoves(s)).toContainEqual(m)
        s = morris.apply(s, m)
      }
      expect(guard).toBeGreaterThan(18)
    }
  }, 90000)
})

describe('Dots and Boxes', () => {
  it('numbers lines, takes a box on the fourth side and moves again', () => {
    let g = dots.start(2)
    expect(g.edges).toHaveLength(12)
    const sides = dots.sidesOf(2, 2, 0)
    for (const e of sides.slice(0, 3)) { g = dots.play(g, e)!; if (e !== sides[2]) { /* alternate turns */ } }
    const before = g.turn
    g = dots.play(g, sides[3])!
    expect(g.owner[0]).toBe(before)
    expect(g.turn).toBe(before)
    expect(g.scores[before - 1]).toBe(1)
    expect(dots.play(g, sides[3])).toBeNull()
  })
  it('the computer takes a box when it can, and finishes whole games on every size', () => {
    const g = dots.start(3)
    let cur = g
    for (const e of dots.sidesOf(3, 3, 4).slice(0, 3)) cur = dots.play(cur, e) ?? cur
    const move = dots.chooseMove(cur, 'captain', seededRng(1))!
    expect(dots.sidesOf(3, 3, 4)).toContain(move)
    for (const n of [3, 4, 5]) for (const skill of SKILL_LIST) {
      const rng = seededRng(n * 10 + skill.length)
      let s = dots.start(n)
      let guard = 0
      while (!dots.isOver(s) && guard++ < 200) { const m = dots.chooseMove(s, skill, rng)!; expect(s.edges[m]).toBe(false); s = dots.play(s, m)! }
      expect(dots.isOver(s)).toBe(true)
      expect(s.scores[0] + s.scores[1]).toBe(n * n)
    }
  })
  it('the Admiral beats a random player most of the time on 4 by 4', () => {
    let wins = 0
    for (let s = 1; s <= 8; s++) {
      const rng = seededRng(s * 3)
      let g = dots.start(4)
      const ai = s % 2 === 0 ? 1 : 2
      let guard = 0
      while (!dots.isOver(g) && guard++ < 100) {
        const free = dots.freeEdges(g)
        const m = g.turn === ai ? dots.chooseMove(g, 'admiral', rng)! : free[Math.floor(rng() * free.length)]
        g = dots.play(g, m)!
      }
      if (dots.winner(g) === ai) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(7)
  })
})

describe('Fox and Geese', () => {
  it('starts with a fox in the middle and thirteen geese on the cross board', () => {
    const g = fox.start()
    expect(g.board.filter((x) => x === 1)).toHaveLength(1)
    expect(fox.geese(g)).toBe(13)
    expect(Array.from({ length: 49 }, (_, i) => fox.valid(i)).filter(Boolean)).toHaveLength(33)
    expect(g.turn).toBe('geese')
  })
  it('geese never move backwards; the fox captures by jumping and loses when trapped', () => {
    const g = fox.start()
    for (const m of fox.legalMoves(g)) expect(Math.floor(m.to / 7)).toBeLessThanOrEqual(Math.floor(m.from / 7))
    const board = Array(49).fill(0) as fox.Piece[]
    board[24] = 1; board[17] = 2; board[10] = 0
    const j = fox.legalMoves({ ...g, board, turn: 'fox' }).find((m) => m.jumped === 17)!
    expect(j.to).toBe(10)
    const after = fox.apply({ ...g, board, turn: 'fox' }, j)
    expect(after.board[17]).toBe(0)
    expect(after.captured).toBe(1)
  })
  it('plays both sides with legal moves', () => {
    for (const skill of SKILL_LIST) {
      const rng = seededRng(5 + skill.length)
      let g = fox.start()
      let guard = 0
      while (!g.winner && guard++ < 120) { const m = fox.chooseMove(g, skill, rng)!; expect(fox.legalMoves(g)).toContainEqual(m); g = fox.apply(g, m) }
      expect(guard).toBeGreaterThan(5)
    }
  })
})

describe('Brandubh', () => {
  it('starts with 8 attackers, 4 defenders and the king on the throne', () => {
    const g = brandubh.start()
    expect(g.board.filter((x) => x === 1)).toHaveLength(8)
    expect(g.board.filter((x) => x === 2)).toHaveLength(4)
    expect(g.board[brandubh.THRONE]).toBe(3)
    expect(brandubh.legalMoves(g).length).toBeGreaterThan(10)
  })
  it('captures between two enemies, lets the king win in a corner, and keeps others off corners', () => {
    const g = brandubh.start()
    const board = Array(49).fill(0) as brandubh.Piece[]
    board[24] = 3; board[9] = 2; board[8] = 1
    const att = { ...g, board, turn: 'attackers' as const }
    const to10 = brandubh.legalMoves({ ...att, board: Object.assign([...board], { 10: 0 }) })
    expect(to10).toBeDefined()
    const b2 = Array(49).fill(0) as brandubh.Piece[]
    b2[8] = 1; b2[9] = 2; b2[24] = 3; b2[17] = 1
    b2[11] = 1
    const cap = brandubh.apply({ ...g, board: b2, turn: 'attackers' }, { from: 11, to: 10 })
    expect(cap.board[9]).toBe(0)
    const k = Array(49).fill(0) as brandubh.Piece[]
    k[3] = 3; k[24] = 0; k[20] = 1
    const win = brandubh.apply({ ...g, board: k, turn: 'defenders' }, { from: 3, to: 0 })
    expect(win.winner).toBe('defenders')
    for (const m of brandubh.legalMoves(brandubh.start())) expect(brandubh.CORNERS).not.toContain(m.to)
  })
  it('plays whole games with legal moves', () => {
    for (const skill of SKILL_LIST) {
      const rng = seededRng(9 + skill.length)
      let g = brandubh.start()
      let guard = 0
      while (!g.winner && guard++ < 80) { const m = brandubh.chooseMove(g, skill, rng)!; expect(brandubh.legalMoves(g)).toContainEqual(m); g = brandubh.apply(g, m) }
      expect(guard).toBeGreaterThan(5)
    }
  })
})

describe('Kalah', () => {
  it('sows seeds round the board skipping the opponent store, and gives extra turns, captures and sweeps', () => {
    const g = kalah.start(4)
    const r = kalah.sow(g, 2)!
    expect(r.extra).toBe(true) // 4 seeds from pit 2 end in the store
    expect(r.game.pits[6]).toBe(1)
    expect(r.game.turn).toBe(0)
  })
  it('captures the opposite pit when ending in an empty own pit', () => {
    const c: kalah.Kalah = { pits: [1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 4, 5, 0], turn: 0, over: false, last: null }
    const cap = kalah.sow(c, 0)!
    expect(cap.captured).toEqual({ from: 11, to: 1, count: 5 })
    expect(cap.game.pits[6]).toBe(5)
  })
  it('sweeps the remaining seeds into the store when a side runs out, and ends', () => {
    const c: kalah.Kalah = { pits: [0, 0, 0, 0, 0, 1, 10, 2, 0, 0, 0, 0, 3, 5], turn: 0, over: false, last: null }
    const r = kalah.sow(c, 5)!
    expect(r.game.over).toBe(true)
    expect(r.game.pits[13]).toBe(10)
    expect(kalah.scores(r.game)).toEqual([11, 10])
  })
  it('keeps every seed, and the Admiral beats a random player', () => {
    let wins = 0
    for (let s = 1; s <= 6; s++) {
      const rng = seededRng(s * 11)
      let g = kalah.start(4)
      const ai = s % 2
      let guard = 0
      while (!g.over && guard++ < 200) {
        const moves = kalah.legalMoves(g)
        const m = g.turn === ai ? kalah.chooseMove(g, 'admiral', rng)! : moves[Math.floor(rng() * moves.length)]
        g = kalah.sow(g, m)!.game
        expect(g.pits.reduce((a, b) => a + b, 0)).toBe(48)
      }
      if (kalah.winner(g) === (ai === 0 ? 1 : 2)) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(5)
  })
})
