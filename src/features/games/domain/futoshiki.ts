import { bit, count, only, shuffle, type Difficulty } from './sudoku'

/**
 * Futoshiki: an n by n Latin square (each digit once in every row and column) with greater-than and less-than signs
 * between neighbouring squares, and a few given digits. Cells hold 0 (empty) or a digit 1 to n. Framework-free so it can be tested in node.
 */

export type FutoshikiGrid = readonly number[]

/** The square `lo` holds a smaller digit than the square `hi`; the two are neighbours. */
export interface Sign { lo: number; hi: number }

/** Board size, and how many digits at least stay given (the signs are thinned as far as logic allows). */
export const FUTOSHIKI_LEVELS: Record<Difficulty, { size: number; minGivens: number }> = {
  easy: { size: 4, minGivens: 4 },
  medium: { size: 5, minGivens: 4 },
  hard: { size: 6, minGivens: 3 },
  expert: { size: 7, minGivens: 0 },
}

const allMask = (n: number) => (1 << n) - 1
const rowOf = (i: number, n: number) => Math.floor(i / n)
const colOf = (i: number, n: number) => i % n

/** Every row then every column of an n by n grid, as lists of cell indexes. */
export interface Line { kind: 'row' | 'column'; no: number; cells: number[] }
export function linesOf(n: number): Line[] {
  return [
    ...Array.from({ length: n }, (_, r) => ({ kind: 'row' as const, no: r, cells: Array.from({ length: n }, (_, c) => r * n + c) })),
    ...Array.from({ length: n }, (_, c) => ({ kind: 'column' as const, no: c, cells: Array.from({ length: n }, (_, r) => r * n + c) })),
  ]
}

/** A random Latin square, filled square by square with backtracking. */
export function latinSquare(n: number, random: () => number = Math.random): number[] {
  const g = Array(n * n).fill(0)
  const fill = (i: number): boolean => {
    if (i === n * n) return true
    const r = rowOf(i, n)
    const c = colOf(i, n)
    for (const d of shuffle(Array.from({ length: n }, (_, k) => k + 1), random)) {
      let ok = true
      for (let k = 0; k < n && ok; k++) if (g[r * n + k] === d || g[k * n + c] === d) ok = false
      if (!ok) continue
      g[i] = d
      if (fill(i + 1)) return true
      g[i] = 0
    }
    return false
  }
  fill(0)
  return g
}

/** Every pair of neighbouring squares, across then down, with the sign the solution gives it. */
export function allSigns(solution: FutoshikiGrid, n: number): Sign[] {
  const signs: Sign[] = []
  const add = (a: number, b: number) => signs.push(solution[a] < solution[b] ? { lo: a, hi: b } : { lo: b, hi: a })
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c < n - 1) add(r * n + c, r * n + c + 1)
    if (r < n - 1) add(r * n + c, (r + 1) * n + c)
  }
  return signs
}

const lowest = (mask: number) => (mask ? only(mask & -mask) : 0)
const highest = (mask: number) => (mask ? only(mask) : 0)

/** What each square could still be: its row and column rule out placed digits, and (with `useSigns`) the signs trim the ends until nothing changes. */
export function candidatesOf(grid: FutoshikiGrid, n: number, signs: readonly Sign[], useSigns = true): number[] {
  const cand = Array(n * n).fill(0)
  const rowSeen = Array(n).fill(0)
  const colSeen = Array(n).fill(0)
  grid.forEach((v, i) => { if (v) { rowSeen[rowOf(i, n)] |= bit(v); colSeen[colOf(i, n)] |= bit(v) } })
  for (let i = 0; i < n * n; i++) cand[i] = grid[i] ? bit(grid[i]) : allMask(n) & ~rowSeen[rowOf(i, n)] & ~colSeen[colOf(i, n)]
  if (!useSigns) return cand
  for (let changed = true; changed;) {
    changed = false
    for (const { lo, hi } of signs) {
      if (!cand[lo] || !cand[hi]) continue
      const nextHi = cand[hi] & ~((1 << lowest(cand[lo])) - 1)
      const nextLo = cand[lo] & ((1 << (highest(cand[hi]) - 1)) - 1)
      if (nextHi !== cand[hi]) { cand[hi] = nextHi; changed = true }
      if (nextLo !== cand[lo]) { cand[lo] = nextLo; changed = true }
    }
  }
  return cand
}

export type FutoshikiTechnique = 'naked' | 'row' | 'column' | 'sign' | 'signRow' | 'signColumn'
export type Direction = 'above' | 'below' | 'left' | 'right'

export interface Move { index: number; value: number; technique: FutoshikiTechnique; cells: number[]; /** For `sign`: the neighbour, which way it lies, and whether this square is the smaller one. */ sign?: { other: number; dir: Direction; smaller: boolean } }

const dirOf = (from: number, to: number, n: number): Direction => (to === from - n ? 'above' : to === from + n ? 'below' : to === from - 1 ? 'left' : 'right')

