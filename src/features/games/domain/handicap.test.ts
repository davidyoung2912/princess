import { describe, expect, it } from 'vitest'
import * as bt from './breakthrough'
import { seededRng } from './cards'
import * as ck from './checkers'
import * as c4 from './connect4'
import * as five from './fiveRow'
import { HANDICAPS, stepsOf } from './handicap'
import * as hex from './hex'
import * as morris from './morris'
import * as rev from './reversi'
import * as yacht from './yacht'

describe('handicaps and quick games', () => {
  it('steps: none, one, two', () => expect(HANDICAPS.map(stepsOf)).toEqual([0, 1, 2]))
  it('gives the player a head start in each game', () => {
    const corners = (g: rev.Reversi) => [0, 63].filter((i) => g.board[i] === 1).length
    expect(HANDICAPS.map((h) => corners(rev.withHandicap(rev.start(), h)))).toEqual([0, 1, 2])
    const count = (g: ck.Checkers, s: 1 | 2) => ck.countOf(g, s)
    expect(HANDICAPS.map((h) => count(ck.withHandicap(ck.start(), h), 2))).toEqual([12, 11, 10])
    expect(count(ck.withHandicap(ck.start(), 'none', true), 1)).toBe(8)
    expect(count(ck.withHandicap(ck.start(), 'large', true), 2)).toBe(6)
    expect(HANDICAPS.map((h) => c4.withHandicap(c4.start(), h).cells.filter((x) => x === 1).length)).toEqual([0, 1, 2])
    expect(HANDICAPS.map((h) => hex.withHandicap(hex.start(7), h).cells.filter((x) => x === 1).length)).toEqual([0, 1, 2])
    expect(HANDICAPS.map((h) => bt.countOf(bt.withHandicap(bt.start(8), h), 2))).toEqual([16, 15, 14])
    const stones = (h: 'none' | 'small' | 'large') => five.withHandicap(five.start('gomoku'), h).cells.filter((x) => x === 1).length
    expect(HANDICAPS.map(stones)).toEqual([0, 1, 2])
    expect(five.withHandicap(five.start('gomoku'), 'small').turn).toBe(2)
  })
  it('quick games are shorter', () => {
    expect(morris.startQuick().toPlace).toEqual([6, 6])
    expect(five.withHandicap(five.start('pente'), 'none', true).captureWin).toBe(3)
    expect(five.withHandicap(five.start('gomoku'), 'none', true).captureWin).toBe(5)
    const g = yacht.start(6)
    let cur = g
    const rng = seededRng(3)
    let guard = 0
    while (!yacht.isOver(cur) && guard++ < 100) cur = yacht.act(cur, yacht.choose(cur, 'captain', rng), rng)
    expect(cur.cards.map((c) => c.filter((x) => x !== null).length)).toEqual([6, 6])
  })
  it('the computer still plays legal games from a handicapped start', () => {
    let g = ck.withHandicap(ck.start(), 'large', true)
    let guard = 0
    while (!g.winner && guard++ < 200) { const m = ck.chooseMove(g, 'captain', seededRng(guard))!; expect(ck.legalMoves(g)).toContainEqual(m); g = ck.apply(g, m) }
    expect(g.winner).not.toBe(0)
    let b = bt.withHandicap(bt.start(6), 'large')
    guard = 0
    while (!b.winner && guard++ < 200) b = bt.apply(b, bt.chooseMove(b, 'captain', seededRng(guard))!)
    expect(b.winner).not.toBe(0)
    let p = five.withHandicap(five.start('pente'), 'small', true)
    guard = 0
    while (!p.winner && guard++ < 400) p = five.place(p, five.chooseMove(p, 'captain', seededRng(guard))!)!
    expect(p.moves).toBeGreaterThan(5)
  }, 120000)
})
