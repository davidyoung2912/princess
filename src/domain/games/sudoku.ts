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

export type Variant = 'classic' | 'diagonal' | 'jigsaw'
export type UnitKind = 'row' | 'column' | 'box' | 'diagonal' | 'region'

/** Where two units overlap in two or more cells: a digit confined to the overlap in `a` cannot be elsewhere in `b`. */
interface Overlap { a: number; b: number; cells: readonly number[] }

/** Everything a variant changes: which groups of nine must hold 1 to 9, who sees whom, and which region (box) each cell belongs to. */
export interface Rules {
  variant: Variant
  units: readonly (readonly number[])[]
  kinds: readonly UnitKind[]
  peers: readonly (readonly number[])[]
  /** The region id (0 to 8) of every cell: the 3 by 3 box for classic and diagonal, an irregular shape for jigsaw. */
  region: readonly number[]
  /** Cells on either main diagonal (empty unless the variant has them). */
  diagonal: ReadonlySet<number>
  overlaps: readonly Overlap[]
}

const BOX_REGIONS: readonly number[] = Array.from({ length: CELLS }, (_, i) => boxOf(i))

/** Builds the rules from a region map (nine regions of nine cells) and whether both main diagonals also hold 1 to 9. */
export function makeRules(variant: Variant, region: readonly number[] = BOX_REGIONS): Rules {
  const rows = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c))
  const cols = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c))
  const regions = Array.from({ length: 9 }, (_, g) => region.flatMap((v, i) => (v === g ? [i] : [])))
  const units = [...rows, ...cols, ...regions]
  const kinds: UnitKind[] = [...rows.map(() => 'row' as const), ...cols.map(() => 'column' as const), ...regions.map(() => (variant === 'jigsaw' ? 'region' as const : 'box' as const))]
  const diagonal = new Set<number>()
  if (variant === 'diagonal') {
    units.push(Array.from({ length: 9 }, (_, k) => k * 10), Array.from({ length: 9 }, (_, k) => k * 8 + 8))
    kinds.push('diagonal', 'diagonal')
    for (const u of units.slice(-2)) for (const c of u) diagonal.add(c)
  }
  const peers = Array.from({ length: CELLS }, (_, i) => {
    const set = new Set<number>()
    for (const u of units) if (u.includes(i)) for (const c of u) if (c !== i) set.add(c)
    return [...set]
  })
  const overlaps: Overlap[] = []
  units.forEach((ua, a) => units.forEach((ub, b) => {
    if (a === b) return
    const cells = ua.filter((c) => ub.includes(c))
    if (cells.length >= 2) overlaps.push({ a, b, cells })
  }))
  return { variant, units, kinds, peers, region, diagonal, overlaps }
}

export const CLASSIC: Rules = makeRules('classic')
export const DIAGONAL: Rules = makeRules('diagonal')

/** The 27 units of classic Sudoku: nine rows, nine columns and nine boxes, each a list of nine cell indexes. */
export const UNITS: readonly (readonly number[])[] = CLASSIC.units
/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = CLASSIC.peers

const shuffle = <T,>(items: readonly T[], random: () => number): T[] => {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** Candidate digits (as a bit mask) for every cell of a grid; a filled cell has none. */
function candidatesOf(grid: Grid, rules: Rules): number[] {
  const out = Array<number>(CELLS).fill(0)
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue
    let mask = ALL
    for (const p of rules.peers[i]) if (grid[p] !== 0) mask &= ~bit(grid[p])
    out[i] = mask
  }
  return out
}

/**
 * Backtracking search that always tries the cell with the fewest candidates. Stops once `limit` solutions are found, or (when a budget is given) once that many
 * nodes have been tried, in which case `aborted` is set and the count so far is all that is known.
 */
function search(grid: number[], rules: Rules, limit: number, random?: () => number, budget = Infinity): { count: number; first: number[] | null; aborted: boolean } {
  let found = 0
  let nodes = 0
  let aborted = false
  let first: number[] | null = null
  if (conflicts(grid, rules).size > 0) return { count: 0, first, aborted }
  const rec = (): void => {
    if (found >= limit || aborted) return
    if (++nodes > budget) { aborted = true; return }
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] !== 0) continue
      let mask = ALL
      for (const p of rules.peers[i]) if (grid[p] !== 0) mask &= ~bit(grid[p])
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
      if (found >= limit || aborted) { grid[best] = 0; return }
    }
    grid[best] = 0
  }
  rec()
  return { count: found, first, aborted }
}

/** How many solutions a puzzle has, counting no further than `limit` (2 is enough to tell unique from not). */
export const countSolutions = (puzzle: Grid, limit = 2, rules: Rules = CLASSIC): number => search([...puzzle], rules, limit).count

/** The solution of a puzzle, or null when it has none. */
export const solve = (puzzle: Grid, rules: Rules = CLASSIC): number[] | null => search([...puzzle], rules, 1).first

