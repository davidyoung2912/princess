/**
 * Framework-free Sudoku: a generator that follows the standard algorithm (fill a full grid by randomised backtracking, remove clues in symmetric pairs, keep
 * a removal only while the puzzle still has exactly one solution), plus a human-logic solver so every puzzle can be finished without guessing, and a hint finder.
 */
export type Grid = readonly number[]
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert']

const SIZE = 9
const CELLS = 81
const ALL = 0b111111111
const bit = (d: number) => 1 << (d - 1)
const count = (mask: number) => { let n = 0; for (let m = mask; m; m &= m - 1) n++; return n }
const only = (mask: number) => 31 - Math.clz32(mask) + 1 // the digit of a one-bit mask

export const rowOf = (i: number) => Math.floor(i / SIZE)
export const colOf = (i: number) => i % SIZE
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)

/** The 27 units: nine rows, nine columns and nine boxes, each a list of nine cell indexes. */
export const UNITS: readonly (readonly number[])[] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
]
const ROW_UNIT = 0
const COL_UNIT = 9
const BOX_UNIT = 18

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set<number>()
  for (const u of [UNITS[ROW_UNIT + rowOf(i)], UNITS[COL_UNIT + colOf(i)], UNITS[BOX_UNIT + boxOf(i)]]) for (const c of u) if (c !== i) set.add(c)
  return [...set]
})

const shuffle = <T,>(items: readonly T[], random: () => number): T[] => {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** Candidate digits (as a bit mask) for every cell of a grid; a filled cell has none. */
function candidatesOf(grid: Grid): number[] {
  const out = Array<number>(CELLS).fill(0)
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue
    let mask = ALL
    for (const p of PEERS[i]) if (grid[p] !== 0) mask &= ~bit(grid[p])
    out[i] = mask
  }
  return out
}

/** Backtracking search that always tries the cell with the fewest candidates. Stops once `limit` solutions are found. */
function search(grid: number[], limit: number, random?: () => number): { count: number; first: number[] | null } {
  let found = 0
  let first: number[] | null = null
  if (conflicts(grid).size > 0) return { count: 0, first }
  const rec = (): void => {
    if (found >= limit) return
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] !== 0) continue
      let mask = ALL
      for (const p of PEERS[i]) if (grid[p] !== 0) mask &= ~bit(grid[p])
      const n = count(mask)
      if (n === 0) return
      if (n < bestCount) { best = i; bestMask = mask; bestCount = n; if (n === 1) break }
    }
    if (best === -1) { found++; first ??= [...grid]; return }
    const digits: number[] = []
    for (let d = 1; d <= 9; d++) if (bestMask & bit(d)) digits.push(d)
    for (const d of random ? shuffle(digits, random) : digits) {
      grid[best] = d
      rec()
      if (found >= limit) { grid[best] = 0; return }
    }
    grid[best] = 0
  }
  rec()
  return { count: found, first }
}

/** How many solutions a puzzle has, counting no further than `limit` (2 is enough to tell unique from not). */
export const countSolutions = (puzzle: Grid, limit = 2): number => search([...puzzle], limit).count

/** The solution of a puzzle, or null when it has none. */
export const solve = (puzzle: Grid): number[] | null => search([...puzzle], 1).first

/** A complete valid grid, different every time. */
export const fullGrid = (random: () => number = Math.random): number[] => search(Array<number>(CELLS).fill(0), 1, random).first!

// ---- Human logic ----

/** Level 1: naked and hidden singles. Level 2 adds naked pairs and pointing / box-line eliminations. */
export type TechniqueLevel = 1 | 2

