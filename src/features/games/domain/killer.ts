/**
 * Killer Sudoku: classic Sudoku plus cages. A cage is a connected group of 1 to 5 cells whose digits are all different and add up to the number in its corner.
 * Generation builds a full grid, cuts it into cages, then adds just enough given digits for human logic alone to finish the puzzle. Because that logic only
 * ever makes forced moves, a puzzle it finishes has exactly one solution, so no guessing search is needed.
 */
import {
  ALL, DIFFICULTIES, bit, candidatesOf, conflicts, count, deadCells, fullGrid, makeRules, neighbours, nextHint, only, shuffle,
  type Cage, type Difficulty, type Grid, type Hint, type Puzzle, type Rules, type Technique,
} from './sudoku'

export { DIFFICULTIES }

const CELLS = 81

/** Digit sets (bit masks) of n different digits that add up to a sum: COMBOS[n][sum]. */
const COMBOS: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => [] as number[]))
for (let mask = 1; mask < 512; mask++) {
  let sum = 0
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) sum += d
  COMBOS[count(mask)][sum].push(mask)
}

const digitsOf = (mask: number): number[] => Array.from({ length: 9 }, (_, k) => k + 1).filter((d) => mask & bit(d))

/** The digit sets a cage can still be, given what is filled in and which digits each empty cell could take. */
function cageCombos(cage: Cage, values: readonly number[], cand: readonly number[]): number[] {
  let used = 0
  let filled = 0
  let union = 0
  let empty = 0
  for (const c of cage.cells) {
    if (values[c] !== 0) { used |= bit(values[c]); filled += values[c] } else { union |= cand[c]; empty++ }
  }
  const left = cage.sum - filled
  if (empty === 0 || left < 1 || left > 45) return []
  return COMBOS[empty][left].filter((m) => (m & used) === 0 && (m & ~union) === 0)
}

/** Takes every digit out of a cage's cells that no still-possible digit set uses. True when any candidate went. */
function pruneCages(cand: number[], values: readonly number[], rules: Rules): boolean {
  let changed = false
  for (const cage of rules.cages) {
    if (cage.cells.every((c) => values[c] !== 0)) continue
    const allowed = cageCombos(cage, values, cand).reduce((a, m) => a | m, 0)
    for (const c of cage.cells) {
      if (values[c] === 0 && (cand[c] & ~allowed) !== 0) { cand[c] &= allowed; changed = true }
    }
  }
  return changed
}

/**
 * The 45 rule: every row, column and box adds up to 45. If the cages inside a unit leave one cell over, that cell is 45 minus their sums (an innie); if the
 * cages touching a unit stick out by one cell, that cell is their sums minus 45 (an outie). Returns the forced cells.
 */
function sum45(values: readonly number[], rules: Rules): { index: number; value: number }[] {
  const found: { index: number; value: number }[] = []
  rules.units.forEach((unit, u) => {
    if (rules.kinds[u] === 'diagonal') return
    const inUnit = new Set(unit)
    const touching = new Set<number>()
    for (const c of unit) touching.add(rules.cageOf[c])
    let insideSum = 0
    const covered = new Set<number>()
    let touchSum = 0
    const outside: number[] = []
    for (const k of touching) {
      const cage = rules.cages[k]
      touchSum += cage.sum
      if (cage.cells.every((c) => inUnit.has(c))) { insideSum += cage.sum; cage.cells.forEach((c) => covered.add(c)) }
      else for (const c of cage.cells) if (!inUnit.has(c)) outside.push(c)
    }
    const rest = unit.filter((c) => !covered.has(c))
    if (rest.length === 1 && values[rest[0]] === 0) found.push({ index: rest[0], value: 45 - insideSum })
    if (outside.length === 1 && values[outside[0]] === 0) found.push({ index: outside[0], value: touchSum - 45 })
  })
  return found.filter((f) => f.value >= 1 && f.value <= 9)
}

export type KillerLogic = 1 | 2

