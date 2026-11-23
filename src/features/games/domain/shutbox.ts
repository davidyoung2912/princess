import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Shut the Box: a row of numbered tiles stands open. Roll two dice (one die once the open tiles total six or less) and close any tiles that add up to the roll. When no tiles can
 * close, your turn ends and the tiles still open are your score. Each side takes a turn at a fresh box; the lowest score wins.
 */
export type BoxSizeId = 'nine' | 'ten' | 'twelve'
export const SIZES: Record<BoxSizeId, number> = { nine: 9, ten: 10, twelve: 12 }
export const SIZE_IDS: readonly BoxSizeId[] = ['nine', 'ten', 'twelve']
export interface Box { n: number; open: number[]; dice: number[]; /** Each side's score once its turn is over. */ scores: [number | null, number | null]; turn: 0 | 1 }

export const start = (n: number): Box => ({ n, open: Array.from({ length: n }, (_, i) => i + 1), dice: [], scores: [null, null], turn: 0 })
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)
export const oneDie = (open: readonly number[]): boolean => sum(open) <= 6
export const rollDice = (open: readonly number[], rng: Rng = Math.random): number[] => (oneDie(open) ? [1 + Math.floor(rng() * 6)] : [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)])

/** Every set of open tiles that adds up to `target`. */
export function combos(open: readonly number[], target: number): number[][] {
  const out: number[][] = []
  const go = (i: number, left: number, cur: number[]) => {
    if (left === 0) { out.push(cur); return }
    for (let k = i; k < open.length && open[k] <= left; k++) go(k + 1, left - open[k], [...cur, open[k]])
  }
  go(0, target, [])
  return out
}
export const rollFor = (g: Box, dice: number[]): Box => ({ ...g, dice })
export const canMove = (g: Box): boolean => g.dice.length > 0 && combos(g.open, sum(g.dice)).length > 0
export const isOver = (g: Box): boolean => g.scores[0] !== null && g.scores[1] !== null
export const winner = (g: Box): 0 | 1 | 2 => { const [a, b] = g.scores as [number, number]; return a === b ? 0 : a < b ? 1 : 2 }

/** Closes the tiles `tiles` (they must add up to the roll). */
export function close(g: Box, tiles: number[]): Box | null {
  if (sum(tiles) !== sum(g.dice) || tiles.some((x) => !g.open.includes(x)) || new Set(tiles).size !== tiles.length) return null
  const open = g.open.filter((x) => !tiles.includes(x))
  if (open.length === 0) return endTurn({ ...g, open, dice: [] }, true)
  return { ...g, open, dice: [] }
}
/** Ends this side's turn: its score is the total of the open tiles (nothing if the box was shut), and the other side gets a fresh box. */
export function endTurn(g: Box, shut = false): Box {
  const scores: [number | null, number | null] = [g.scores[0], g.scores[1]]
  scores[g.turn] = shut ? 0 : sum(g.open)
  return { ...g, scores, turn: scores[1 - g.turn] === null ? ((1 - g.turn) as 0 | 1) : g.turn, open: Array.from({ length: g.n }, (_, i) => i + 1), dice: [] }
}

/** Expected final score from each set of open tiles (as a bitmask) when every roll is answered as well as possible. Used by the Admiral. */
const EXPECT = new Map<number, Float64Array>()
function expectation(n: number): Float64Array {
  const hit = EXPECT.get(n)
  if (hit) return hit
  const E = new Float64Array(1 << n)
  const tiles = (mask: number) => Array.from({ length: n }, (_, i) => i + 1).filter((v) => mask & (1 << (v - 1)))
  for (let mask = 0; mask < 1 << n; mask++) {
    const open = tiles(mask)
    const own = sum(open)
    let exp = 0
    const rolls: [number, number][] = []
    if (oneDie(open)) for (let a = 1; a <= 6; a++) rolls.push([a, 1 / 6])
    else for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) rolls.push([a + b, 1 / 36])
    for (const [r, p] of rolls) {
      const cs = combos(open, r)
      if (cs.length === 0) { exp += p * own; continue }
      let best = Infinity
      for (const c of cs) { let m = mask; for (const x of c) m &= ~(1 << (x - 1)); best = Math.min(best, E[m]) }
      exp += p * best
    }
    E[mask] = exp
  }
  EXPECT.set(n, E)
  return E
}
const maskOf = (open: readonly number[]) => open.reduce((m, v) => m | (1 << (v - 1)), 0)

/** Which tiles to close. Cadet picks any way at random; Captain closes the highest tiles it can (keeping the small, flexible ones); Admiral picks the way with the lowest expected final score. */
export function choose(g: Box, skill: Skill, rng: Rng = Math.random): number[] | null {
  const cs = combos(g.open, sum(g.dice))
  if (cs.length === 0) return null
  if (skill === 'cadet') return cs[Math.floor(rng() * cs.length)]
  if (skill === 'captain') return cs.slice().sort((a, b) => Math.max(...b) - Math.max(...a) || a.length - b.length)[0]
  const E = expectation(g.n)
  let best = cs[0], bestV = Infinity
  for (const c of cs) { const v = E[maskOf(g.open.filter((x) => !c.includes(x)))] + rng() * 1e-6; if (v < bestV) { bestV = v; best = c } }
  return best
}