/** Solves with human techniques only (never guessing). True when the whole grid is finished that way. */
export function solvableByLogic(puzzle: Grid, level: TechniqueLevel): boolean {
  const values = [...puzzle]
  const cand = candidatesOf(values)
  const place = (i: number, d: number) => {
    values[i] = d
    cand[i] = 0
    for (const p of PEERS[i]) cand[p] &= ~bit(d)
  }
  for (;;) {
    let progress = false
    // Naked singles: a cell with one candidate left.
    for (let i = 0; i < CELLS; i++) if (values[i] === 0 && count(cand[i]) === 1) { place(i, only(cand[i])); progress = true }
    // Hidden singles: a digit with one place left in a row, column or box.
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        let where = -1
        let n = 0
        let placed = false
        for (const c of unit) { if (values[c] === d) { placed = true; break } if (cand[c] & bit(d)) { where = c; n++ } }
        if (!placed && n === 1) { place(where, d); progress = true }
      }
    }
    if (progress) continue
    if (level >= 2 && eliminate(cand, values)) continue
    break
  }
  return values.every((v) => v !== 0)
}

/** One pass of naked pairs, pointing pairs and box-line reduction. True when it removed any candidate. */
function eliminate(cand: number[], values: readonly number[]): boolean {
  let changed = false
  // Naked pairs: two cells in a unit with the same two candidates own them, so no other cell in the unit can.
  for (const unit of UNITS) {
    for (let a = 0; a < 9; a++) {
      const ca = cand[unit[a]]
      if (values[unit[a]] !== 0 || count(ca) !== 2) continue
      for (let b = a + 1; b < 9; b++) {
        if (cand[unit[b]] !== ca) continue
        for (const c of unit) if (c !== unit[a] && c !== unit[b] && cand[c] & ca) { cand[c] &= ~ca; changed = true }
      }
    }
  }
  // Pointing pairs: in a box, a digit confined to one row or column cannot appear elsewhere on that line.
  for (let b = 0; b < 9; b++) {
    const box = UNITS[BOX_UNIT + b]
    for (let d = 1; d <= 9; d++) {
      const spots = box.filter((c) => cand[c] & bit(d))
      if (spots.length < 2) continue
      for (const [kind, key] of [[ROW_UNIT, rowOf], [COL_UNIT, colOf]] as const) {
        const line = key(spots[0])
        if (!spots.every((c) => key(c) === line)) continue
        for (const c of UNITS[kind + line]) if (boxOf(c) !== b && cand[c] & bit(d)) { cand[c] &= ~bit(d); changed = true }
      }
    }
  }
  // Box-line reduction: in a row or column, a digit confined to one box cannot appear elsewhere in that box.
  for (const kind of [ROW_UNIT, COL_UNIT]) {
    for (let l = 0; l < 9; l++) {
      const line = UNITS[kind + l]
      for (let d = 1; d <= 9; d++) {
        const spots = line.filter((c) => cand[c] & bit(d))
        if (spots.length < 2) continue
        const b = boxOf(spots[0])
        if (!spots.every((c) => boxOf(c) === b)) continue
        for (const c of UNITS[BOX_UNIT + b]) if (!line.includes(c) && cand[c] & bit(d)) { cand[c] &= ~bit(d); changed = true }
      }
    }
  }
  return changed
}

// ---- Generation ----

/** How many clues each level aims for, and which human techniques its puzzles may need. The generator stops early if no clue can be removed safely. */
export const LEVELS: Record<Difficulty, { clues: number; logic: TechniqueLevel }> = {
  easy: { clues: 40, logic: 1 },
  medium: { clues: 33, logic: 1 },
  hard: { clues: 28, logic: 2 },
  expert: { clues: 24, logic: 2 },
}

export interface Puzzle {
  difficulty: Difficulty
  /** The clues (0 = empty). */
  puzzle: number[]
  solution: number[]
}

/**
 * Makes a puzzle: a full grid, then clues removed in pairs that mirror each other through the centre. A removal is kept only if the puzzle still has exactly one
 * solution and can still be solved by human logic at this level; otherwise the clues are put back.
 */
