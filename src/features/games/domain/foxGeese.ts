import { search, type Skill } from './search'
import type { Rng } from './cards'

/**
 * Fox and Geese on the cross-shaped board of 33 points. One fox against thirteen geese. Geese step forward (up) or sideways, never back; the fox steps in any of the four directions
 * and captures a goose by jumping over it into an empty point. The geese win by trapping the fox so it cannot move; the fox wins by taking enough geese that they can no longer trap it.
 */
export const N = 7
export const valid = (i: number): boolean => { const r = Math.floor(i / N), c = i % N; return (r >= 2 && r <= 4) || (c >= 2 && c <= 4) }
export const GEESE_LEFT_TO_WIN_FOX = 6
export type Piece = 0 | 1 | 2 // empty, fox, goose
export type Side = 'fox' | 'geese'
export interface FoxGeese { board: Piece[]; turn: Side; winner: '' | Side; captured: number; last: number | null; moves: number }
export interface Move { from: number; to: number; jumped: number | null }

export function start(): FoxGeese {
  const board = Array<Piece>(49).fill(0)
  board[3 * N + 3] = 1
  for (let r = 4; r <= 6; r++) for (let c = 0; c < N; c++) if (valid(r * N + c) && (r === 4 || (c >= 2 && c <= 4))) board[r * N + c] = 2
  return { board, turn: 'geese', winner: '', captured: 0, last: null, moves: 0 }
}
export const geese = (g: FoxGeese): number => g.board.filter((x) => x === 2).length
export const foxAt = (g: FoxGeese): number => g.board.indexOf(1)

const step = (i: number, dr: number, dc: number): number => { const r = Math.floor(i / N) + dr, c = (i % N) + dc; return r < 0 || r >= N || c < 0 || c >= N ? -1 : valid(r * N + c) ? r * N + c : -1 }

export function legalMoves(g: FoxGeese): Move[] {
  if (g.winner) return []
  const out: Move[] = []
  if (g.turn === 'fox') {
    const f = foxAt(g)
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const a = step(f, dr, dc)
      if (a < 0) continue
      if (g.board[a] === 0) out.push({ from: f, to: a, jumped: null })
      else if (g.board[a] === 2) { const b = step(a, dr, dc); if (b >= 0 && g.board[b] === 0) out.push({ from: f, to: b, jumped: a }) }
    }
    return out
  }
  g.board.forEach((x, i) => {
    if (x !== 2) return
    for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1]]) { const a = step(i, dr, dc); if (a >= 0 && g.board[a] === 0) out.push({ from: i, to: a, jumped: null }) }
  })
  return out
}

export function apply(g: FoxGeese, m: Move): FoxGeese {
  const board = g.board.slice()
  board[m.to] = board[m.from]
  board[m.from] = 0
  let captured = g.captured
  if (m.jumped !== null) { board[m.jumped] = 0; captured++ }
  const next: FoxGeese = { board, turn: g.turn === 'fox' ? 'geese' : 'fox', winner: '', captured, last: m.to, moves: g.moves + 1 }
  if (13 - captured < GEESE_LEFT_TO_WIN_FOX) return { ...next, winner: 'fox' }
  const replies = legalMoves(next)
  if (replies.length === 0) return { ...next, winner: g.turn }
  return next
}

/** Moves the fox could make next, for judging how hemmed in it is. */
const foxMobility = (g: FoxGeese): number => legalMoves({ ...g, turn: 'fox', winner: '' }).length

function value(g: FoxGeese): number {
  if (g.winner) return g.winner === 'fox' ? 100000 : -100000
  const f = foxAt(g)
  let v = g.captured * 400 + foxMobility(g) * 12
  let advance = 0
  g.board.forEach((x, i) => { if (x === 2) advance += 6 - Math.floor(i / N) })
  v -= advance * 3
  // The fox does best in the open and near the geese; geese do best close together.
  const fr = Math.floor(f / N)
  v -= Math.abs(fr - 3) * 2
  return v
}

const ctx = { moves: legalMoves, apply, player: (g: FoxGeese): 0 | 1 => (g.turn === 'fox' ? 0 : 1), over: (g: FoxGeese) => g.winner !== '', value }

export function chooseMove(g: FoxGeese, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  if (skill === 'cadet' && rng() < 0.3) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 2 : skill === 'captain' ? 4 : 6
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 70000 : 20000 })
}
