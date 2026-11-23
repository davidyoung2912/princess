import { search, type Skill } from './search'
import type { Rng } from './cards'

/**
 * Mancala in its Kalah form: six pits a side and a store at each end. Pick up all the seeds in one of your pits and sow them one at a time round the board (your store, not the
 * opponent's). Ending in your store gives another turn; ending in one of your empty pits captures the seeds opposite. When a side has no seeds left the other side keeps what remains.
 * Pits 0 to 5 are yours (left to right), 6 is your store, 7 to 12 are the computer's (right to left from your side), 13 its store.
 */
export type KalahSizeId = 'short' | 'classic' | 'long'
export const SEEDS: Record<KalahSizeId, number> = { short: 3, classic: 4, long: 6 }
export const SIZE_IDS: readonly KalahSizeId[] = ['short', 'classic', 'long']
export const STORE: [number, number] = [6, 13]

export interface Kalah { pits: number[]; turn: 0 | 1; over: boolean; last: number | null }
export const start = (seeds: number): Kalah => ({ pits: [...Array(6).fill(seeds), 0, ...Array(6).fill(seeds), 0], turn: 0, over: false, last: null })

export const pitsOf = (turn: 0 | 1): number[] => (turn === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12])
export const opposite = (i: number): number => 12 - i
export const legalMoves = (g: Kalah): number[] => (g.over ? [] : pitsOf(g.turn).filter((i) => g.pits[i] > 0))

export interface Sowing { game: Kalah; /** Each pit a seed was dropped into, in order. */ path: number[]; captured: { from: number; to: number; count: number } | null; extra: boolean }

export function sow(g: Kalah, pit: number): Sowing | null {
  if (!legalMoves(g).includes(pit)) return null
  const pits = g.pits.slice()
  const me = g.turn
  const skip = STORE[1 - me]
  let seeds = pits[pit]
  pits[pit] = 0
  let at = pit
  const path: number[] = []
  while (seeds > 0) {
    at = (at + 1) % 14
    if (at === skip) continue
    pits[at]++
    path.push(at)
    seeds--
  }
  let captured: Sowing['captured'] = null
  if (pitsOf(me).includes(at) && pits[at] === 1 && pits[opposite(at)] > 0) {
    const count = pits[opposite(at)] + 1
    pits[STORE[me]] += count
    captured = { from: opposite(at), to: at, count }
    pits[opposite(at)] = 0
    pits[at] = 0
  }
  const extra = at === STORE[me]
  let over = false
  if (pitsOf(0).every((i) => pits[i] === 0) || pitsOf(1).every((i) => pits[i] === 0)) {
    for (const t of [0, 1] as const) for (const i of pitsOf(t)) { pits[STORE[t]] += pits[i]; pits[i] = 0 }
    over = true
  }
  return { game: { pits, turn: over || extra ? me : ((1 - me) as 0 | 1), over, last: pit }, path, captured, extra: extra && !over }
}

export const scores = (g: Kalah): [number, number] => [g.pits[6], g.pits[13]]
export const winner = (g: Kalah): 0 | 1 | 2 => { const [a, b] = scores(g); return a === b ? 0 : a > b ? 1 : 2 }

const ctx = {
  moves: legalMoves,
  apply: (g: Kalah, m: number) => sow(g, m)!.game,
  player: (g: Kalah): 0 | 1 => g.turn,
  over: (g: Kalah) => g.over,
  value: (g: Kalah) => (g.pits[6] - g.pits[13]) * 10 + (pitsOf(0).reduce((a, i) => a + g.pits[i], 0) - pitsOf(1).reduce((a, i) => a + g.pits[i], 0)) * 0.5,
}

/** The computer's pit. Cadet looks a move or two ahead (and sometimes picks at random), Captain five moves, Admiral nine. */
export function chooseMove(g: Kalah, skill: Skill, rng: Rng = Math.random): number | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  if (skill === 'cadet' && rng() < 0.3) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 2 : skill === 'captain' ? 5 : 9
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 120000 : 30000 })
}
