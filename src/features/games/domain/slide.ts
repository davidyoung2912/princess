import type { Rng } from './cards'

/** The sliding-tile puzzle: numbered tiles in a square with one blank; slide tiles into the blank until they read 1, 2, 3 ... in order with the blank last. Tapping a tile in the blank's row or column slides the whole line. */
export type SlideLevel = 'easy' | 'classic' | 'hard'
export const SLIDE_LEVELS: readonly SlideLevel[] = ['easy', 'classic', 'hard']
export const SIZE_OF: Record<SlideLevel, number> = { easy: 3, classic: 4, hard: 5 }

export const solved = (n: number): number[] => Array.from({ length: n * n }, (_, i) => (i === n * n - 1 ? 0 : i + 1))
export const isSolved = (t: readonly number[]): boolean => t.every((v, i) => v === (i === t.length - 1 ? 0 : i + 1))

/** One step: slides the tile at `i` (next to the blank) into it. */
const step = (t: number[], blank: number, i: number): void => { t[blank] = t[i]; t[i] = 0 }

export function neighbours(blank: number, n: number): number[] {
  const r = Math.floor(blank / n), c = blank % n
  return [r > 0 ? blank - n : -1, r < n - 1 ? blank + n : -1, c > 0 ? blank - 1 : -1, c < n - 1 ? blank + 1 : -1].filter((x) => x >= 0)
}

/** A shuffled board made by sliding tiles at random from the solved one, so it can always be solved. */
export function generate(n: number, rng: Rng = Math.random): number[] {
  for (;;) {
    const t = solved(n)
    let blank = n * n - 1
    let prev = -1
    for (let k = 0; k < 120 * n; k++) {
      const opts = neighbours(blank, n).filter((x) => x !== prev)
      const i = opts[Math.floor(rng() * opts.length)]
      step(t, blank, i)
      prev = blank
      blank = i
    }
    if (!isSolved(t)) return t
  }
}

/** The tiles that slide when tile `i` is tapped (the tiles between it and the blank, if they share a row or column), as board positions from the blank outward; empty if it cannot move. */
export function line(t: readonly number[], i: number, n: number): number[] {
  const blank = t.indexOf(0)
  if (i === blank) return []
  const r = Math.floor(i / n), c = i % n, br = Math.floor(blank / n), bc = blank % n
  if (r !== br && c !== bc) return []
  const stepBy = r === br ? (i > blank ? 1 : -1) : (i > blank ? n : -n)
  const out: number[] = []
  for (let k = blank + stepBy; ; k += stepBy) { out.push(k); if (k === i) break }
  return out
}

export function tap(t: readonly number[], i: number, n: number): number[] {
  const l = line(t, i, n)
  if (l.length === 0) return t as number[]
  const out = t.slice()
  let blank = t.indexOf(0)
  for (const k of l) { step(out, blank, k); blank = k }
  return out
}

const manhattan = (t: readonly number[], n: number): number => {
  let d = 0
  t.forEach((v, i) => { if (v) { const g = v - 1; d += Math.abs(Math.floor(g / n) - Math.floor(i / n)) + Math.abs((g % n) - (i % n)) } })
  return d
}

/** The next tile to tap, from a weighted A* search for a short way home; falls back to a move that brings the tiles closer if the search gives up. */
export function hint(t: readonly number[], n: number, limit = 120000): number | null {
  if (isSolved(t)) return null
  const key = (x: readonly number[]) => x.join(',')
  interface Node { t: number[]; g: number; f: number; first: number }
  const heap: Node[] = []
  const push = (nd: Node) => { heap.push(nd); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
  const pop = (): Node => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top }
  const seen = new Map<string, number>([[key(t), 0]])
  push({ t: t.slice(), g: 0, f: 3 * manhattan(t, n), first: -1 })
  let nodes = 0
  while (heap.length && nodes++ < limit) {
    const cur = pop()
    if (isSolved(cur.t)) return cur.first
    const blank = cur.t.indexOf(0)
    for (const i of neighbours(blank, n)) {
      const nx = cur.t.slice()
      step(nx, blank, i)
      const k = key(nx)
      const g = cur.g + 1
      if ((seen.get(k) ?? Infinity) <= g) continue
      seen.set(k, g)
      push({ t: nx, g, f: g + 3 * manhattan(nx, n), first: cur.first === -1 ? i : cur.first })
    }
  }
  const blank = t.indexOf(0)
  let best = -1, bestD = Infinity
  for (const i of neighbours(blank, n)) { const nx = t.slice(); step(nx, blank, i); const d = manhattan(nx, n); if (d < bestD) { bestD = d; best = i } }
  return best
}
