import { search, type Skill } from './search'
import type { Rng } from './cards'

/**
 * Brandubh, the small Irish cousin of Hnefatafl, on a 7 by 7 board. Four defenders and a king guard the throne in the centre against eight attackers. Every piece slides like a rook.
 * The king wins by reaching a corner; the attackers win by capturing the king. A piece is captured when it is trapped between two enemies in a straight line (a corner or the empty
 * throne also counts against it). Only the king may stop on a corner or the throne. A side with no move loses. The attackers move first.
 */
export const N = 7
export const THRONE = 24
export const CORNERS = [0, 6, 42, 48]
export type Piece = 0 | 1 | 2 | 3 // empty, attacker, defender, king
export type Side = 'attackers' | 'defenders'
export interface Brandubh { board: Piece[]; turn: Side; winner: '' | Side; last: number | null; captured: number[]; moves: number }
export interface Move { from: number; to: number }

export function start(): Brandubh {
  const board = Array<Piece>(49).fill(0)
  for (const [r, c] of [[0, 3], [1, 3], [5, 3], [6, 3], [3, 0], [3, 1], [3, 5], [3, 6]]) board[r * N + c] = 1
  for (const [r, c] of [[2, 3], [4, 3], [3, 2], [3, 4]]) board[r * N + c] = 2
  board[THRONE] = 3
  return { board, turn: 'attackers', winner: '', last: null, captured: [], moves: 0 }
}

export const sideOf = (p: Piece): Side | '' => (p === 1 ? 'attackers' : p === 2 || p === 3 ? 'defenders' : '')
const restricted = (i: number) => CORNERS.includes(i)

/** The squares the piece on `from` can slide to. */
export function destinations(g: Brandubh, from: number): number[] {
  const p = g.board[from]
  if (!p) return []
  const out: number[] = []
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let r = Math.floor(from / N) + dr, c = (from % N) + dc
    while (r >= 0 && r < N && c >= 0 && c < N && g.board[r * N + c] === 0) {
      const i = r * N + c
      if (p === 3 || (!restricted(i) && i !== THRONE)) out.push(i)
      r += dr; c += dc
    }
  }
  return out
}

export function legalMoves(g: Brandubh): Move[] {
  if (g.winner) return []
  const mine = (p: Piece) => sideOf(p) === g.turn
  return g.board.flatMap((p, from) => (mine(p) ? destinations(g, from).map((to) => ({ from, to })) : []))
}

export function apply(g: Brandubh, m: Move): Brandubh {
  const board = g.board.slice()
  board[m.to] = board[m.from]
  board[m.from] = 0
  const mover = g.turn
  const captured: number[] = []
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = Math.floor(m.to / N) + dr, c = (m.to % N) + dc
    const r2 = r + dr, c2 = c + dc
    if (r < 0 || r >= N || c < 0 || c >= N || r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) continue
    const a = r * N + c, b = r2 * N + c2
    const victim = sideOf(board[a])
    if (victim === '' || victim === mover) continue
    const anvil = sideOf(board[b]) === mover || restricted(b) || (b === THRONE && board[b] === 0)
    if (anvil) captured.push(a)
  }
  let kingTaken = false
  for (const a of captured) { if (board[a] === 3) kingTaken = true; board[a] = 0 }
  const next: Brandubh = { board, turn: mover === 'attackers' ? 'defenders' : 'attackers', winner: '', last: m.to, captured, moves: g.moves + 1 }
  if (kingTaken) return { ...next, winner: 'attackers' }
  if (board[m.to] === 3 && restricted(m.to)) return { ...next, winner: 'defenders' }
  if (legalMoves(next).length === 0) return { ...next, winner: mover }
  return next
}

const kingAt = (g: Brandubh): number => g.board.indexOf(3)

function value(g: Brandubh): number {
  if (g.winner) return g.winner === 'attackers' ? 100000 : -100000
  const k = kingAt(g)
  let v = 0
  for (const p of g.board) v += p === 1 ? 14 : p === 2 ? -22 : 0
  // The king reaching a corner next move is nearly decisive; a clear line to two corners cannot be stopped.
  const open = destinations(g, k).filter((i) => CORNERS.includes(i)).length
  v -= open * 4000
  const kr = Math.floor(k / N), kc = k % N
  const dist = Math.min(...CORNERS.map((c) => Math.abs(Math.floor(c / N) - kr) + Math.abs((c % N) - kc)))
  v += dist * 6
  v -= destinations(g, k).length * 3
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const r = kr + dr, c = kc + dc; if (r >= 0 && r < N && c >= 0 && c < N && g.board[r * N + c] === 1) v += 9 }
  return v
}

const ctx = { moves: legalMoves, apply, player: (g: Brandubh): 0 | 1 => (g.turn === 'attackers' ? 0 : 1), over: (g: Brandubh) => g.winner !== '', value }

export function chooseMove(g: Brandubh, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  for (const m of moves) { const n = apply(g, m); if (n.winner === g.turn) return m }
  if (skill === 'cadet' && rng() < 0.35) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 1 : skill === 'captain' ? 2 : 3
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 60000 : 15000 })
}
