import { search, type Skill } from './search'
import type { Rng } from './cards'

/** Reversi (Othello): 8 by 8, black and white discs. A move must trap a line of the opponent's discs between the new disc and one of your own, and those discs flip. A side with no move passes; the game ends when neither can move. */
export const N = 8
export type Disc = 0 | 1 | 2 // empty, black, white
export interface Reversi { board: Disc[]; turn: 1 | 2; last: number | null; /** The side that just had to pass, if any. */ passed: 0 | 1 | 2 }

const DIRS: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]

export function start(): Reversi {
  const board = Array<Disc>(64).fill(0)
  board[27] = 2; board[36] = 2; board[28] = 1; board[35] = 1
  return { board, turn: 1, last: null, passed: 0 }
}

/** The discs a move at `i` would flip for `p`. Empty when it is not a legal move. */
export function flipsFor(board: readonly Disc[], i: number, p: 1 | 2): number[] {
  if (board[i] !== 0) return []
  const r0 = Math.floor(i / N), c0 = i % N
  const out: number[] = []
  for (const [dr, dc] of DIRS) {
    const run: number[] = []
    let r = r0 + dr, c = c0 + dc
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === 3 - p) { run.push(r * N + c); r += dr; c += dc }
    if (run.length && r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === p) out.push(...run)
  }
  return out
}
export const legalMoves = (board: readonly Disc[], p: 1 | 2): number[] => board.flatMap((_, i) => (flipsFor(board, i, p).length ? [i] : []))

export const counts = (board: readonly Disc[]): { black: number; white: number } => ({ black: board.filter((d) => d === 1).length, white: board.filter((d) => d === 2).length })
export const isOver = (g: Reversi): boolean => legalMoves(g.board, 1).length === 0 && legalMoves(g.board, 2).length === 0
export const winner = (g: Reversi): 0 | 1 | 2 => { const c = counts(g.board); return c.black === c.white ? 0 : c.black > c.white ? 1 : 2 }

/** Plays a move for the side to move; returns the discs flipped and the new position (the other side passes if it has no move), or null if illegal. */
export function play(g: Reversi, i: number): { game: Reversi; flipped: number[] } | null {
  const flipped = flipsFor(g.board, i, g.turn)
  if (flipped.length === 0) return null
  const board = g.board.slice()
  board[i] = g.turn
  for (const f of flipped) board[f] = g.turn
  const other = (3 - g.turn) as 1 | 2
  if (legalMoves(board, other).length) return { game: { board, turn: other, last: i, passed: 0 }, flipped }
  if (legalMoves(board, g.turn).length) return { game: { board, turn: g.turn, last: i, passed: other }, flipped }
  return { game: { board, turn: other, last: i, passed: 0 }, flipped }
}

const W = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
]

/** Value for black: positions on the board, mobility, and the final count once the game is over. */
function value(g: Reversi): number {
  const c = counts(g.board)
  if (isOver(g)) return (c.black - c.white) * 1000
  let v = 0
  g.board.forEach((d, i) => { if (d === 1) v += W[i]; else if (d === 2) v -= W[i] })
  v += (legalMoves(g.board, 1).length - legalMoves(g.board, 2).length) * 6
  const empties = 64 - c.black - c.white
  if (empties < 10) v += (c.black - c.white) * 8
  return v
}

const ctx = {
  moves: (g: Reversi) => legalMoves(g.board, g.turn),
  apply: (g: Reversi, i: number) => play(g, i)!.game,
  player: (g: Reversi): 0 | 1 => (g.turn === 1 ? 0 : 1),
  over: isOver,
  value,
}

/** The computer's move. Cadet takes the move that flips most (and sometimes just any move); Captain looks three moves ahead; Admiral looks four (and to the end of the game when few squares are left), weighing corners and mobility. */
export function chooseMove(g: Reversi, skill: Skill, rng: Rng = Math.random): number | null {
  const moves = legalMoves(g.board, g.turn)
  if (moves.length === 0) return null
  if (skill === 'cadet') {
    if (rng() < 0.35) return moves[Math.floor(rng() * moves.length)]
    return moves.map((m) => ({ m, k: flipsFor(g.board, m, g.turn).length + rng() })).sort((a, b) => b.k - a.k)[0].m
  }
  const empties = g.board.filter((d) => d === 0).length
  const depth = skill === 'captain' ? 3 : empties <= 9 ? 8 : 4
  return search(g, depth, ctx, { rng, limit: skill === 'captain' ? 6000 : empties <= 9 ? 60000 : 25000 })
}
