import { search, type Skill } from './search'
import type { Rng } from './cards'

/**
 * Konane (Hawaiian checkers): a board filled with alternating black and white stones. Black starts by removing one stone (from the centre or a corner) and White removes a neighbouring one.
 * After that, each move jumps one of your stones, in a straight line (not diagonally), over an adjacent enemy stone into an empty square, removing it; a stone may keep jumping in the same
 * direction. The side that cannot jump loses.
 */
export type KonaneSizeId = 'six' | 'eight'
export const SIZES: Record<KonaneSizeId, number> = { six: 6, eight: 8 }
export const SIZE_IDS: readonly KonaneSizeId[] = ['six', 'eight']
export interface Konane { n: number; cells: (0 | 1 | 2)[]; turn: 1 | 2; winner: 0 | 1 | 2; /** Removing the first two stones comes before any jump. */ opening: 0 | 1 | 2; last: number[] }
export interface Move { path: number[]; captured: number[] }

/** Black is on the squares where row + column is even. */
export function start(n: number): Konane { return { n, cells: Array.from({ length: n * n }, (_, i) => ((Math.floor(i / n) + (i % n)) % 2 === 0 ? 1 : 2)), turn: 1, winner: 0, opening: 2, last: [] } }

/** The stones that may be removed at the start: for Black the two centre or two corner ones of its colour, then a neighbour of the hole for White. */
export function openingMoves(g: Konane): number[] {
  const { n } = g
  if (g.opening === 2) { const m = n / 2; const cands = [m * n + m, (m - 1) * n + (m - 1), 0, n * n - 1]; return cands.filter((i) => g.cells[i] === 1) }
  const hole = g.cells.findIndex((c) => c === 0)
  const r = Math.floor(hole / n), c = hole % n
  return [[-1, 0], [1, 0], [0, -1], [0, 1]].flatMap(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < n && cc >= 0 && cc < n && g.cells[rr * n + cc] === 2 ? [rr * n + cc] : [] })
}
export function remove(g: Konane, i: number): Konane | null {
  if (g.opening === 0 || !openingMoves(g).includes(i)) return null
  const cells = g.cells.slice()
  cells[i] = 0
  const opening = (g.opening - 1) as 0 | 1
  return { ...g, cells, turn: (3 - g.turn) as 1 | 2, opening, last: [i] }
}

function jumpsFrom(g: Konane, from: number): Move[] {
  const { n } = g
  const out: Move[] = []
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const path = [from], captured: number[] = []
    let r = Math.floor(from / n), c = from % n
    for (;;) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc
      if (tr < 0 || tr >= n || tc < 0 || tc >= n) break
      if (g.cells[mr * n + mc] !== 3 - g.turn || g.cells[tr * n + tc] !== 0) break
      captured.push(mr * n + mc); path.push(tr * n + tc)
      out.push({ path: path.slice(), captured: captured.slice() })
      r = tr; c = tc
    }
  }
  return out
}
export function legalMoves(g: Konane): Move[] {
  if (g.winner || g.opening) return []
  return g.cells.flatMap((p, i) => (p === g.turn ? jumpsFrom(g, i) : []))
}
export function jump(g: Konane, m: Move): Konane {
  const cells = g.cells.slice()
  const from = m.path[0], to = m.path[m.path.length - 1]
  cells[to] = cells[from]; cells[from] = 0
  for (const x of m.captured) cells[x] = 0
  const next: Konane = { ...g, cells, turn: (3 - g.turn) as 1 | 2, last: m.path }
  return legalMoves(next).length === 0 ? { ...next, winner: g.turn } : next
}
/** Every move for the side to move, whether it is still the opening (a removal, as a one-stone path) or a jump. */
export const allMoves = (g: Konane): Move[] => (g.opening ? openingMoves(g).map((i) => ({ path: [i], captured: [] })) : legalMoves(g))
export const step = (g: Konane, m: Move): Konane => (g.opening ? remove(g, m.path[0])! : jump(g, m))

const ctx = {
  moves: allMoves,
  apply: step,
  player: (g: Konane): 0 | 1 => (g.turn === 1 ? 0 : 1),
  over: (g: Konane) => g.winner !== 0,
  value: (g: Konane) => {
    if (g.winner) return g.winner === 1 ? 1e5 : -1e5
    const mine = (p: 1 | 2) => legalMoves({ ...g, turn: p }).length
    return mine(1) - mine(2)
  },
}
/** The computer's move. Cadet looks one move ahead (and sometimes plays at random), Captain three, Admiral five, judging positions by how many jumps each side has left. */
export function chooseMove(g: Konane, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = allMoves(g)
  if (moves.length === 0) return null
  if (skill === 'cadet' && rng() < 0.3) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 1 : skill === 'captain' ? 3 : 5
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 80000 : 20000 }) ?? moves[0]
}
