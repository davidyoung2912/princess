import { latinSquare, linesOf } from './futoshiki'
import { bit, count, only, shuffle, type Difficulty } from './sudoku'

/**
 * KenKen: an n by n Latin square (each digit once in every row and column) cut into bold cages. Each cage shows a target and an operation:
 * add, multiply, and (on two-cell cages only) subtract or divide. A one-cell cage is simply a given digit.
 * Cells hold 0 (empty) or a digit 1 to n. Framework-free so it can be tested in node.
 */

export type KenKenGrid = readonly number[]
export type Op = 'add' | 'sub' | 'mul' | 'div' | 'given'
export interface KCage { cells: readonly number[]; op: Op; target: number }

/** Board size, the biggest cage, and how many extra digits at least stay given (on top of the one-cell cages). */
export const KENKEN_LEVELS: Record<Difficulty, { size: number; maxCage: number; minGivens: number }> = {
  easy: { size: 4, maxCage: 2, minGivens: 2 },
  medium: { size: 5, maxCage: 3, minGivens: 2 },
  hard: { size: 6, maxCage: 4, minGivens: 0 },
  expert: { size: 7, maxCage: 4, minGivens: 0 },
}

export const OP_SYMBOL: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷', given: '' }
/** The short label drawn in a cage's corner. */
export const cageLabel = (c: KCage): string => (c.op === 'given' ? '' : `${c.target}${OP_SYMBOL[c.op]}`)

const allMask = (n: number) => (1 << n) - 1
const rowOf = (i: number, n: number) => Math.floor(i / n)
const colOf = (i: number, n: number) => i % n

export const gridNeighbours = (i: number, n: number): number[] => {
  const r = rowOf(i, n)
  const c = colOf(i, n)
  return [...(r > 0 ? [i - n] : []), ...(r < n - 1 ? [i + n] : []), ...(c > 0 ? [i - 1] : []), ...(c < n - 1 ? [i + 1] : [])]
}

/** Whether a full set of digits makes the cage's target. */
export function cageHolds(cage: KCage, values: readonly number[]): boolean {
  switch (cage.op) {
    case 'add': return values.reduce((a, b) => a + b, 0) === cage.target
    case 'mul': return values.reduce((a, b) => a * b, 1) === cage.target
    case 'sub': return Math.abs(values[0] - values[1]) === cage.target
    case 'div': return Math.max(values[0], values[1]) === cage.target * Math.min(values[0], values[1])
    default: return values[0] === cage.target
  }
}

/** Every way to fill the cage from the candidates left, so no two cells sharing a row or column match and the target is made. */
export function cageTuples(cage: KCage, cand: readonly number[], n: number): number[][] {
  const cells = cage.cells
  const out: number[][] = []
  const cur: number[] = []
  const rec = (k: number, sum: number, prod: number) => {
    if (k === cells.length) { if (cageHolds(cage, cur)) out.push([...cur]); return }
    for (let d = 1; d <= n; d++) {
      if (!(cand[cells[k]] & bit(d))) continue
      if (cage.op === 'add' && sum + d > cage.target) break
      if (cage.op === 'mul' && (prod * d > cage.target || cage.target % (prod * d) !== 0)) continue
      let clash = false
      for (let j = 0; j < k && !clash; j++) if (cur[j] === d && (rowOf(cells[j], n) === rowOf(cells[k], n) || colOf(cells[j], n) === colOf(cells[k], n))) clash = true
      if (clash) continue
      cur[k] = d
      rec(k + 1, sum + d, prod * d)
    }
  }
  rec(0, 0, 1)
  return out
}

/** What each square could still be: its row and column rule out placed digits, and (with `useCages`) the cages trim the rest until nothing changes. */
export function candidatesOf(grid: KenKenGrid, n: number, cages: readonly KCage[], useCages = true): number[] {
  const cand = Array<number>(n * n).fill(0)
  const rowSeen = Array<number>(n).fill(0)
  const colSeen = Array<number>(n).fill(0)
  grid.forEach((v, i) => { if (v) { rowSeen[rowOf(i, n)] |= bit(v); colSeen[colOf(i, n)] |= bit(v) } })
  for (let i = 0; i < n * n; i++) cand[i] = grid[i] ? bit(grid[i]) : allMask(n) & ~rowSeen[rowOf(i, n)] & ~colSeen[colOf(i, n)]
  if (!useCages) return cand
  const multi = cages.filter((c) => c.cells.length > 1)
  for (let changed = true; changed;) {
    changed = false
    for (const cage of multi) {
      const tuples = cageTuples(cage, cand, n)
      cage.cells.forEach((cell, k) => {
        const mask = tuples.reduce((m, tp) => m | bit(tp[k]), 0)
        if (mask !== cand[cell]) { cand[cell] = mask; changed = true }
      })
    }
  }
  return cand
}

