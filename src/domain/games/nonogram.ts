import type { Difficulty } from './sudoku'

/**
 * Nonogram (Picross): an n by n grid. The numbers beside each row and above each column give the lengths of the runs of filled squares in that line, in order.
 * Fill the squares to reveal a picture. Marks: 0 empty, 1 filled, 2 crossed (known to be empty). Every puzzle has one answer that a line solver finds
 * without guessing. Framework-free so it can be tested in node.
 */
export type NonogramGrid = readonly number[]
export const EMPTY = 0
export const FILLED = 1
export const CROSSED = 2

export const NONOGRAM_LEVELS: Record<Difficulty, { size: number; density: number }> = {
  easy: { size: 5, density: 0.6 },
  medium: { size: 8, density: 0.58 },
  hard: { size: 10, density: 0.56 },
  expert: { size: 15, density: 0.55 },
}

/** The lengths of the runs of filled squares in a line (an empty line has none). */
export function runsOf(line: readonly number[]): number[] {
  const runs: number[] = []
  let n = 0
  for (const v of line) {
    if (v === FILLED) n++
    else if (n) { runs.push(n); n = 0 }
  }
  if (n) runs.push(n)
  return runs
}

/** What a line allows: for each square whether some arrangement of the runs fills it and whether some leaves it empty. `ok` is false when no arrangement fits. */
export function lineOptions(clue: readonly number[], cells: readonly number[]): { canFill: boolean[]; canEmpty: boolean[]; ok: boolean } {
  const n = cells.length
  const K = clue.length
  const canFill = Array<boolean>(n).fill(false)
  const canEmpty = Array<boolean>(n).fill(false)
  const empty = (p: number) => cells[p] !== FILLED
  const fill = (p: number) => cells[p] !== CROSSED
  // suffix[k][p]: runs k and later fit in squares p and later
  const suffix: boolean[][] = Array.from({ length: K + 1 }, () => Array<boolean>(n + 2).fill(false))
  suffix[K][n] = true
  for (let p = n - 1; p >= 0; p--) suffix[K][p] = empty(p) && suffix[K][p + 1]
  const fits = (k: number, p: number): boolean => {
    const len = clue[k]
    if (p + len > n) return false
    for (let q = p; q < p + len; q++) if (!fill(q)) return false
    return p + len === n || empty(p + len)
  }
  for (let k = K - 1; k >= 0; k--) {
    for (let p = n - 1; p >= 0; p--) {
      suffix[k][p] = (empty(p) && suffix[k][p + 1]) || (fits(k, p) && suffix[k + 1][Math.min(p + clue[k] + 1, n)])
    }
  }
  if (!suffix[0][0]) return { canFill, canEmpty, ok: false }
  const reach: boolean[][] = Array.from({ length: K + 1 }, () => Array<boolean>(n + 1).fill(false))
  reach[0][0] = true
  for (let p = 0; p < n; p++) {
    for (let k = 0; k <= K; k++) {
      if (!reach[k][p]) continue
      if (empty(p) && suffix[k][p + 1]) { canEmpty[p] = true; reach[k][p + 1] = true }
      if (k < K && fits(k, p)) {
        const next = Math.min(p + clue[k] + 1, n)
        if (!suffix[k + 1][next]) continue
        for (let q = p; q < p + clue[k]; q++) canFill[q] = true
        if (p + clue[k] < n) canEmpty[p + clue[k]] = true
        reach[k + 1][next] = true
      }
    }
  }
  return { canFill, canEmpty, ok: true }
}

/** The clues of a picture: runs of every row, then of every column. */
export function cluesOf(picture: NonogramGrid, n: number): { rows: number[][]; cols: number[][] } {
  const rows: number[][] = []
  const cols: number[][] = []
  for (let k = 0; k < n; k++) {
    rows.push(runsOf(Array.from({ length: n }, (_, c) => picture[k * n + c])))
    cols.push(runsOf(Array.from({ length: n }, (_, r) => picture[r * n + k])))
  }
  return { rows, cols }
}

/** The squares of row (or column) k, in order. */
export const lineIndexes = (kind: 'row' | 'col', k: number, n: number): number[] => Array.from({ length: n }, (_, j) => (kind === 'row' ? k * n + j : j * n + k))

/** Plain line logic: repeat over every line until nothing more is forced. Returns the marks (0 where still unknown) or null if the clues contradict the marks. */
export function solveNonogram(rows: readonly (readonly number[])[], cols: readonly (readonly number[])[], start?: NonogramGrid): number[] | null {
  const n = rows.length
  const marks = start ? [...start] : Array<number>(n * n).fill(EMPTY)
  for (let changed = true; changed;) {
    changed = false
    for (const kind of ['row', 'col'] as const) {
      for (let k = 0; k < n; k++) {
        const idx = lineIndexes(kind, k, n)
        const opt = lineOptions((kind === 'row' ? rows : cols)[k], idx.map((i) => marks[i]))
        if (!opt.ok) return null
        idx.forEach((i, j) => {
          if (marks[i] !== EMPTY) return
          if (opt.canFill[j] && !opt.canEmpty[j]) { marks[i] = FILLED; changed = true }
          else if (opt.canEmpty[j] && !opt.canFill[j]) { marks[i] = CROSSED; changed = true }
        })
      }
    }
  }
  return marks
}

export interface NonogramPuzzle { difficulty: Difficulty; size: number; solution: readonly number[]; rows: number[][]; cols: number[][] }

