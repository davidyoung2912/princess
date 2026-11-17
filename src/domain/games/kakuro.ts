import { bit, count, only, shuffle, type Difficulty } from './sudoku'

/**
 * Kakuro: a crossword-style grid. Black squares carry clues; white squares take 1 to 9. A run is a line of white squares
 * (across or down) that starts after a clue; its digits may not repeat and must add to the clue. The first row and column
 * are always black. Cells hold 0 (empty or black) or a digit. Framework-free so it can be tested in node.
 */

export type KakuroGrid = readonly number[]
export interface KRun { cells: readonly number[]; sum: number; across: boolean; /** The black square that carries the clue. */ clue: number }

/** Grid size (the clue row and column included), the longest run, and how many digits at least stay given. */
export const KAKURO_LEVELS: Record<Difficulty, { size: number; maxRun: number; minGivens: number }> = {
  easy: { size: 6, maxRun: 4, minGivens: 3 },
  medium: { size: 8, maxRun: 5, minGivens: 2 },
  hard: { size: 9, maxRun: 7, minGivens: 0 },
  expert: { size: 10, maxRun: 9, minGivens: 0 },
}

const digitsOf = (mask: number): number[] => Array.from({ length: 9 }, (_, k) => k + 1).filter((d) => mask & bit(d))
const maskSum = (mask: number): number => digitsOf(mask).reduce((a, b) => a + b, 0)

const comboCache = new Map<number, number[]>()
/** Every set of `len` different digits that adds to `sum`, each as a bit mask ("16 in 2 cells" is {7, 9}). */
export function combosOf(len: number, sum: number): number[] {
  const key = len * 100 + sum
  let found = comboCache.get(key)
  if (!found) {
    found = []
    for (let m = 1; m < 512; m++) if (count(m) === len && maskSum(m) === sum) found.push(m)
    comboCache.set(key, found)
  }
  return found
}

/** Maximal lines of white squares, of any length (including single squares). `clue` is the square before the line. */
function rawRuns(white: readonly boolean[], n: number): { cells: number[]; across: boolean; clue: number }[] {
  const out: { cells: number[]; across: boolean; clue: number }[] = []
  for (const across of [true, false]) {
    for (let a = 0; a < n; a++) {
      let cells: number[] = []
      const flush = () => { if (cells.length) out.push({ cells, across, clue: across ? cells[0] - 1 : cells[0] - n }); cells = [] }
      for (let b = 0; b < n; b++) {
        const i = across ? a * n + b : b * n + a
        if (white[i]) cells.push(i)
        else flush()
      }
      flush()
    }
  }
  return out
}

/** The runs of a layout (length 2 or more) with sums read from the digits in `solution`. */
export function runsOf(white: readonly boolean[], n: number, solution: KakuroGrid): KRun[] {
  return rawRuns(white, n).filter((r) => r.cells.length >= 2).map((r) => ({ ...r, sum: r.cells.reduce((s, i) => s + solution[i], 0) }))
}

/** For every square, the index of the across run and of the down run it belongs to (-1 for none). */
export function indexRuns(runs: readonly KRun[], n: number): { across: number[]; down: number[] } {
  const across = Array<number>(n * n).fill(-1)
  const down = Array<number>(n * n).fill(-1)
  runs.forEach((r, k) => r.cells.forEach((i) => { (r.across ? across : down)[i] = k }))
  return { across, down }
}

const rowOf = (i: number, n: number) => Math.floor(i / n)
const colOf = (i: number, n: number) => i % n