export type KenKenTechnique = 'naked' | 'row' | 'column' | 'cage' | 'cageRow' | 'cageColumn'

export interface KMove { index: number; value: number; technique: KenKenTechnique; cells: number[]; /** The cage that forces the move, for the cage techniques. */ cage?: number }

/** The next square plain logic fills in, with the reason, or null when logic is stuck. */
export function findMove(grid: KenKenGrid, n: number, cages: readonly KCage[]): KMove | null {
  const plain = candidatesOf(grid, n, cages, false)
  const full = candidatesOf(grid, n, cages, true)
  const lines = linesOf(n)
  const cageIndex = (i: number) => cages.findIndex((c) => c.cells.includes(i))
  for (let i = 0; i < n * n; i++) if (!grid[i] && count(plain[i]) === 1) return { index: i, value: only(plain[i]), technique: 'naked', cells: [i] }
  const hidden = (cand: readonly number[], names: [KenKenTechnique, KenKenTechnique]): KMove | null => {
    for (const line of lines) {
      const placed = line.cells.reduce((m, i) => m | (grid[i] ? bit(grid[i]) : 0), 0)
      for (let d = 1; d <= n; d++) {
        if (placed & bit(d)) continue
        const spots = line.cells.filter((i) => !grid[i] && cand[i] & bit(d))
        if (spots.length !== 1) continue
        const cage = cageIndex(spots[0])
        return { index: spots[0], value: d, technique: line.kind === 'row' ? names[0] : names[1], cells: cage >= 0 && names[0] === 'cageRow' ? [...cages[cage].cells] : [spots[0]], cage }
      }
    }
    return null
  }
  const plainHidden = hidden(plain, ['row', 'column'])
  if (plainHidden) return plainHidden
  for (let i = 0; i < n * n; i++) {
    if (grid[i] || count(full[i]) !== 1) continue
    const cage = cageIndex(i)
    return { index: i, value: only(full[i]), technique: 'cage', cells: cage >= 0 ? [...cages[cage].cells] : [i], cage }
  }
  return hidden(full, ['cageRow', 'cageColumn'])
}

/** Fills the grid with plain logic only; the result still has gaps if logic gets stuck. */
export function logicSolveKenKen(puzzle: KenKenGrid, n: number, cages: readonly KCage[]): number[] {
  const g = [...puzzle]
  for (let m = findMove(g, n, cages); m; m = findMove(g, n, cages)) g[m.index] = m.value
  return g
}

/** Cuts the grid into connected cages of at most `maxCage` cells; a lone cell is folded into a neighbouring cage when there is room. Operations come later. */
export function cutCages(n: number, maxCage: number, random: () => number): number[][] {
  const owner = Array<number>(n * n).fill(-1)
  const groups: number[][] = []
  for (const start of shuffle(Array.from({ length: n * n }, (_, i) => i), random)) {
    if (owner[start] !== -1) continue
    const size = random() < 0.15 ? 1 : 2 + Math.floor(random() * (maxCage - 1))
    const cells = [start]
    owner[start] = groups.length
    while (cells.length < size) {
      const options = [...new Set(cells.flatMap((c) => gridNeighbours(c, n)))].filter((x) => owner[x] === -1)
      if (options.length === 0) break
      const next = options[Math.floor(random() * options.length)]
      owner[next] = groups.length
      cells.push(next)
    }
    groups.push(cells)
  }
  for (const group of groups) {
    if (group.length !== 1 || maxCage < 3) continue
    const [cell] = group
    const near = shuffle(gridNeighbours(cell, n), random).find((x) => groups[owner[x]].length < maxCage && groups[owner[x]] !== group)
    if (near === undefined) continue
    groups[owner[near]].push(cell)
    owner[cell] = owner[near]
    group.length = 0
  }
  return groups.filter((g) => g.length > 0).map((g) => g.sort((a, b) => a - b))
}

/** Gives a group of cells an operation and a target that its solution digits make. */
export function makeCage(cells: readonly number[], solution: KenKenGrid, random: () => number): KCage {
  const v = cells.map((c) => solution[c])
  if (cells.length === 1) return { cells, op: 'given', target: v[0] }
  const ops: Op[] = ['add', 'mul']
  if (cells.length === 2) {
    ops.push('sub', 'sub')
    if (Math.max(...v) % Math.min(...v) === 0) ops.push('div', 'div')
  }
  const op = ops[Math.floor(random() * ops.length)]
  const target = op === 'add' ? v.reduce((a, b) => a + b, 0) : op === 'mul' ? v.reduce((a, b) => a * b, 1) : op === 'sub' ? Math.abs(v[0] - v[1]) : Math.max(...v) / Math.min(...v)
  return { cells, op, target }
}

