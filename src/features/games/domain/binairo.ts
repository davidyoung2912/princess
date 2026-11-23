import { shuffle, type Difficulty } from './sudoku'

/**
 * Binairo (also called Takuzu): fill a square grid with two symbols so that no symbol appears three times in a row (across or down),
 * every row and column holds each symbol equally often, and no two rows (and no two columns) are identical.
 * Cells hold 0 (empty), 1 (circle) or 2 (square). Framework-free so it can be tested in node.
 */

export type BinairoGrid = readonly number[]
export const CIRCLE = 1
export const SQUARE = 2
const other = (v: number) => 3 - v

/** Board size, how many of the cells at least stay given, and whether the "rows must differ" technique may be needed. */
export const BINAIRO_LEVELS: Record<Difficulty, { size: number; minGivenShare: number; unique: boolean }> = {
  easy: { size: 6, minGivenShare: 0.5, unique: false },
  medium: { size: 8, minGivenShare: 0.4, unique: true },
  hard: { size: 10, minGivenShare: 0.3, unique: true },
  expert: { size: 12, minGivenShare: 0, unique: true },
}

export interface Line { kind: 'row' | 'column'; no: number; cells: number[] }

const LINE_CACHE = new Map<number, Line[]>()
/** Every row then every column of an n by n grid, as lists of cell indexes. */
export function linesOf(n: number): Line[] {
  let lines = LINE_CACHE.get(n)
  if (!lines) {
    lines = [
      ...Array.from({ length: n }, (_, r) => ({ kind: 'row' as const, no: r, cells: Array.from({ length: n }, (_, c) => r * n + c) })),
      ...Array.from({ length: n }, (_, c) => ({ kind: 'column' as const, no: c, cells: Array.from({ length: n }, (_, r) => r * n + c) })),
    ]
    LINE_CACHE.set(n, lines)
  }
  return lines
}

const ROW_CACHE = new Map<number, number[][]>()
/** Every row of n cells that is balanced and has no three in a row. */
function validRows(n: number): number[][] {
  let rows = ROW_CACHE.get(n)
  if (!rows) {
    rows = []
    for (let mask = 0; mask < 1 << n; mask++) {
      const row = Array.from({ length: n }, (_, k) => ((mask >> k) & 1 ? SQUARE : CIRCLE))
      if (row.filter((v) => v === SQUARE).length !== n / 2) continue
      if (row.some((v, k) => k >= 2 && row[k - 1] === v && row[k - 2] === v)) continue
      rows.push(row)
    }
    ROW_CACHE.set(n, rows)
  }
  return rows
}

/** A random complete valid grid, built row by row with column checks; null if the node budget runs out. */
export function fullBinairo(n: number, random: () => number = Math.random, budget = 4000): number[] | null {
  const rows = validRows(n)
  const half = n / 2
  const chosen: number[][] = []
  const used = new Set<string>()
  const squares = Array(n).fill(0)
  let nodes = 0
  const place = (r: number): boolean => {
    if (r === n) {
      const cols = new Set(Array.from({ length: n }, (_, c) => chosen.map((row) => row[c]).join('')))
      return cols.size === n
    }
    for (const row of shuffle(rows, random)) {
      if (++nodes > budget) return false
      const key = row.join('')
      if (used.has(key)) continue
      let ok = true
      for (let c = 0; c < n && ok; c++) {
        const sq = squares[c] + (row[c] === SQUARE ? 1 : 0)
        const ci = r + 1 - sq
        if (sq > half || ci > half) ok = false
        else if (r >= 2 && chosen[r - 1][c] === row[c] && chosen[r - 2][c] === row[c]) ok = false
      }
      if (!ok) continue
      chosen.push(row)
      used.add(key)
      row.forEach((v, c) => { if (v === SQUARE) squares[c]++ })
      if (place(r + 1)) return true
      if (nodes > budget) return false
      row.forEach((v, c) => { if (v === SQUARE) squares[c]-- })
      used.delete(key)
      chosen.pop()
    }
    return false
  }
  return place(0) ? chosen.flat() : null
}

/** Why a cell can be filled: two together, a gap between two, a line that has its half, or a line that would repeat another. */
export type BinairoTechnique = 'pair' | 'gap' | 'half' | 'unique'

export interface Move { index: number; value: number; technique: BinairoTechnique; kind: 'row' | 'column'; line: number; cells: number[]; other?: number }

const TECHNIQUES: readonly BinairoTechnique[] = ['pair', 'gap', 'half', 'unique']

/** The next cell that plain logic fills in, or null when logic is stuck. `unique` allows the "two rows may not match" rule. */
export function findMove(grid: BinairoGrid, n: number, unique = true): Move | null {
  const lines = linesOf(n)
  for (const technique of TECHNIQUES) {
    if (technique === 'unique' && !unique) continue
    for (const line of lines) {
      const a = line.cells.map((i) => grid[i])
      const move = (k: number, cells: number[], value: number, otherLine?: number): Move =>
        ({ index: line.cells[k], value, technique, kind: line.kind, line: line.no, cells: cells.map((j) => line.cells[j]), other: otherLine })
      if (technique === 'pair') {
        for (let k = 0; k < n - 1; k++) {
          if (a[k] === 0 || a[k] !== a[k + 1]) continue
          if (k > 0 && a[k - 1] === 0) return move(k - 1, [k, k + 1], other(a[k]))
          if (k + 2 < n && a[k + 2] === 0) return move(k + 2, [k, k + 1], other(a[k]))
        }
      } else if (technique === 'gap') {
        for (let k = 0; k < n - 2; k++) if (a[k] !== 0 && a[k] === a[k + 2] && a[k + 1] === 0) return move(k + 1, [k, k + 2], other(a[k]))
      } else if (technique === 'half') {
        for (const v of [CIRCLE, SQUARE]) {
          const k = a.indexOf(0)
          if (k >= 0 && a.filter((x) => x === v).length === n / 2) return move(k, a.flatMap((x, j) => (x === v ? [j] : [])), other(v))
        }
      } else {
        const empties = a.flatMap((x, j) => (x === 0 ? [j] : []))
        if (empties.length !== 2) continue
        for (const m of lines) {
          if (m.kind !== line.kind || m.no === line.no) continue
          const b = m.cells.map((i) => grid[i])
          if (b.includes(0) || b[empties[0]] === b[empties[1]] || a.some((x, j) => x !== 0 && x !== b[j])) continue
          return move(empties[0], [], other(b[empties[0]]), m.no)
        }
      }
    }
  }
  return null
}