/** A random layout: the first row and column black, the rest mostly white, point symmetric, every run 2 to `maxRun` long and all the white squares joined. */
export function makeLayout(n: number, maxRun: number, random: () => number): boolean[] | null {
  const white = Array<boolean>(n * n).fill(false)
  const twin = (i: number) => (n - rowOf(i, n)) * n + (n - colOf(i, n))
  const set = (i: number, w: boolean) => { white[i] = w; white[twin(i)] = w }
  for (let r = 1; r < n; r++) for (let c = 1; c < n; c++) if (r * n + c <= twin(r * n + c)) set(r * n + c, random() > 0.27)
  for (let pass = 0; pass < 80; pass++) {
    let changed = false
    for (const run of rawRuns(white, n)) {
      if (run.cells.length === 1) { set(run.cells[0], false); changed = true }
      else if (run.cells.length > maxRun) { set(run.cells[2 + Math.floor(random() * (run.cells.length - 4))], false); changed = true }
    }
    if (!changed) break
  }
  const runs = rawRuns(white, n)
  if (runs.some((r) => r.cells.length < 2 || r.cells.length > maxRun)) return null
  const whites = white.flatMap((w, i) => (w ? [i] : []))
  if (whites.length < 0.45 * (n - 1) * (n - 1)) return null
  const seen = new Set([whites[0]])
  const queue = [whites[0]]
  while (queue.length) {
    const i = queue.pop()!
    for (const j of [i - 1, i + 1, i - n, i + n]) if (j >= 0 && j < n * n && white[j] && !seen.has(j) && Math.abs(colOf(j, n) - colOf(i, n)) <= 1) { seen.add(j); queue.push(j) }
  }
  return seen.size === whites.length ? white : null
}

/** Fills every white square with 1 to 9, no repeat in a run, by backtracking in reading order (null when the search gives up). */
export function fillLayout(white: readonly boolean[], n: number, random: () => number, budget = 20000): number[] | null {
  const g = Array<number>(n * n).fill(0)
  const order = white.flatMap((w, i) => (w ? [i] : []))
  let nodes = 0
  const taken = (i: number) => {
    let m = 0
    for (let j = i - 1; j >= 0 && white[j] && colOf(j, n) < colOf(i, n); j--) m |= bit(g[j])
    for (let j = i - n; j >= 0 && white[j]; j -= n) m |= bit(g[j])
    return m
  }
  const rec = (k: number): boolean => {
    if (k === order.length) return true
    if (++nodes > budget) return false
    const i = order[k]
    const used = taken(i)
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
      if (used & bit(d)) continue
      g[i] = d
      if (rec(k + 1)) return true
    }
    g[i] = 0
    return false
  }
  return rec(0) ? g : null
}

/** Which digits can still be in a run given the digits already placed: the sets that hold them all. */
export function runState(run: KRun, grid: KakuroGrid): { placed: number; allowed: number; empty: number } {
  let placed = 0
  let empty = 0
  let dup = false
  for (const i of run.cells) {
    if (!grid[i]) { empty++; continue }
    if (placed & bit(grid[i])) dup = true
    placed |= bit(grid[i])
  }
  if (dup) return { placed, allowed: 0, empty }
  let allowed = 0
  for (const c of combosOf(run.cells.length, run.sum)) if ((c & placed) === placed) allowed |= c
  return { placed, allowed, empty }
}

/** For each square of a run, the digits it can take in at least one way of filling the whole run (distinct digits, right sum). */
function runReach(cand: readonly number[], combos: readonly number[]): number[] {
  const len = cand.length
  const fits = (m: number) => combos.some((c) => (c & m) === m)
  const layers: Set<number>[] = [new Set([0])]
  for (let k = 0; k < len; k++) {
    const next = new Set<number>()
    for (const m of layers[k]) for (let d = 1; d <= 9; d++) if (cand[k] & bit(d) && !(m & bit(d)) && fits(m | bit(d))) next.add(m | bit(d))
    layers.push(next)
  }
  const good: Set<number>[] = layers.map(() => new Set<number>())
  good[len] = layers[len]
  const reach = Array<number>(len).fill(0)
  for (let k = len - 1; k >= 0; k--) {
    for (const m of layers[k]) {
      for (let d = 1; d <= 9; d++) {
        if (cand[k] & bit(d) && !(m & bit(d)) && good[k + 1].has(m | bit(d))) { good[k].add(m); reach[k] |= bit(d) }
      }
    }
  }
  return reach
}

