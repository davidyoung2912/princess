import type { Rng } from './cards'
import type { Skill } from './search'
import { stepsOf, type Handicap } from './handicap'

/** Hex on an n by n rhombus of hexagons. Red joins the top and bottom edges, Blue joins left and right; players alternate colouring an empty hex, and the first to join their sides wins (there is never a draw). */
export type HexSizeId = 'small' | 'medium' | 'large'
export const SIZES: Record<HexSizeId, number> = { small: 7, medium: 9, large: 11 }
export const SIZE_IDS: readonly HexSizeId[] = ['small', 'medium', 'large']
export interface Hex { n: number; cells: (0 | 1 | 2)[]; turn: 1 | 2; last: number | null; winner: 0 | 1 | 2; moves: number; /** The winning chain. */ chain: number[] }

/** A head start for red (the player): one or two hexagons already claimed in the middle. */
export function withHandicap(g: Hex, h: Handicap): Hex {
  const cells = g.cells.slice()
  const m = Math.floor(g.n / 2)
  const spots = [m * g.n + m, (m - 1) * g.n + m].slice(0, stepsOf(h))
  for (const i of spots) cells[i] = 1
  return { ...g, cells, moves: g.moves + spots.length }
}

export const start = (n: number): Hex => ({ n, cells: Array(n * n).fill(0), turn: 1, last: null, winner: 0, moves: 0, chain: [] })

export function neighbours(i: number, n: number): number[] {
  const r = Math.floor(i / n), c = i % n
  const out: number[] = []
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [-1, 1], [1, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc) }
  return out
}

/** A chain of `p` hexes joining its two sides, or null. */
export function chainOf(cells: readonly number[], n: number, p: 1 | 2): number[] | null {
  const prev = new Map<number, number>()
  const queue: number[] = []
  for (let k = 0; k < n; k++) { const i = p === 1 ? k : k * n; if (cells[i] === p) { prev.set(i, -1); queue.push(i) } }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h]
    if ((p === 1 && Math.floor(i / n) === n - 1) || (p === 2 && i % n === n - 1)) { const path: number[] = []; for (let x = i; x !== -1; x = prev.get(x)!) path.push(x); return path }
    for (const j of neighbours(i, n)) if (cells[j] === p && !prev.has(j)) { prev.set(j, i); queue.push(j) }
  }
  return null
}

export function place(g: Hex, i: number): Hex | null {
  if (g.winner || g.cells[i] !== 0) return null
  const cells = g.cells.slice()
  cells[i] = g.turn
  const chain = chainOf(cells, g.n, g.turn)
  return { ...g, cells, turn: (3 - g.turn) as 1 | 2, last: i, winner: chain ? g.turn : 0, chain: chain ?? [], moves: g.moves + 1 }
}

/** The share of random games finished from here that `me` wins, if `me` has just played (so the other side moves next). */
function winRate(cells: number[], n: number, empties: number[], me: 1 | 2, trials: number, rng: Rng): number {
  let wins = 0
  const order = empties.slice()
  const work = cells.slice()
  for (let t = 0; t < trials; t++) {
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [order[k], order[j]] = [order[j], order[k]] }
    for (let k = 0; k < order.length; k++) work[order[k]] = k % 2 === 0 ? 3 - me : me
    const redWins = chainOf(work, n, 1) !== null
    if ((redWins ? 1 : 2) === me) wins++
  }
  return wins / trials
}

/** The computer's move: it takes a win or blocks one, then plays out many random games from each candidate and picks the one that wins most. Cadet plays few games, Admiral many. */
export function chooseMove(g: Hex, skill: Skill, rng: Rng = Math.random): number | null {
  const { n, cells } = g
  const empties = cells.flatMap((v, i) => (v === 0 ? [i] : []))
  if (empties.length === 0) return null
  const me = g.turn, them = (3 - g.turn) as 1 | 2
  if (g.moves === 0) return Math.floor(n / 2) * n + Math.floor(n / 2)
  for (const i of empties) { const c = cells.slice(); c[i] = me; if (chainOf(c, n, me)) return i }
  const blocks = empties.filter((i) => { const c = cells.slice(); c[i] = them; return chainOf(c, n, them) !== null })
  if (blocks.length && skill !== 'cadet') return blocks[0]
  if (skill === 'cadet' && rng() < 0.45) return empties[Math.floor(rng() * empties.length)]
  const near = (i: number) => { const r = Math.floor(i / n), c = i % n; return cells.some((v, j) => v !== 0 && Math.abs(Math.floor(j / n) - r) <= 2 && Math.abs((j % n) - c) <= 2) }
  let cand = empties.length > 40 ? empties.filter(near) : empties
  if (cand.length === 0) cand = empties
  const trials = skill === 'cadet' ? 3 : skill === 'captain' ? 14 : 45
  let best = cand[0], bestV = -1
  for (const i of cand) {
    const c = cells.slice()
    c[i] = me
    const rest = empties.filter((x) => x !== i)
    const v = winRate(c, n, rest, me, trials, rng) + rng() * 0.02
    if (v > bestV) { bestV = v; best = i }
  }
  return best
}