/** A blobby random picture: noise, then a pass or two of neighbourhood majority so it reads as shapes. */
function picture(n: number, density: number, random: () => number): number[] {
  let g = Array.from({ length: n * n }, () => (random() < density ? FILLED : EMPTY))
  for (let pass = 0; pass < 2; pass++) {
    g = g.map((_, i) => {
      const r = Math.floor(i / n)
      const c = i % n
      let sum = 0
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr >= 0 && cc >= 0 && rr < n && cc < n) sum += g[rr * n + cc]
      }
      return sum >= 5 ? FILLED : EMPTY
    })
  }
  return g
}

/** Makes a puzzle whose picture the line solver can finish alone, so it has one answer and needs no guessing. */
export function generateNonogram(difficulty: Difficulty, random: () => number = Math.random): NonogramPuzzle {
  const { size, density } = NONOGRAM_LEVELS[difficulty]
  for (let attempt = 0; ; attempt++) {
    const pic = picture(size, density, random)
    const filled = pic.filter((v) => v === FILLED).length
    if (attempt < 3000 && (filled < size * size * 0.35 || filled > size * size * 0.75)) continue
    const { rows, cols } = cluesOf(pic, size)
    if (attempt < 3000 && (rows.some((r) => r.length === 0) || cols.some((c) => c.length === 0))) continue
    const solved = solveNonogram(rows, cols)
    if (solved && (solved.every((v) => v !== EMPTY) || attempt >= 3000)) return { difficulty, size, solution: pic, rows, cols }
  }
}

/** Marks that no longer match the answer: a filled square that stays empty, or a crossed square that is part of the picture. */
export const wrongMarks = (marks: NonogramGrid, solution: NonogramGrid): number[] =>
  marks.flatMap((m, i) => ((m === FILLED && solution[i] !== FILLED) || (m === CROSSED && solution[i] === FILLED) ? [i] : []))

/** Solved when exactly the squares of the picture are filled (crosses do not matter). */
export const isNonogramSolved = (marks: NonogramGrid, solution: NonogramGrid): boolean => marks.every((m, i) => (m === FILLED) === (solution[i] === FILLED))

/** How a line stands: `bad` when no arrangement fits what is marked, `met` when the filled runs already match the clue, otherwise `open`. */
export function lineStatus(clue: readonly number[], cells: readonly number[]): 'bad' | 'met' | 'open' {
  if (!lineOptions(clue, cells).ok) return 'bad'
  const runs = runsOf(cells)
  return runs.length === clue.length && runs.every((r, i) => r === clue[i]) ? 'met' : 'open'
}

/** Why a square is forced: a line with no runs, a line the runs fill exactly, a line with all its runs placed, the overlap of long runs, or the marks already made. */
export type NonogramTechnique = 'blank' | 'full' | 'done' | 'overlap' | 'line'
const PRIORITY: readonly NonogramTechnique[] = ['blank', 'full', 'done', 'overlap', 'line']

export interface NonogramMove { index: number; mark: number; kind: 'row' | 'col'; line: number; technique: NonogramTechnique }

/** The next forced square from the marks as they stand, preferring the simplest reason, or null when line logic is stuck. */
export function findNonogramMove(rows: readonly (readonly number[])[], cols: readonly (readonly number[])[], marks: NonogramGrid): NonogramMove | null {
  const n = rows.length
  let best: NonogramMove | null = null
  for (const kind of ['row', 'col'] as const) {
    for (let k = 0; k < n; k++) {
      const clue = (kind === 'row' ? rows : cols)[k]
      const idx = lineIndexes(kind, k, n)
      const cells = idx.map((i) => marks[i])
      const opt = lineOptions(clue, cells)
      if (!opt.ok) continue
      const total = clue.reduce((a, b) => a + b, 0)
      const blank = lineOptions(clue, Array<number>(n).fill(EMPTY))
      const placed = cells.filter((v) => v === FILLED).length === total
      idx.forEach((i, j) => {
        if (marks[i] !== EMPTY) return
        const mark = opt.canFill[j] && !opt.canEmpty[j] ? FILLED : opt.canEmpty[j] && !opt.canFill[j] ? CROSSED : EMPTY
        if (mark === EMPTY) return
        const technique: NonogramTechnique = clue.length === 0 ? 'blank'
          : total + clue.length - 1 === n ? 'full'
            : placed && mark === CROSSED ? 'done'
              : mark === FILLED && blank.canFill[j] && !blank.canEmpty[j] ? 'overlap' : 'line'
        if (!best || PRIORITY.indexOf(technique) < PRIORITY.indexOf(best.technique)) best = { index: i, mark, kind, line: k, technique }
      })
    }
  }
  return best
}

export type NonogramHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: NonogramMove }
  | { kind: 'reveal'; index: number; mark: number }

/** The next hint: wrong marks first, then the next forced square, then (rarely) the answer for one square. */
export function nextNonogramHint(p: NonogramPuzzle, marks: NonogramGrid): NonogramHint | null {
  const wrong = wrongMarks(marks, p.solution)
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const move = findNonogramMove(p.rows, p.cols, marks)
  if (move) return { kind: 'move', move }
  const next = marks.findIndex((m, i) => m === EMPTY && p.solution[i] === FILLED)
  return next < 0 ? null : { kind: 'reveal', index: next, mark: FILLED }
}