export function generatePuzzle(difficulty: Difficulty, random: () => number = Math.random): Puzzle {
  const solution = fullGrid(random)
  const puzzle = [...solution]
  const { clues, logic } = LEVELS[difficulty]
  let left = CELLS
  for (const i of shuffle(Array.from({ length: 41 }, (_, k) => k), random)) {
    if (left <= clues) break
    const mirror = CELLS - 1 - i
    const cells = i === mirror ? [i] : [i, mirror]
    if (cells.some((c) => puzzle[c] === 0) || left - cells.length < clues) continue
    const saved = cells.map((c) => puzzle[c])
    for (const c of cells) puzzle[c] = 0
    if (countSolutions(puzzle) === 1 && solvableByLogic(puzzle, logic)) left -= cells.length
    else cells.forEach((c, k) => { puzzle[c] = saved[k] })
  }
  return { difficulty, puzzle, solution }
}

// ---- Playing ----

/** The cells whose digit repeats in their row, column or box. */
export function conflicts(grid: Grid): Set<number> {
  const bad = new Set<number>()
  for (const unit of UNITS) {
    const seen = new Map<number, number>()
    for (const c of unit) {
      const d = grid[c]
      if (d === 0) continue
      const prev = seen.get(d)
      if (prev !== undefined) { bad.add(prev); bad.add(c) } else seen.set(d, c)
    }
  }
  return bad
}

/**
 * The empty cells that can no longer be solved from the board as it stands: a cell with no digit left that fits it, and every empty cell of a row, column or box
 * where some digit has nowhere left to go. It is worked out from the cells on the board each time, so removing the digit that caused it clears the mark.
 */
export function deadCells(grid: Grid): Set<number> {
  const dead = new Set<number>()
  const cand = candidatesOf(grid)
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0 && cand[i] === 0) dead.add(i)
  for (const unit of UNITS) {
    const empty = unit.filter((c) => grid[c] === 0)
    if (empty.length === 0) continue
    for (let d = 1; d <= 9; d++) {
      if (unit.some((c) => grid[c] === d)) continue
      if (!empty.some((c) => cand[c] & bit(d))) empty.forEach((c) => dead.add(c))
    }
  }
  return dead
}

export const isSolved = (grid: Grid, solution: Grid): boolean => grid.every((v, i) => v === solution[i])

export type Technique = 'naked' | 'row' | 'column' | 'box'

export type Hint =
  /** Entries that do not match the solution. */
  | { kind: 'mistake'; cells: number[] }
  /** A cell that can be filled with plain logic, and the reason. */
  | { kind: 'single'; index: number; value: number; technique: Technique }
  /** Nothing simple is left, so the hint names a digit from the solution. */
  | { kind: 'reveal'; index: number; value: number }

/** The next helpful step for the grid the player has now (clues plus their own entries), or null when it is finished. */
export function nextHint(grid: Grid, solution: Grid): Hint | null {
  const wrong = grid.flatMap((v, i) => (v !== 0 && v !== solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  if (grid.every((v) => v !== 0)) return null
  const cand = candidatesOf(grid)
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0 && count(cand[i]) === 1) return { kind: 'single', index: i, value: only(cand[i]), technique: 'naked' }
  const kinds: Technique[] = ['box', 'row', 'column']
  for (const [k, offset] of [[0, BOX_UNIT], [1, ROW_UNIT], [2, COL_UNIT]] as const) {
    for (let u = 0; u < 9; u++) {
      for (let d = 1; d <= 9; d++) {
        const unit = UNITS[offset + u]
        if (unit.some((c) => grid[c] === d)) continue
        const spots = unit.filter((c) => cand[c] & bit(d))
        if (spots.length === 1) return { kind: 'single', index: spots[0], value: d, technique: kinds[k] }
      }
    }
  }
  const empty = grid.flatMap((v, i) => (v === 0 ? [i] : []))
  const index = empty.reduce((a, b) => (count(cand[b]) < count(cand[a]) ? b : a))
  return { kind: 'reveal', index, value: solution[index] }
}

/** The digits still possible in a cell given the filled cells around it (used to tidy pencil marks). */
export const candidateDigits = (grid: Grid, i: number): number[] => {
  const mask = candidatesOf(grid)[i]
  return Array.from({ length: 9 }, (_, k) => k + 1).filter((d) => mask & bit(d))
}

/** 0:07 style clock for a number of seconds. */
export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