/** A complete valid grid, different every time. Null only when a node budget is given and runs out first (a hard jigsaw layout). */
export const fullGrid = (random: () => number = Math.random, rules: Rules = CLASSIC, budget = Infinity): number[] | null =>
  search(Array<number>(CELLS).fill(0), rules, 1, random, budget).first

// ---- Jigsaw layouts ----

const neighbours = (i: number): number[] => {
  const r = rowOf(i)
  const c = colOf(i)
  return [...(r > 0 ? [i - 9] : []), ...(r < 8 ? [i + 9] : []), ...(c > 0 ? [i - 1] : []), ...(c < 8 ? [i + 1] : [])]
}

/** True when the cells of one region form a single connected shape. */
function connected(region: readonly number[], id: number): boolean {
  const cells = region.flatMap((v, i) => (v === id ? [i] : []))
  const seen = new Set<number>([cells[0]])
  const queue = [cells[0]]
  while (queue.length) for (const n of neighbours(queue.pop()!)) if (region[n] === id && !seen.has(n)) { seen.add(n); queue.push(n) }
  return seen.size === cells.length
}

/**
 * Nine connected regions of nine cells. It starts from the 3 by 3 boxes and trades one cell between two touching regions, keeping a trade only while both
 * regions are still in one piece. Plenty of trades make the shapes irregular.
 */
export function jigsawRegions(random: () => number = Math.random): number[] {
  const region = [...BOX_REGIONS]
  let swaps = 0
  for (let tries = 0; tries < 30000 && swaps < 200; tries++) {
    const x = Math.floor(random() * CELLS)
    const near = neighbours(x)
    const b = near[Math.floor(random() * near.length)] // a cell of a neighbouring region
    const ra = region[x]
    const rb = region[b]
    if (ra === rb) continue
    const own = region.flatMap((v, i) => (v === ra ? [i] : []))
    const a = own[Math.floor(random() * own.length)] // the cell that moves across in exchange for b
    region[a] = rb
    region[b] = ra
    if (connected(region, ra) && connected(region, rb)) swaps++
    else { region[a] = ra; region[b] = rb }
  }
  return region
}

// ---- Human logic ----

/** Level 1: naked and hidden singles. Level 2 adds naked pairs and pointing / box-line eliminations. */
export type TechniqueLevel = 1 | 2

/** Solves with human techniques only (never guessing). True when the whole grid is finished that way. */
export function solvableByLogic(puzzle: Grid, level: TechniqueLevel, rules: Rules = CLASSIC): boolean {
  const values = [...puzzle]
  const cand = candidatesOf(values, rules)
  const place = (i: number, d: number) => {
    values[i] = d
    cand[i] = 0
    for (const p of rules.peers[i]) cand[p] &= ~bit(d)
  }
  for (;;) {
    let progress = false
    // Naked singles: a cell with one candidate left.
    for (let i = 0; i < CELLS; i++) if (values[i] === 0 && count(cand[i]) === 1) { place(i, only(cand[i])); progress = true }
    // Hidden singles: a digit with one place left in a unit.
    for (const unit of rules.units) {
      for (let d = 1; d <= 9; d++) {
        let where = -1
        let n = 0
        let placed = false
        for (const c of unit) { if (values[c] === d) { placed = true; break } if (cand[c] & bit(d)) { where = c; n++ } }
        if (!placed && n === 1) { place(where, d); progress = true }
      }
    }
    if (progress) continue
    if (level >= 2 && eliminate(cand, values, rules)) continue
    break
  }
  return values.every((v) => v !== 0)
}

/**
 * One pass of naked pairs and locked candidates. Locked candidates work on any two units that overlap in two or more cells (a row and a box, a diagonal and a
 * box, a jigsaw region and a column): when a digit's places in one unit all lie in the overlap, no other cell of the second unit can hold it.
 * True when it removed any candidate.
 */
