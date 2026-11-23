import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Nim: several heaps of counters. On your turn take as many counters as you like from one heap (at least one). In the normal game whoever takes the last counter wins; in the misère game
 * whoever takes the last counter loses. The perfect strategy comes from the nim-sum (the XOR of the heap sizes); the opponents play it with a chance of a random slip.
 */
export type NimSizeId = 'three' | 'four' | 'five'
export const SIZES: Record<NimSizeId, number[]> = { three: [1, 3, 5], four: [1, 3, 5, 7], five: [1, 3, 5, 7, 9] }
export const SIZE_IDS: readonly NimSizeId[] = ['three', 'four', 'five']
export type Rule = 'normal' | 'misere'
export const RULES: readonly Rule[] = ['normal', 'misere']
export interface Nim { heaps: number[]; rule: Rule; turn: 1 | 2; winner: 0 | 1 | 2; last: { heap: number; take: number } | null }
export interface Move { heap: number; take: number }

export const start = (heaps: number[], rule: Rule): Nim => ({ heaps: heaps.slice(), rule, turn: 1, winner: 0, last: null })
export const legalMoves = (g: Nim): Move[] => g.winner ? [] : g.heaps.flatMap((n, heap) => Array.from({ length: n }, (_, k) => ({ heap, take: k + 1 })))
export function apply(g: Nim, m: Move): Nim | null {
  if (g.winner || m.heap < 0 || m.heap >= g.heaps.length || m.take < 1 || m.take > g.heaps[m.heap]) return null
  const heaps = g.heaps.slice()
  heaps[m.heap] -= m.take
  const empty = heaps.every((n) => n === 0)
  const winner: 0 | 1 | 2 = empty ? (g.rule === 'normal' ? g.turn : ((3 - g.turn) as 1 | 2)) : 0
  return { ...g, heaps, winner, turn: (3 - g.turn) as 1 | 2, last: { heap: m.heap, take: m.take } }
}
export const nimSum = (heaps: readonly number[]): number => heaps.reduce((a, b) => a ^ b, 0)

/** A perfect move, or null if the position is already lost against perfect play. */
export function perfectMove(g: Nim): Move | null {
  const big = g.heaps.filter((n) => n > 1).length
  if (g.rule === 'misere' && big <= 1) {
    // Leave an odd number of single counters.
    const ones = g.heaps.filter((n) => n === 1).length
    const h = g.heaps.findIndex((n) => n > 1)
    if (h >= 0) return { heap: h, take: g.heaps[h] - (ones % 2 === 0 ? 1 : 0) }
    if (ones % 2 === 0) return null
    return { heap: g.heaps.indexOf(1), take: 1 }
  }
  const x = nimSum(g.heaps)
  if (x === 0) return null
  for (let heap = 0; heap < g.heaps.length; heap++) { const target = g.heaps[heap] ^ x; if (target < g.heaps[heap]) return { heap, take: g.heaps[heap] - target } }
  return null
}

/** The computer's move. Admiral never slips; Captain plays a random legal move one time in five; Cadet half the time. A lost position is met with a small take, to prolong the game. */
export function chooseMove(g: Nim, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  const slip = skill === 'cadet' ? 0.5 : skill === 'captain' ? 0.2 : 0
  if (rng() < slip) return moves[Math.floor(rng() * moves.length)]
  const best = perfectMove(g)
  if (best) return best
  const h = g.heaps.reduce((bi, n, i) => (n > g.heaps[bi] ? i : bi), 0)
  return { heap: h, take: 1 }
}
