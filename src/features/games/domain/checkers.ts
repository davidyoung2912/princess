import { search, type Skill } from './search'
import type { Rng } from './cards'

/**
 * English draughts (checkers) on an 8 by 8 board, twelve men each, played on the dark squares. Men move one square diagonally forward; kings go both ways. A jump over an enemy piece
 * into the empty square behind it captures the piece, and a capture is compulsory; after a jump the same piece must keep jumping if it can. A man reaching the far row is crowned and its
 * turn ends. You lose when you have no piece or no move. Forty moves with no capture or man move is a draw. Red moves first, up the board.
 */
export const N = 8
export type Piece = 0 | 1 | 2 | 3 | 4 // empty, red man, black man, red king, black king
export type Side = 1 | 2
export interface Checkers { board: Piece[]; turn: Side; winner: 0 | 1 | 2 | 3; last: number[]; quiet: number }
export interface Move { path: number[]; captured: number[] }

export function start(): Checkers {
  const board = Array<Piece>(64).fill(0)
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2 === 1) board[r * N + c] = r < 3 ? 2 : r > 4 ? 1 : 0
  return { board, turn: 1, winner: 0, last: [], quiet: 0 }
}
export const sideOf = (p: Piece): 0 | 1 | 2 => (p === 1 || p === 3 ? 1 : p === 2 || p === 4 ? 2 : 0)
const isKing = (p: Piece) => p === 3 || p === 4
const dirsOf = (p: Piece): number[] => (isKing(p) ? [-1, 1] : p === 1 ? [-1] : [1])

function jumpsFrom(board: readonly Piece[], from: number, p: Piece, taken: number[], path: number[], out: Move[]): void {
  const r = Math.floor(from / N), c = from % N
  let any = false
  for (const dr of dirsOf(p)) for (const dc of [-1, 1]) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc
    if (tr < 0 || tr >= N || tc < 0 || tc >= N) continue
    const mid = mr * N + mc, to = tr * N + tc
    if (sideOf(board[mid]) === 0 || sideOf(board[mid]) === sideOf(p) || taken.includes(mid)) continue
    if (board[to] !== 0 && to !== path[0]) continue
    any = true
    const crowned = !isKing(p) && ((p === 1 && tr === 0) || (p === 2 && tr === N - 1))
    if (crowned) out.push({ path: [...path, to], captured: [...taken, mid] })
    else jumpsFrom(board, to, p, [...taken, mid], [...path, to], out)
  }
  if (!any && taken.length) out.push({ path, captured: taken })
}

export function legalMoves(g: Checkers): Move[] {
  if (g.winner) return []
  const jumps: Move[] = []
  const steps: Move[] = []
  g.board.forEach((p, i) => {
    if (sideOf(p) !== g.turn) return
    jumpsFrom(g.board, i, p, [], [i], jumps)
    const r = Math.floor(i / N), c = i % N
    for (const dr of dirsOf(p)) for (const dc of [-1, 1]) {
      const tr = r + dr, tc = c + dc
      if (tr >= 0 && tr < N && tc >= 0 && tc < N && g.board[tr * N + tc] === 0) steps.push({ path: [i, tr * N + tc], captured: [] })
    }
  })
  return jumps.length ? jumps : steps
}

export function apply(g: Checkers, m: Move): Checkers {
  const board = g.board.slice()
  const from = m.path[0], to = m.path[m.path.length - 1]
  let p = board[from]
  board[from] = 0
  for (const x of m.captured) board[x] = 0
  const row = Math.floor(to / N)
  if (p === 1 && row === 0) p = 3
  else if (p === 2 && row === N - 1) p = 4
  board[to] = p
  const next: Checkers = { board, turn: (3 - g.turn) as Side, winner: 0, last: m.path, quiet: m.captured.length || !isKing(g.board[from]) ? 0 : g.quiet + 1 }
  if (legalMoves(next).length === 0) return { ...next, winner: g.turn }
  if (next.quiet >= 40) return { ...next, winner: 3 }
  return next
}

export const countOf = (g: Checkers, s: Side): number => g.board.filter((p) => sideOf(p) === s).length

function value(g: Checkers): number {
  if (g.winner === 1) return 1e5
  if (g.winner === 2) return -1e5
  if (g.winner === 3) return 0
  let v = 0
  g.board.forEach((p, i) => {
    if (!p) return
    const r = Math.floor(i / N), c = i % N
    const edge = c === 0 || c === N - 1 ? 2 : 0
    const base = isKing(p) ? 160 : 100 + (p === 1 ? N - 1 - r : r) * 4
    const x = base + edge + (isKing(p) ? 0 : (p === 1 && r === N - 1) || (p === 2 && r === 0) ? 6 : 0)
    v += sideOf(p) === 1 ? x : -x
  })
  return v
}

const ctx = { moves: legalMoves, apply, player: (g: Checkers): 0 | 1 => (g.turn === 1 ? 0 : 1), over: (g: Checkers) => g.winner !== 0, value }

/** The computer's move: Cadet looks two moves ahead and sometimes slips, Captain five, Admiral nine; jumps are compulsory for everyone. */
export function chooseMove(g: Checkers, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]
  if (skill === 'cadet' && rng() < 0.3) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 2 : skill === 'captain' ? 5 : 9
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 90000 : 25000 }) ?? moves[0]
}
