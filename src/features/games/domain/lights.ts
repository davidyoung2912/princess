import type { Rng } from './cards'

/** Lights Out: tapping a tile flips it and its neighbours up, down, left and right; switch every light off. Puzzles are made by pressing tiles on a dark board, so every one can be solved. */
export type LightsLevel = 'easy' | 'medium' | 'hard'
export const LIGHTS_LEVELS: readonly LightsLevel[] = ['easy', 'medium', 'hard']
export const SIZE_OF: Record<LightsLevel, number> = { easy: 4, medium: 5, hard: 6 }
export const SCRAMBLE_OF: Record<LightsLevel, number> = { easy: 5, medium: 9, hard: 16 }

export const neighbours = (i: number, n: number): number[] => {
  const r = Math.floor(i / n), c = i % n
  return [i, r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((x) => x >= 0)
}
export function press(b: readonly boolean[], i: number, n: number): boolean[] {
  const out = b.slice()
  for (const k of neighbours(i, n)) out[k] = !out[k]
  return out
}
export const isOff = (b: readonly boolean[]): boolean => b.every((x) => !x)

export function generate(level: LightsLevel, rng: Rng = Math.random): boolean[] {
  const n = SIZE_OF[level]
  for (;;) {
    let b = Array<boolean>(n * n).fill(false)
    const chosen = new Set<number>()
    while (chosen.size < Math.min(SCRAMBLE_OF[level], n * n - 1)) chosen.add(Math.floor(rng() * n * n))
    for (const i of chosen) b = press(b, i, n)
    if (!isOff(b)) return b
  }
}

/** The fewest tiles to press to turn everything off (Gaussian elimination over GF(2), then the lightest of the solutions), or null if the board cannot be solved. */
export function solution(b: readonly boolean[], n: number): number[] | null {
  const m = n * n
  // Row i of the matrix: which presses toggle cell i; the last column is the light.
  const rows: number[][] = Array.from({ length: m }, (_, i) => { const r = Array<number>(m + 1).fill(0); for (const k of neighbours(i, n)) r[k] = 1; r[m] = b[i] ? 1 : 0; return r })
  const pivots: number[] = []
  let row = 0
  for (let col = 0; col < m && row < m; col++) {
    let p = row
    while (p < m && rows[p][col] === 0) p++
    if (p === m) continue
    ;[rows[row], rows[p]] = [rows[p], rows[row]]
    for (let r = 0; r < m; r++) if (r !== row && rows[r][col]) for (let k = col; k <= m; k++) rows[r][k] ^= rows[row][k]
    pivots.push(col)
    row++
  }
  for (let r = row; r < m; r++) if (rows[r][m]) return null
  const free = Array.from({ length: m }, (_, c) => c).filter((c) => !pivots.includes(c))
  let best: number[] | null = null
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = Array<number>(m).fill(0)
    free.forEach((c, k) => { x[c] = (mask >> k) & 1 })
    pivots.forEach((c, r) => { let v = rows[r][m]; free.forEach((f, k) => { if ((mask >> k) & 1) v ^= rows[r][f] }); x[c] = v })
    const pressed = x.flatMap((v, i) => (v ? [i] : []))
    if (!best || pressed.length < best.length) best = pressed
  }
  return best
}
