import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Dots and Boxes: players take turns drawing one line between two neighbouring dots. Whoever draws the fourth side of a box takes it and moves again. Most boxes wins.
 * Lines are numbered: the horizontal ones row by row, then the vertical ones row by row.
 */
export type DotsSizeId = 'small' | 'medium' | 'large'
export const SIZES: Record<DotsSizeId, number> = { small: 3, medium: 4, large: 5 }
export const SIZE_IDS: readonly DotsSizeId[] = ['small', 'medium', 'large']

export interface Dots { w: number; h: number; edges: boolean[]; owner: (0 | 1 | 2)[]; turn: 1 | 2; scores: [number, number]; last: number | null; /** Boxes taken by the last move. */ taken: number[] }

export const hCount = (w: number, h: number): number => (h + 1) * w
export const start = (n: number): Dots => ({ w: n, h: n, edges: Array((n + 1) * n * 2).fill(false), owner: Array(n * n).fill(0), turn: 1, scores: [0, 0], last: null, taken: [] })

/** The four lines round box (r, c): top, bottom, left, right. */
export const sidesOf = (w: number, h: number, box: number): [number, number, number, number] => {
  const r = Math.floor(box / w), c = box % w, H = hCount(w, h)
  return [r * w + c, (r + 1) * w + c, H + r * (w + 1) + c, H + r * (w + 1) + c + 1]
}
/** The one or two boxes a line borders. */
export function boxesOf(w: number, h: number, e: number): number[] {
  const H = hCount(w, h)
  if (e < H) { const r = Math.floor(e / w), c = e % w; return [r > 0 ? (r - 1) * w + c : -1, r < h ? r * w + c : -1].filter((x) => x >= 0) }
  const k = e - H, r = Math.floor(k / (w + 1)), c = k % (w + 1)
  return [c > 0 ? r * w + c - 1 : -1, c < w ? r * w + c : -1].filter((x) => x >= 0)
}
export const filled = (g: Dots, box: number): number => sidesOf(g.w, g.h, box).filter((e) => g.edges[e]).length

export function play(g: Dots, e: number): Dots | null {
  if (e < 0 || e >= g.edges.length || g.edges[e] || isOver(g)) return null
  const edges = g.edges.slice()
  edges[e] = true
  const owner = g.owner.slice()
  const taken: number[] = []
  for (const b of boxesOf(g.w, g.h, e)) if (owner[b] === 0 && sidesOf(g.w, g.h, b).every((k) => edges[k])) { owner[b] = g.turn; taken.push(b) }
  const scores: [number, number] = [g.scores[0], g.scores[1]]
  scores[g.turn - 1] += taken.length
  return { ...g, edges, owner, scores, last: e, taken, turn: taken.length ? g.turn : ((3 - g.turn) as 1 | 2) }
}
export const isOver = (g: Dots): boolean => g.owner.every((o) => o !== 0)
export const winner = (g: Dots): 0 | 1 | 2 => (g.scores[0] === g.scores[1] ? 0 : g.scores[0] > g.scores[1] ? 1 : 2)
export const freeEdges = (g: Dots): number[] => g.edges.flatMap((x, i) => (x ? [] : [i]))

/** Lines that take a box now. */
const takers = (g: Dots): number[] => freeEdges(g).filter((e) => boxesOf(g.w, g.h, e).some((b) => g.owner[b] === 0 && filled(g, b) === 3))
/** Lines that do not leave any box with three sides for the opponent. */
const safe = (g: Dots): number[] => freeEdges(g).filter((e) => boxesOf(g.w, g.h, e).every((b) => g.owner[b] !== 0 || filled(g, b) < 2))

/** Takes every box that can be taken, and returns the position and how many boxes that was. */
function takeAll(g: Dots): { game: Dots; n: number } {
  let cur = g
  let n = 0
  for (;;) {
    const t = takers(cur)
    if (t.length === 0) return { game: cur, n }
    const next = play(cur, t[0])!
    n += next.taken.length
    cur = next
  }
}

/**
 * The computer's line, from the board only. Cadet takes boxes most of the time and otherwise draws almost anywhere; Captain takes boxes and avoids giving the opponent a third side;
 * Admiral also keeps control at the end: when only long chains are left it takes all but two boxes of a chain and hands the opponent the last two, so the opponent has to open the next chain.
 */
export function chooseMove(g: Dots, skill: Skill, rng: Rng = Math.random): number | null {
  const free = freeEdges(g)
  if (free.length === 0) return null
  const pick = (xs: number[]) => xs[Math.floor(rng() * xs.length)]
  const t = takers(g)
  if (skill === 'cadet') {
    if (t.length && rng() < 0.8) return pick(t)
    const s = safe(g)
    return pick(s.length && rng() < 0.7 ? s : free)
  }
  if (t.length) {
    if (skill === 'admiral') {
      const handout = doubleDeal(g)
      if (handout !== null) return handout
    }
    return t[0]
  }
  const s = safe(g)
  if (s.length) return pick(s)
  // Every line gives something away: give the least.
  let best = free[0], bestN = Infinity
  for (const e of free.map((x) => ({ x, k: rng() })).sort((a, b) => a.k - b.k).map((y) => y.x)) {
    const after = play(g, e)!
    const n = takeAll(after).n
    if (n < bestN) { bestN = n; best = e }
  }
  return best
}

/**
 * When one chain is left to take and the rest are all long chains, taking the last two boxes would hand the opponent control. Instead, with two boxes left in the chain, return the
 * far line of the last box (a double-deal): the opponent takes both boxes with one line but then has to open the next chain. Null in every other case, meaning "just take the box".
 */
function doubleDeal(g: Dots): number | null {
  const t = takers(g)
  if (t.length !== 1) return null
  const { game: after, n } = takeAll(g)
  if (n !== 2 || isOver(after) || safe(after).length > 0) return null
  const e = t[0]
  const a = boxesOf(g.w, g.h, e).find((x) => g.owner[x] === 0 && filled(g, x) === 3)
  const b = boxesOf(g.w, g.h, e).find((x) => x !== a && g.owner[x] === 0)
  if (a === undefined || b === undefined) return null
  const far = sidesOf(g.w, g.h, b).filter((k) => !g.edges[k] && k !== e)
  return far.length === 1 ? far[0] : null
}