/** Fills the grid with plain logic only; the result still has gaps if logic gets stuck. */
export function logicSolveBinairo(puzzle: BinairoGrid, n: number, unique = true): number[] {
  const g = [...puzzle]
  for (let m = findMove(g, n, unique); m; m = findMove(g, n, unique)) g[m.index] = m.value
  return g
}

/** True when the complete grid obeys every rule. */
export function isValidBinairo(grid: BinairoGrid, n: number): boolean {
  if (grid.some((v) => v === 0)) return false
  const lines = linesOf(n)
  for (const line of lines) {
    const a = line.cells.map((i) => grid[i])
    if (a.filter((v) => v === SQUARE).length !== n / 2) return false
    if (a.some((v, k) => k >= 2 && a[k - 1] === v && a[k - 2] === v)) return false
  }
  for (const kind of ['row', 'column'] as const) {
    const keys = lines.filter((l) => l.kind === kind).map((l) => l.cells.map((i) => grid[i]).join(''))
    if (new Set(keys).size !== n) return false
  }
  return true
}

export interface BinairoPuzzle { size: number; difficulty: Difficulty; puzzle: number[]; solution: number[] }

/** A new puzzle: a full grid, then givens removed one at a time while plain logic still solves it (so the answer is unique and needs no guessing). */
export function generateBinairo(difficulty: Difficulty, random: () => number = Math.random): BinairoPuzzle {
  const { size: n, minGivenShare, unique } = BINAIRO_LEVELS[difficulty]
  let solution: number[] | null = null
  while (!solution) solution = fullBinairo(n, random)
  const puzzle = [...solution]
  const keep = Math.ceil(n * n * minGivenShare)
  let givens = n * n
  for (const i of shuffle(Array.from({ length: n * n }, (_, k) => k), random)) {
    if (givens <= keep) break
    const v = puzzle[i]
    puzzle[i] = 0
    if (logicSolveBinairo(puzzle, n, unique).every((x, k) => x === solution![k])) givens--
    else puzzle[i] = v
  }
  return { size: n, difficulty, puzzle, solution }
}

/** Cells that break a rule right now: three in a row, a line with too many of one symbol, or two identical full lines. */
export function binairoConflicts(grid: BinairoGrid, n: number): Set<number> {
  const bad = new Set<number>()
  const lines = linesOf(n)
  for (const line of lines) {
    const a = line.cells.map((i) => grid[i])
    for (let k = 0; k + 2 < n; k++) if (a[k] !== 0 && a[k] === a[k + 1] && a[k] === a[k + 2]) [k, k + 1, k + 2].forEach((j) => bad.add(line.cells[j]))
    for (const v of [CIRCLE, SQUARE]) if (a.filter((x) => x === v).length > n / 2) a.forEach((x, j) => { if (x === v) bad.add(line.cells[j]) })
  }
  for (const kind of ['row', 'column'] as const) {
    const full = lines.filter((l) => l.kind === kind && l.cells.every((i) => grid[i] !== 0))
    for (const x of full) for (const y of full) if (x.no < y.no && x.cells.every((c, j) => grid[c] === grid[y.cells[j]])) [...x.cells, ...y.cells].forEach((c) => bad.add(c))
  }
  return bad
}

/** Empty cells where neither symbol can go without breaking the three-in-a-row or half rules. */
export function binairoDeadCells(grid: BinairoGrid, n: number): Set<number> {
  const dead = new Set<number>()
  const g = [...grid]
  const lines = linesOf(n)
  const fits = (i: number, v: number): boolean => {
    g[i] = v
    const r = Math.floor(i / n)
    const c = i % n
    const ok = [lines[r], lines[n + c]].every((line) => {
      const a = line.cells.map((j) => g[j])
      if (a.filter((x) => x === v).length > n / 2) return false
      return !a.some((x, k) => k >= 2 && x === v && a[k - 1] === v && a[k - 2] === v)
    })
    g[i] = 0
    return ok
  }
  for (let i = 0; i < n * n; i++) if (grid[i] === 0 && !fits(i, CIRCLE) && !fits(i, SQUARE)) dead.add(i)
  return dead
}

export type BinairoHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: Move }
  | { kind: 'reveal'; index: number; value: number }

/** The next helpful step: wrong entries first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextBinairoHint(grid: BinairoGrid, solution: BinairoGrid, n: number): BinairoHint | null {
  const wrong = grid.flatMap((v, i) => (v !== 0 && v !== solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const index = grid.indexOf(0)
  if (index < 0) return null
  const move = findMove(grid, n, true)
  return move ? { kind: 'move', move } : { kind: 'reveal', index, value: solution[index] }
}

export const isBinairoSolved = (grid: BinairoGrid, solution: BinairoGrid): boolean => grid.every((v, i) => v === solution[i])
