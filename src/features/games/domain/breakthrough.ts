import { search, type Skill } from './search'
import type { Rng } from './cards'
import { stepsOf, type Handicap } from './handicap'

/**
 * Breakthrough: each side starts with two rows of pawns. A pawn steps one square straight ahead onto an empty square, or diagonally ahead onto an empty square or an enemy pawn (capturing it).
 * The first side to reach the far row wins, and so does capturing every enemy pawn. White (you) starts at the bottom and moves up; there are no draws.
 */
export type BreakSizeId = 'small' | 'medium' | 'large'
export const SIZES: Record<BreakSizeId, number> = { small: 6, medium: 7, large: 8 }
export const SIZE_IDS: readonly BreakSizeId[] = ['small', 'medium', 'large']
export interface Breakthrough { n: number; cells: (0 | 1 | 2)[]; turn: 1 | 2; winner: 0 | 1 | 2; last: [number, number] | null }
export interface Move { from: number; to: number }

export function start(n: number): Breakthrough {
  const cells = Array<0 | 1 | 2>(n * n).fill(0)
  for (let c = 0; c < n; c++) { cells[c] = 2; cells[n + c] = 2; cells[(n - 1) * n + c] = 1; cells[(n - 2) * n + c] = 1 }
  return { n, cells, turn: 1, winner: 0, last: null }
}
/** A head start for white (the player): the computer starts without one or two back-row pawns. */
export function withHandicap(g: Breakthrough, h: Handicap): Breakthrough {
  const cells = g.cells.slice()
  for (const c of [1, g.n - 2].slice(0, stepsOf(h))) cells[c] = 0
  return { ...g, cells }
}

export function legalMoves(g: Breakthrough): Move[] {
  if (g.winner) return []
  const { n } = g
  const dr = g.turn === 1 ? -1 : 1
  const out: Move[] = []
  g.cells.forEach((p, from) => {
    if (p !== g.turn) return
    const r = Math.floor(from / n) + dr, c = from % n
    if (r < 0 || r >= n) return
    if (g.cells[r * n + c] === 0) out.push({ from, to: r * n + c })
    for (const dc of [-1, 1]) { const cc = c + dc; if (cc >= 0 && cc < n && g.cells[r * n + cc] !== g.turn) out.push({ from, to: r * n + cc }) }
  })
  return out
}
export function apply(g: Breakthrough, m: Move): Breakthrough {
  const cells = g.cells.slice()
  cells[m.to] = g.turn
  cells[m.from] = 0
  const row = Math.floor(m.to / g.n)
  const reached = (g.turn === 1 && row === 0) || (g.turn === 2 && row === g.n - 1)
  const wiped = !cells.includes((3 - g.turn) as 1 | 2)
  return { ...g, cells, turn: (3 - g.turn) as 1 | 2, winner: reached || wiped ? g.turn : 0, last: [m.from, m.to] }
}
export const countOf = (g: Breakthrough, p: 1 | 2): number => g.cells.filter((x) => x === p).length

function value(g: Breakthrough): number {
  if (g.winner === 1) return 1e5
  if (g.winner === 2) return -1e5
  const n = g.n
  let v = 0
  g.cells.forEach((p, i) => {
    if (!p) return
    const r = Math.floor(i / n)
    const adv = p === 1 ? n - 1 - r : r
    const x = 100 + adv * adv * 3 + (adv >= n - 3 ? 40 : 0) + ((p === 1 && r === n - 1) || (p === 2 && r === 0) ? 12 : 0)
    v += p === 1 ? x : -x
  })
  return v
}
const ctx = { moves: legalMoves, apply, player: (g: Breakthrough): 0 | 1 => (g.turn === 1 ? 0 : 1), over: (g: Breakthrough) => g.winner !== 0, value }

/** The computer's move. It always takes a winning step and stops an enemy pawn two steps from home; Cadet looks one move ahead, Captain three, Admiral four. */
export function chooseMove(g: Breakthrough, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  for (const m of moves) if (apply(g, m).winner === g.turn) return m
  if (skill === 'cadet' && rng() < 0.3) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 1 : skill === 'captain' ? 3 : 4
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 80000 : 20000 })
}