export interface KenKenPuzzle { size: number; difficulty: Difficulty; puzzle: number[]; solution: number[]; cages: KCage[] }

/**
 * A new puzzle: a Latin square cut into cages, with the one-cell cages already filled in. Extra digits are given until plain logic
 * finishes, then taken back one at a time while it still does, so the answer is unique and needs no guessing.
 */
export function generateKenKen(difficulty: Difficulty, random: () => number = Math.random): KenKenPuzzle {
  const { size: n, maxCage, minGivens } = KENKEN_LEVELS[difficulty]
  const solution = latinSquare(n, random)
  const cages = cutCages(n, maxCage, random).map((cells) => makeCage(cells, solution, random))
  const puzzle: number[] = Array(n * n).fill(0)
  for (const c of cages) if (c.op === 'given') puzzle[c.cells[0]] = c.target
  const fixed = new Set(cages.filter((c) => c.op === 'given').map((c) => c.cells[0]))
  const solves = () => logicSolveKenKen(puzzle, n, cages).every((v, i) => v === solution[i])
  const order = shuffle(Array.from({ length: n * n }, (_, k) => k).filter((i) => !fixed.has(i)), random)
  let extra = 0
  for (const i of order) {
    if (extra >= minGivens && solves()) break
    puzzle[i] = solution[i]
    extra++
  }
  for (const i of shuffle(order.filter((c) => puzzle[c] !== 0), random)) {
    if (extra <= minGivens) break
    puzzle[i] = 0
    if (solves()) extra--
    else puzzle[i] = solution[i]
  }
  return { size: n, difficulty, puzzle, solution, cages }
}

/** The cages that cannot come out right any more: full and wrong, or partly filled with a total already past the target (or not a factor of it). */
export function brokenCages(grid: KenKenGrid, cages: readonly KCage[]): KCage[] {
  return cages.filter((c) => {
    if (c.cells.length === 1) return false
    const filled = c.cells.map((i) => grid[i]).filter((v) => v !== 0)
    if (filled.length === c.cells.length) return !cageHolds(c, filled)
    if (c.op === 'add') return filled.reduce((a, b) => a + b, 0) >= c.target
    if (c.op === 'mul') { const p = filled.reduce((a, b) => a * b, 1); return p > c.target || c.target % p !== 0 }
    return false
  })
}

/** Cells that break a rule right now: a digit repeated in a row or column, or a cage that cannot be made. */
export function kenkenConflicts(grid: KenKenGrid, n: number, cages: readonly KCage[]): Set<number> {
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
  for (const c of brokenCages(grid, cages)) for (const i of c.cells) if (grid[i]) bad.add(i)
  return bad
}

/** Empty squares where no digit can go any more, counting the row, the column and the cages. */
export function kenkenDeadCells(grid: KenKenGrid, n: number, cages: readonly KCage[]): Set<number> {
  const cand = candidatesOf(grid, n, cages)
  const dead = new Set<number>()
  for (let i = 0; i < n * n; i++) if (!grid[i] && cand[i] === 0) dead.add(i)
  return dead
}

/** The digits a cage can still use somewhere, given the rows and columns and the other cells filled so far. */
export function cageDigits(grid: KenKenGrid, n: number, cages: readonly KCage[], cage: number): number[] {
  const cand = candidatesOf(grid, n, cages)
  const mask = cages[cage].cells.reduce((m, i) => m | cand[i], 0)
  return Array.from({ length: n }, (_, k) => k + 1).filter((d) => mask & bit(d))
}

export type KenKenHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: KMove; digits: number[] }
  | { kind: 'reveal'; index: number; value: number }

/** The next helpful step: wrong entries first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextKenKenHint(grid: KenKenGrid, solution: KenKenGrid, n: number, cages: readonly KCage[]): KenKenHint | null {
  const wrong = grid.flatMap((v, i) => (v !== 0 && v !== solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const index = grid.indexOf(0)
  if (index < 0) return null
  const move = findMove(grid, n, cages)
  if (!move) return { kind: 'reveal', index, value: solution[index] }
  return { kind: 'move', move, digits: move.cage !== undefined && move.cage >= 0 ? cageDigits(grid, n, cages, move.cage) : [] }
}

export const isKenKenSolved = (grid: KenKenGrid, solution: KenKenGrid): boolean => grid.every((v, i) => v === solution[i])
