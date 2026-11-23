import type { Rng } from './cards'

/** Peg solitaire (Hi-Q): jump a peg over a neighbour into an empty hole, taking the peg jumped, until one is left. Three boards: English cross, French cross and triangle. */
export type PegBoard = 'english' | 'french' | 'triangle'
export const PEG_BOARDS: readonly PegBoard[] = ['english', 'french', 'triangle']

export interface Jump { from: number; over: number; to: number }
export interface Layout { id: PegBoard; /** Hole positions as [row, col] on a grid (the triangle uses col 0..row). */ holes: [number, number][]; jumps: Jump[]; /** The hole that starts empty. */ start: number; rows: number; cols: number }

const build = (id: PegBoard, holes: [number, number][], dirs: [number, number][], rows: number, cols: number, startAt: [number, number]): Layout => {
  const at = new Map(holes.map(([r, c], i) => [`${r},${c}`, i]))
  const jumps: Jump[] = []
  holes.forEach(([r, c], from) => {
    for (const [dr, dc] of dirs) {
      const over = at.get(`${r + dr},${c + dc}`)
      const to = at.get(`${r + 2 * dr},${c + 2 * dc}`)
      if (over !== undefined && to !== undefined) jumps.push({ from, over, to })
    }
  })
  return { id, holes, jumps, start: at.get(`${startAt[0]},${startAt[1]}`)!, rows, cols }
}

const square: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]]
const cross = (lens: number[]): [number, number][] => lens.flatMap((len, r) => Array.from({ length: len }, (_, k) => [r, (7 - len) / 2 + k] as [number, number]))
export const LAYOUTS: Record<PegBoard, Layout> = {
  english: build('english', cross([3, 3, 7, 7, 7, 3, 3]).filter(() => true), square, 7, 7, [3, 3]),
  french: build('french', cross([3, 5, 7, 7, 7, 5, 3]), square, 7, 7, [3, 3]),
  triangle: build('triangle', Array.from({ length: 5 }, (_, r) => Array.from({ length: r + 1 }, (_, c) => [r, c] as [number, number])).flat(), [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]], 5, 5, [2, 1]),
}

export type Pegs = boolean[]
export const start = (b: PegBoard): Pegs => LAYOUTS[b].holes.map((_, i) => i !== LAYOUTS[b].start)
export const count = (p: Pegs): number => p.filter(Boolean).length
export const movesOf = (b: PegBoard, p: Pegs): Jump[] => LAYOUTS[b].jumps.filter((j) => p[j.from] && p[j.over] && !p[j.to])
export function jump(p: Pegs, j: Jump): Pegs {
  const n = p.slice()
  n[j.from] = false
  n[j.over] = false
  n[j.to] = true
  return n
}
export const isWon = (p: Pegs): boolean => count(p) === 1
export const isStuck = (b: PegBoard, p: Pegs): boolean => count(p) > 1 && movesOf(b, p).length === 0
/** Whether the last peg is in the starting hole, the classic perfect finish. */
export const isPerfect = (b: PegBoard, p: Pegs): boolean => isWon(p) && p[LAYOUTS[b].start]

const spread = (L: Layout, p: Pegs): number => {
  const [cr, cc] = L.holes[L.start]
  let d = 0
  p.forEach((on, i) => { if (on) { const [r, c] = L.holes[i]; d += (r - cr) ** 2 + (c - cc) ** 2 } })
  return d
}

/** A jump that can still lead to a single peg, found by depth-first search with a memory of dead ends; null if none is found within `limit` positions. */
export function solve(b: PegBoard, p: Pegs, limit = 150000, rng: Rng = Math.random): Jump[] | null {
  const L = LAYOUTS[b]
  const dead = new Set<string>()
  let nodes = 0
  const key = (x: Pegs) => x.map((v) => (v ? '1' : '0')).join('')
  const go = (x: Pegs, path: Jump[]): Jump[] | null => {
    if (isWon(x)) return path
    if (nodes++ > limit) return null
    const k = key(x)
    if (dead.has(k)) return null
    // Try first the jumps that leave the pegs most tightly gathered round the middle; ties are broken at random.
    const ms = movesOf(b, x).map((m) => ({ m, r: spread(L, jump(x, m)) + rng() * 0.5 })).sort((a2, c) => a2.r - c.r).map((y) => y.m)
    for (const m of ms) {
      const r = go(jump(x, m), [...path, m])
      if (r) return r
    }
    if (nodes <= limit) dead.add(k)
    return null
  }
  return go(p, [])
}

/** How the finish is described, from the pegs left. */
export const rating = (left: number): 'genius' | 'excellent' | 'good' | 'ok' | 'again' => (left === 1 ? 'genius' : left === 2 ? 'excellent' : left === 3 ? 'good' : left <= 5 ? 'ok' : 'again')