/**
 * What each white square could still be. Without `deep`, each run only rules out digits no combination of its sum allows and
 * the digits already placed in it (the combination tables). With `deep`, runs and the squares they cross are worked through together until nothing changes.
 */
export function candidatesOf(grid: KakuroGrid, n: number, runs: readonly KRun[], deep = true): number[] {
  const { across, down } = indexRuns(runs, n)
  const cand = Array<number>(n * n).fill(0)
  for (let i = 0; i < n * n; i++) {
    if (across[i] < 0 && down[i] < 0) continue
    if (grid[i]) { cand[i] = bit(grid[i]); continue }
    let m = 511
    for (const k of [across[i], down[i]]) if (k >= 0) { const s = runState(runs[k], grid); m &= s.allowed & ~s.placed }
    cand[i] = m
  }
  if (!deep) return cand
  const table = runs.map((r) => combosOf(r.cells.length, r.sum))
  for (let changed = true; changed;) {
    changed = false
    runs.forEach((run, k) => {
      const reach = runReach(run.cells.map((i) => cand[i]), table[k])
      run.cells.forEach((i, j) => {
        const next = cand[i] & reach[j]
        if (next !== cand[i]) { cand[i] = next; changed = true }
      })
    })
  }
  return cand
}

export type KakuroTechnique = 'last' | 'cross' | 'deep'
/** A move plain logic can make: `runs` are the runs it comes from (the run with one gap for `last`, otherwise both runs of the square). */
export interface KMove { index: number; value: number; technique: KakuroTechnique; runs: number[] }

/** The next square plain logic fills in, with the reason, or null when logic is stuck. */
export function findMove(grid: KakuroGrid, n: number, runs: readonly KRun[]): KMove | null {
  const { across, down } = indexRuns(runs, n)
  const of = (i: number) => [across[i], down[i]].filter((k) => k >= 0)
  for (const [k, run] of runs.entries()) {
    const gaps = run.cells.filter((i) => !grid[i])
    if (gaps.length !== 1) continue
    const value = run.sum - run.cells.reduce((s, i) => s + grid[i], 0)
    if (value >= 1 && value <= 9) return { index: gaps[0], value, technique: 'last', runs: [k] }
  }
  const plain = candidatesOf(grid, n, runs, false)
  for (let i = 0; i < n * n; i++) if (!grid[i] && of(i).length && count(plain[i]) === 1) return { index: i, value: only(plain[i]), technique: 'cross', runs: of(i) }
  const full = candidatesOf(grid, n, runs, true)
  for (let i = 0; i < n * n; i++) if (!grid[i] && of(i).length && count(full[i]) === 1) return { index: i, value: only(full[i]), technique: 'deep', runs: of(i) }
  return null
}

/** Whether plain logic alone fills every white square. */
export function logicSolves(puzzle: KakuroGrid, n: number, runs: readonly KRun[]): boolean {
  const cand = candidatesOf(puzzle, n, runs)
  return runs.every((r) => r.cells.every((i) => count(cand[i]) === 1))
}

/** Fills the grid with plain logic only; the result still has gaps if logic gets stuck. */
export function logicSolveKakuro(puzzle: KakuroGrid, n: number, runs: readonly KRun[]): number[] {
  const g = [...puzzle]
  for (let m = findMove(g, n, runs); m; m = findMove(g, n, runs)) g[m.index] = m.value
  return g
}

export interface KakuroPuzzle { size: number; difficulty: Difficulty; white: boolean[]; puzzle: number[]; solution: number[]; runs: KRun[] }