/** Solves with human techniques only: singles and cage sums (level 1), plus the 45 rule (level 2). Null when it gets stuck. */
export function logicSolve(puzzle: Grid, rules: Rules, level: KillerLogic): number[] | null {
  const values = [...puzzle]
  const cand = candidatesOf(values, rules)
  const place = (i: number, d: number) => {
    values[i] = d
    cand[i] = 0
    for (const p of rules.peers[i]) cand[p] &= ~bit(d)
  }
  for (;;) {
    let progress = false
    for (let i = 0; i < CELLS; i++) if (values[i] === 0 && count(cand[i]) === 1) { place(i, only(cand[i])); progress = true }
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
    if (pruneCages(cand, values, rules)) continue
    if (level >= 2) {
      for (const f of sum45(values, rules)) if (values[f.index] === 0 && cand[f.index] & bit(f.value)) { place(f.index, f.value); progress = true }
      if (progress) continue
    }
    break
  }
  return values.every((v) => v !== 0) ? values : null
}

export const solvableByLogic = (puzzle: Grid, rules: Rules, level: KillerLogic): boolean => logicSolve(puzzle, rules, level) !== null

// ---- Generation ----

/** The biggest cage, the cage-size mix, the techniques allowed and the fewest given digits a level keeps. */
export const KILLER_LEVELS: Record<Difficulty, { maxCage: number; logic: KillerLogic; minGivens: number }> = {
  easy: { maxCage: 3, logic: 1, minGivens: 14 },
  medium: { maxCage: 4, logic: 1, minGivens: 6 },
  hard: { maxCage: 5, logic: 2, minGivens: 8 },
  expert: { maxCage: 5, logic: 2, minGivens: 0 },
}

/** Cuts the grid into connected cages of at most `maxCage` cells, each with no repeated digit in the solution. Single cells are merged away when they can be. */
export function makeCages(solution: Grid, maxCage: number, random: () => number): Cage[] {
  const owner = Array<number>(CELLS).fill(-1)
  const groups: number[][] = []
  for (const start of shuffle(Array.from({ length: CELLS }, (_, i) => i), random)) {
    if (owner[start] !== -1) continue
    const size = 1 + Math.floor(random() * maxCage)
    const cells = [start]
    owner[start] = groups.length
    while (cells.length < Math.min(size, maxCage)) {
      const options = [...new Set(cells.flatMap((c) => neighbours(c)))].filter((n) => owner[n] === -1 && !cells.some((c) => solution[c] === solution[n]))
      if (options.length === 0) break
      const next = options[Math.floor(random() * options.length)]
      owner[next] = groups.length
      cells.push(next)
    }
    groups.push(cells)
  }
  // Fold a lone cell into a neighbouring cage when the digits stay different and the cage stays small enough.
  for (const group of groups) {
    if (group.length !== 1 || maxCage < 3) continue
    const [cell] = group
    const near = shuffle(neighbours(cell), random).find((n) => {
      const other = groups[owner[n]]
      return other.length > 0 && other.length < maxCage && other !== group && !other.some((c) => solution[c] === solution[cell])
    })
    if (near === undefined) continue
    const other = groups[owner[near]]
    other.push(cell)
    owner[cell] = owner[near]
    group.length = 0
  }
  return groups.filter((g) => g.length > 0).map((cells) => ({ cells: cells.sort((a, b) => a - b), sum: cells.reduce((s, c) => s + solution[c], 0) }))
}