function eliminate(cand: number[], values: readonly number[], rules: Rules): boolean {
  let changed = false
  // Naked pairs: two cells in a unit with the same two candidates own them, so no other cell in the unit can.
  for (const unit of rules.units) {
    for (let a = 0; a < 9; a++) {
      const ca = cand[unit[a]]
      if (values[unit[a]] !== 0 || count(ca) !== 2) continue
      for (let b = a + 1; b < 9; b++) {
        if (cand[unit[b]] !== ca) continue
        for (const c of unit) if (c !== unit[a] && c !== unit[b] && cand[c] & ca) { cand[c] &= ~ca; changed = true }
      }
    }
  }
  for (const { a, b, cells } of rules.overlaps) {
    const first = rules.units[a]
    const second = rules.units[b]
    for (let d = 1; d <= 9; d++) {
      const spots = first.filter((c) => cand[c] & bit(d))
      if (spots.length < 2 || !spots.every((c) => cells.includes(c))) continue
      for (const c of second) if (!cells.includes(c) && cand[c] & bit(d)) { cand[c] &= ~bit(d); changed = true }
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
  rules: Rules
  /** The clues (0 = empty). */
  puzzle: number[]
  solution: number[]
}

/** Node budgets: a full grid for an awkward jigsaw layout is abandoned and the layout re-rolled; a uniqueness check that runs out counts as "not unique". */
const FILL_BUDGET = 20000
const UNIQUE_BUDGET = 60000

const rulesFor = (variant: Variant, random: () => number): Rules => (variant === 'jigsaw' ? makeRules('jigsaw', jigsawRegions(random)) : variant === 'diagonal' ? DIAGONAL : CLASSIC)

/**
 * Makes a puzzle: a full grid, then clues removed in pairs that mirror each other through the centre. A removal is kept only if the puzzle still has exactly one
 * solution and can still be solved by human logic at this level; otherwise the clues are put back. A jigsaw puzzle gets a new region layout, re-rolled until a grid fits it.
 */
export function generatePuzzle(difficulty: Difficulty, random: () => number = Math.random, variant: Variant = 'classic'): Puzzle {
  let rules = rulesFor(variant, random)
  let solution = fullGrid(random, rules, FILL_BUDGET)
  for (let attempt = 0; !solution && attempt < 100; attempt++) {
    rules = rulesFor(variant, random)
    solution = fullGrid(random, rules, FILL_BUDGET)
  }
  if (!solution) throw new Error('no grid found')
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
    const unique = (() => { const r = search([...puzzle], rules, 2, undefined, UNIQUE_BUDGET); return !r.aborted && r.count === 1 })()
    if (unique && solvableByLogic(puzzle, logic, rules)) left -= cells.length
    else cells.forEach((c, k) => { puzzle[c] = saved[k] })
  }
  return { difficulty, rules, puzzle, solution }
}

// ---- Playing ----

/** The cells whose digit repeats in a row, column, box (or region) or, in the diagonal variant, a diagonal. */
export function conflicts(grid: Grid, rules: Rules = CLASSIC): Set<number> {
  const bad = new Set<number>()
  for (const unit of rules.units) {
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
 * The empty cells that can no longer be solved from the board as it stands: a cell with no digit left that fits it, and every empty cell of a unit
 * where some digit has nowhere left to go. It is worked out from the cells on the board each time, so removing the digit that caused it clears the mark.
 */
export function deadCells(grid: Grid, rules: Rules = CLASSIC): Set<number> {
  const dead = new Set<number>()
  const cand = candidatesOf(grid, rules)
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0 && cand[i] === 0) dead.add(i)
  for (const unit of rules.units) {
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

/** What a hidden single was found in: a row, column, box, jigsaw region or diagonal. */
export type Technique = 'naked' | UnitKind

export type Hint =
  /** Entries that do not match the solution. */
  | { kind: 'mistake'; cells: number[] }
  /** A cell that can be filled with plain logic, and the reason. */
  | { kind: 'single'; index: number; value: number; technique: Technique }
  /** Nothing simple is left, so the hint names a digit from the solution. */
  | { kind: 'reveal'; index: number; value: number }

const HINT_ORDER: readonly UnitKind[] = ['box', 'region', 'row', 'column', 'diagonal']

/** The next helpful step for the grid the player has now (clues plus their own entries), or null when it is finished. */
export function nextHint(grid: Grid, solution: Grid, rules: Rules = CLASSIC): Hint | null {
  const wrong = grid.flatMap((v, i) => (v !== 0 && v !== solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  if (grid.every((v) => v !== 0)) return null
  const cand = candidatesOf(grid, rules)
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0 && count(cand[i]) === 1) return { kind: 'single', index: i, value: only(cand[i]), technique: 'naked' }
  const order = rules.units.map((_, u) => u).sort((a, b) => HINT_ORDER.indexOf(rules.kinds[a]) - HINT_ORDER.indexOf(rules.kinds[b]))
  for (const u of order) {
    const unit = rules.units[u]
    for (let d = 1; d <= 9; d++) {
      if (unit.some((c) => grid[c] === d)) continue
      const spots = unit.filter((c) => cand[c] & bit(d))
      if (spots.length === 1) return { kind: 'single', index: spots[0], value: d, technique: rules.kinds[u] }
    }
  }
  const empty = grid.flatMap((v, i) => (v === 0 ? [i] : []))
  const index = empty.reduce((a, b) => (count(cand[b]) < count(cand[a]) ? b : a))
  return { kind: 'reveal', index, value: solution[index] }
}

/** The digits still possible in a cell given the filled cells around it (used to tidy pencil marks). */
export const candidateDigits = (grid: Grid, i: number, rules: Rules = CLASSIC): number[] => {
  const mask = candidatesOf(grid, rules)[i]
  return Array.from({ length: 9 }, (_, k) => k + 1).filter((d) => mask & bit(d))
}

/** True when a cell's edge is a region boundary: the neighbour on that side belongs to another region (or there is none). Drives the thick borders. */
export const regionEdges = (rules: Rules, i: number): { right: boolean; bottom: boolean } => ({
  right: colOf(i) < 8 && rules.region[i] !== rules.region[i + 1],
  bottom: rowOf(i) < 8 && rules.region[i] !== rules.region[i + 9],
})

/** 0:07 style clock for a number of seconds. */
export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