/** Reveals digits one at a time (in a random order) until logic finishes, then takes back any that are not needed. Returns the givens kept. */
function chooseGivens(white: readonly boolean[], n: number, solution: number[], runs: KRun[], minGivens: number, random: () => number): number[] {
  const puzzle = Array<number>(n * n).fill(0)
  const cells = shuffle(white.flatMap((w, i) => (w ? [i] : [])), random)
  const floor = Math.min(minGivens, Math.floor(cells.length / 4))
  let given = 0
  for (const i of cells) {
    if (given >= floor && logicSolves(puzzle, n, runs)) break
    puzzle[i] = solution[i]
    given++
  }
  for (const i of shuffle(cells.filter((c) => puzzle[c] !== 0), random)) {
    if (given <= floor) break
    puzzle[i] = 0
    if (logicSolves(puzzle, n, runs)) given--
    else puzzle[i] = solution[i]
  }
  return puzzle
}

/**
 * A new puzzle: a random symmetric layout filled with digits, the sums read off, then just enough given digits that plain logic finishes
 * (so the answer is unique and needs no guessing). A few layouts are tried and the one needing the fewest givens wins.
 */
export function generateKakuro(difficulty: Difficulty, random: () => number = Math.random): KakuroPuzzle {
  const { size: n, maxRun, minGivens } = KAKURO_LEVELS[difficulty]
  let best: KakuroPuzzle | null = null
  let bestGivens = Infinity
  for (let attempt = 0; attempt < 400 && (best === null || (attempt < 24 && bestGivens > minGivens)); attempt++) {
    const white = makeLayout(n, maxRun, random)
    if (!white) continue
    const solution = fillLayout(white, n, random)
    if (!solution) continue
    const runs = runsOf(white, n, solution)
    const puzzle = chooseGivens(white, n, solution, runs, minGivens, random)
    const givens = puzzle.filter((v) => v !== 0).length
    if (givens < bestGivens) { bestGivens = givens; best = { size: n, difficulty, white, puzzle, solution, runs } }
  }
  if (!best) throw new Error('Kakuro generator found no layout')
  return best
}

/** Squares that break a rule right now: every filled square of a run that no combination can still make (a repeat, a total that is too high, too low or wrong). */
export function kakuroConflicts(grid: KakuroGrid, runs: readonly KRun[]): Set<number> {
  const bad = new Set<number>()
  for (const run of runs) {
    const s = runState(run, grid)
    if (s.placed !== 0 && s.allowed === 0) for (const i of run.cells) if (grid[i]) bad.add(i)
  }
  return bad
}

/** Empty squares where no digit can go any more, counting both runs and the squares they cross. */
export function kakuroDeadCells(grid: KakuroGrid, n: number, runs: readonly KRun[]): Set<number> {
  const cand = candidatesOf(grid, n, runs)
  const dead = new Set<number>()
  const { across, down } = indexRuns(runs, n)
  for (let i = 0; i < n * n; i++) if (!grid[i] && (across[i] >= 0 || down[i] >= 0) && cand[i] === 0) dead.add(i)
  return dead
}

/** The digits a run can still use, given what is placed in it. */
export const runDigits = (run: KRun, grid: KakuroGrid): number[] => digitsOf(runState(run, grid).allowed)

export type KakuroHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: KMove; digits: number[][] }
  | { kind: 'reveal'; index: number; value: number }

/** The next helpful step: wrong entries first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextKakuroHint(grid: KakuroGrid, solution: KakuroGrid, n: number, runs: readonly KRun[], white: readonly boolean[]): KakuroHint | null {
  const wrong = grid.flatMap((v, i) => (v !== 0 && v !== solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const index = white.findIndex((w, i) => w && grid[i] === 0)
  if (index < 0) return null
  const move = findMove(grid, n, runs)
  if (!move) return { kind: 'reveal', index, value: solution[index] }
  return { kind: 'move', move, digits: move.runs.map((k) => runDigits(runs[k], grid)) }
}

export const isKakuroSolved = (grid: KakuroGrid, solution: KakuroGrid): boolean => grid.every((v, i) => v === solution[i])