/** Makes a Killer puzzle: the clues are the few digits given on top of the cages. */
export function generateKiller(difficulty: Difficulty, random: () => number = Math.random): Puzzle {
  const { maxCage, logic, minGivens } = KILLER_LEVELS[difficulty]
  const solution = fullGrid(random)!
  const rules = makeRules('killer', undefined, makeCages(solution, maxCage, random))
  const puzzle = Array<number>(CELLS).fill(0)
  const order = shuffle(Array.from({ length: CELLS }, (_, i) => i), random)
  // Give digits until logic can finish, then take back any that turn out not to be needed (but keep the level's minimum).
  let given = 0
  for (const i of order) {
    if (given >= minGivens && solvableByLogic(puzzle, rules, logic)) break
    puzzle[i] = solution[i]
    given++
  }
  for (const i of shuffle(order.filter((c) => puzzle[c] !== 0), random)) {
    if (given <= minGivens) break
    puzzle[i] = 0
    if (solvableByLogic(puzzle, rules, logic)) given--
    else puzzle[i] = solution[i]
  }
  return { difficulty, rules, puzzle, solution }
}

// ---- Playing ----

/** Cells that break a rule: a repeat in a row, column or box, a repeat inside a cage, or a cage that is over its sum (or full and wrong). */
export function killerConflicts(grid: Grid, rules: Rules): Set<number> {
  const bad = conflicts(grid, rules)
  for (const cage of rules.cages) {
    const seen = new Map<number, number>()
    let sum = 0
    let empty = 0
    for (const c of cage.cells) {
      const d = grid[c]
      if (d === 0) { empty++; continue }
      sum += d
      const prev = seen.get(d)
      if (prev !== undefined) { bad.add(prev); bad.add(c) } else seen.set(d, c)
    }
    if (sum > cage.sum || (empty === 0 && sum !== cage.sum)) for (const c of cage.cells) if (grid[c] !== 0) bad.add(c)
  }
  return bad
}

/** Empty cells that can no longer be solved, including every empty cell of a cage whose sum can no longer be made. */
export function killerDeadCells(grid: Grid, rules: Rules): Set<number> {
  const dead = deadCells(grid, rules)
  const cand = candidatesOf(grid, rules)
  for (const cage of rules.cages) {
    if (cage.cells.every((c) => grid[c] !== 0)) continue
    if (cageCombos(cage, grid, cand).length === 0) for (const c of cage.cells) if (grid[c] === 0) dead.add(c)
  }
  return dead
}

export type KillerTechnique = Technique | 'cage' | 'sum45'

export type KillerHint =
  | Exclude<Hint, { kind: 'single' }>
  | { kind: 'single'; index: number; value: number; technique: KillerTechnique }
  /** A cage whose sum leaves one possible set of digits. */
  | { kind: 'cage'; cage: number; digits: number[] }

/** The next helpful step: a mistake, a plain single, a single the cage sums force, the 45 rule, the digits of a tight cage, or (last) a revealed digit. */
export function nextKillerHint(grid: Grid, solution: Grid, rules: Rules): KillerHint | null {
  const plain = nextHint(grid, solution, rules)
  if (!plain || plain.kind !== 'reveal') return plain
  const plainCand = candidatesOf(grid, rules)
  const cand = [...plainCand]
  while (pruneCages(cand, grid, rules)) { /* until nothing more goes */ }
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0 && count(cand[i]) === 1) return { kind: 'single', index: i, value: only(cand[i]), technique: 'cage' }
  for (const unit of rules.units) {
    for (let d = 1; d <= 9; d++) {
      if (unit.some((c) => grid[c] === d)) continue
      const spots = unit.filter((c) => cand[c] & bit(d))
      if (spots.length === 1) return { kind: 'single', index: spots[0], value: d, technique: 'cage' }
    }
  }
  const forced = sum45(grid, rules).find((f) => f.value === solution[f.index])
  if (forced) return { kind: 'single', index: forced.index, value: forced.value, technique: 'sum45' }
  for (let k = 0; k < rules.cages.length; k++) {
    const combos = cageCombos(rules.cages[k], grid, plainCand)
    const cells = rules.cages[k].cells.filter((c) => grid[c] === 0)
    if (combos.length === 1 && cells.some((c) => plainCand[c] & ~combos[0] & ALL)) return { kind: 'cage', cage: k, digits: digitsOf(combos[0]) }
  }
  return plain
}