/** The next square plain logic fills in, with the reason, or null when logic is stuck. */
export function findMove(grid: FutoshikiGrid, n: number, signs: readonly Sign[]): Move | null {
  const plain = candidatesOf(grid, n, signs, false)
  const full = candidatesOf(grid, n, signs, true)
  const lines = linesOf(n)
  for (let i = 0; i < n * n; i++) if (!grid[i] && count(plain[i]) === 1) return { index: i, value: only(plain[i]), technique: 'naked', cells: [i] }
  const hidden = (cand: readonly number[], singles: [FutoshikiTechnique, FutoshikiTechnique]): Move | null => {
    for (const line of lines) {
      const placed = line.cells.reduce((m, i) => m | (grid[i] ? bit(grid[i]) : 0), 0)
      for (let d = 1; d <= n; d++) {
        if (placed & bit(d)) continue
        const spots = line.cells.filter((i) => !grid[i] && cand[i] & bit(d))
        if (spots.length === 1) return { index: spots[0], value: d, technique: line.kind === 'row' ? singles[0] : singles[1], cells: [spots[0]] }
      }
    }
    return null
  }
  const plainHidden = hidden(plain, ['row', 'column'])
  if (plainHidden) return plainHidden
  for (let i = 0; i < n * n; i++) {
    if (grid[i] || count(full[i]) !== 1) continue
    const mine = signs.filter((s) => s.lo === i || s.hi === i)
    const needed = mine.find((s) => count(candidatesOf(grid, n, signs.filter((x) => x !== s))[i]) > 1) ?? mine[0]
    const other = needed ? (needed.lo === i ? needed.hi : needed.lo) : i
    return { index: i, value: only(full[i]), technique: 'sign', cells: [i, other], sign: needed ? { other, dir: dirOf(i, other, n), smaller: needed.lo === i } : undefined }
  }
  return hidden(full, ['signRow', 'signColumn'])
}

/** Fills the grid with plain logic only; the result still has gaps if logic gets stuck. */
export function logicSolveFutoshiki(puzzle: FutoshikiGrid, n: number, signs: readonly Sign[]): number[] {
  const g = [...puzzle]
  for (let m = findMove(g, n, signs); m; m = findMove(g, n, signs)) g[m.index] = m.value
  return g
}

export interface FutoshikiPuzzle { size: number; difficulty: Difficulty; puzzle: number[]; solution: number[]; signs: Sign[] }

/**
 * A new puzzle: a Latin square with every sign shown (plus givens if logic needs them), then signs and givens are taken away one at a time
 * while plain logic still solves it, so the answer is unique and needs no guessing.
 */
export function generateFutoshiki(difficulty: Difficulty, random: () => number = Math.random): FutoshikiPuzzle {
  const { size: n, minGivens } = FUTOSHIKI_LEVELS[difficulty]
  const solution = latinSquare(n, random)
  let signs = allSigns(solution, n)
  const puzzle: number[] = Array(n * n).fill(0)
  const solves = () => logicSolveFutoshiki(puzzle, n, signs).every((v, i) => v === solution[i])
  const order = shuffle(Array.from({ length: n * n }, (_, k) => k), random)
  let givens = 0
  for (const i of order) {
    if (givens >= minGivens && solves()) break
    puzzle[i] = solution[i]
    givens++
  }
  const items = shuffle([...signs.map((s) => ({ sign: s, cell: -1 })), ...order.map((i) => ({ sign: null as Sign | null, cell: i }))], random)
  for (const item of items) {
    if (item.sign) {
      const before = signs
      signs = signs.filter((s) => s !== item.sign)
      if (!solves()) signs = before
    } else if (puzzle[item.cell] && givens > minGivens) {
      puzzle[item.cell] = 0
      if (solves()) givens--
      else puzzle[item.cell] = solution[item.cell]
    }
  }
  return { size: n, difficulty, puzzle, solution, signs }
}

/** Cells that break a rule right now: a digit repeated in a row or column, or two digits that go against a sign. */
export function futoshikiConflicts(grid: FutoshikiGrid, n: number, signs: readonly Sign[]): Set<number> {
  const bad = new Set<number>()
  for (const line of linesOf(n)) {
    const seen = new Map<number, number>()
    for (const i of line.cells) {
      if (!grid[i]) continue
      const first = seen.get(grid[i])
      if (first === undefined) seen.set(grid[i], i)
      else { bad.add(first); bad.add(i) }
    }
  }
  for (const s of brokenSigns(grid, signs)) { bad.add(s.lo); bad.add(s.hi) }
  return bad
}

/** The signs that two filled squares already contradict. */
export const brokenSigns = (grid: FutoshikiGrid, signs: readonly Sign[]): Sign[] => signs.filter((s) => grid[s.lo] && grid[s.hi] && grid[s.lo] >= grid[s.hi])

/** Empty squares where no digit can go any more, counting the row, the column and the signs. */
export function futoshikiDeadCells(grid: FutoshikiGrid, n: number, signs: readonly Sign[]): Set<number> {
  const cand = candidatesOf(grid, n, signs)
  const dead = new Set<number>()
  for (let i = 0; i < n * n; i++) if (!grid[i] && cand[i] === 0) dead.add(i)
  return dead
}

export type FutoshikiHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: Move }
  | { kind: 'reveal'; index: number; value: number }

/** The next helpful step: wrong entries first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextFutoshikiHint(grid: FutoshikiGrid, solution: FutoshikiGrid, n: number, signs: readonly Sign[]): FutoshikiHint | null {
  const wrong = grid.flatMap((v, i) => (v !== 0 && v !== solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const index = grid.indexOf(0)
  if (index < 0) return null
  const move = findMove(grid, n, signs)
  return move ? { kind: 'move', move } : { kind: 'reveal', index, value: solution[index] }
}

export const isFutoshikiSolved = (grid: FutoshikiGrid, solution: FutoshikiGrid): boolean => grid.every((v, i) => v === solution[i])
