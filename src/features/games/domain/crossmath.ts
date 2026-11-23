import { shuffle, type Difficulty } from './sudoku'

/**
 * Crossmath: a crossword-style grid of numbers and signs. Every equation reads `a sign b = c` across or down, and equations cross at number squares.
 * Some numbers are given; the rest are blank and are filled from a tray (each tray number used once). Every puzzle has one answer that plain logic
 * finds without guessing. Framework-free so it can be tested in node.
 */
export type Sign = '+' | '−' | '×' | '÷'
export type CellKind = 'void' | 'num' | 'op' | 'eq'

/** One equation: the grid indexes of its three number squares (a, b, c), its sign and which way it runs. The sign and "=" squares sit between them. */
export interface Equation { a: number; b: number; c: number; sign: Sign; dir: 'across' | 'down' }

export interface CrossmathPuzzle {
  difficulty: Difficulty
  rows: number
  cols: number
  kind: readonly CellKind[]
  /** The sign or "=" shown in an op or eq square, empty elsewhere. */
  symbol: readonly string[]
  /** The answer for every number square (0 elsewhere). */
  solution: readonly number[]
  /** The starting grid: given numbers shown, blanks 0. */
  start: readonly number[]
  equations: readonly Equation[]
  /** The numbers to place, sorted, one entry per blank (repeats allowed). */
  tray: readonly number[]
}

/** The signs in play, the biggest number, how many equations to try for, the share of numbers that may be blank, and the logic allowed. */
export interface CrossmathLevel { rows: number; cols: number; signs: readonly Sign[]; max: number; equations: number; blankShare: number; techniques: readonly CrossmathTechnique[] }
export const CROSSMATH_LEVELS: Record<Difficulty, CrossmathLevel> = {
  easy: { rows: 7, cols: 7, signs: ['+', '−'], max: 20, equations: 5, blankShare: 0.45, techniques: ['one'] },
  medium: { rows: 9, cols: 9, signs: ['+', '−', '×'], max: 30, equations: 7, blankShare: 0.55, techniques: ['one', 'fit'] },
  hard: { rows: 11, cols: 11, signs: ['+', '−', '×', '÷'], max: 50, equations: 8, blankShare: 1, techniques: ['one', 'fit', 'tray'] },
  expert: { rows: 11, cols: 13, signs: ['+', '−', '×', '÷'], max: 99, equations: 10, blankShare: 1, techniques: ['one', 'fit', 'tray'] },
}

/** Whether a sign makes `a sign b = c` true. */
export function holds(sign: Sign, a: number, b: number, c: number): boolean {
  if (sign === '+') return a + b === c
  if (sign === '−') return a - b === c
  if (sign === '×') return a * b === c
  return b !== 0 && a === b * c
}

/** The one number that completes an equation when exactly one of the three is 0, or null when it is not a whole positive number. */
export function missingNumber(sign: Sign, a: number, b: number, c: number): number | null {
  let v: number
  if (a === 0) v = sign === '+' ? c - b : sign === '−' ? b + c : sign === '×' ? c / b : b * c
  else if (b === 0) v = sign === '+' ? c - a : sign === '−' ? a - c : sign === '×' ? c / a : a / c
  else v = sign === '+' ? a + b : sign === '−' ? a - b : sign === '×' ? a * b : a / b
  return Number.isInteger(v) && v >= 1 ? v : null
}

const triplesCache = new Map<string, readonly [number, number, number][]>()
/** Every true equation for a sign with all numbers from 1 to max (no times or divide by 1). */
function triples(sign: Sign, max: number): readonly [number, number, number][] {
  const key = `${sign}${max}`
  const hit = triplesCache.get(key)
  if (hit) return hit
  const out: [number, number, number][] = []
  for (let a = 1; a <= max; a++) {
    for (let b = 1; b <= max; b++) {
      if (sign === '+' && a + b <= max) out.push([a, b, a + b])
      else if (sign === '−' && a > b) out.push([a, b, a - b])
      else if (sign === '×' && a >= 2 && b >= 2 && a * b <= max) out.push([a, b, a * b])
      else if (sign === '÷' && b >= 2 && b <= 12) for (let c = 2; b * c <= max; c++) if (a === b * c) out.push([a, b, c])
    }
  }
  triplesCache.set(key, out)
  return out
}

/** A random true equation, optionally with one slot (0 a, 1 b, 2 c) fixed to a value. */
function randomEquation(signs: readonly Sign[], max: number, random: () => number, fixed?: { slot: 0 | 1 | 2; value: number }): { sign: Sign; n: [number, number, number] } | null {
  for (const sign of shuffle(signs, random)) {
    const pool = fixed ? triples(sign, max).filter((t) => t[fixed.slot] === fixed.value) : triples(sign, max)
    if (pool.length) return { sign, n: pool[Math.floor(random() * pool.length)] }
  }
  return null
}

interface Layout { rows: number; cols: number; kind: CellKind[]; symbol: string[]; value: number[]; equations: Equation[] }

/** Squares of an equation in reading order: a, sign, b, "=", c. */
const slotCells = (rows: number, cols: number, r: number, c: number, dir: 'across' | 'down'): number[] =>
  Array.from({ length: 5 }, (_, k) => (dir === 'across' ? r : r + k) * cols + (dir === 'across' ? c + k : c)).filter((_, k) => (dir === 'across' ? c + k < cols : r + k < rows))

/** Grows a tree of crossing equations: each new one crosses an existing number square and touches nothing else. */
function growLayout(level: CrossmathLevel, random: () => number): Layout | null {
  const { rows, cols } = level
  const kind: CellKind[] = Array(rows * cols).fill('void')
  const symbol: string[] = Array(rows * cols).fill('')
  const value: number[] = Array(rows * cols).fill(0)
  const equations: Equation[] = []
  const through = new Map<number, number>() // number square -> equations through it

  const place = (r: number, c: number, dir: 'across' | 'down', sign: Sign, n: [number, number, number]): Equation => {
    const cells = slotCells(rows, cols, r, c, dir)
    const kinds: CellKind[] = ['num', 'op', 'num', 'eq', 'num']
    cells.forEach((cell, k) => {
      kind[cell] = kinds[k]
      if (k === 1) symbol[cell] = sign
      if (k === 3) symbol[cell] = '='
      if (kinds[k] === 'num') { value[cell] = n[k / 2]; through.set(cell, (through.get(cell) ?? 0) + 1) }
    })
    const eq: Equation = { a: cells[0], b: cells[2], c: cells[4], sign, dir }
    equations.push(eq)
    return eq
  }

  const first = randomEquation(level.signs, level.max, random)
  if (!first) return null
  place(1 + Math.floor(random() * (rows - 2)), Math.floor(random() * (cols - 4)), 'across', first.sign, first.n)

  for (let attempt = 0; attempt < 400 && equations.length < level.equations; attempt++) {
    const open = [...through].filter(([, k]) => k === 1).map(([cell]) => cell)
    if (!open.length) break
    const cell = open[Math.floor(random() * open.length)]
    const host = equations.find((e) => e.a === cell || e.b === cell || e.c === cell)!
    const dir = host.dir === 'across' ? 'down' : 'across'
    const slot = Math.floor(random() * 3) as 0 | 1 | 2
    const cr = Math.floor(cell / cols)
    const cc = cell % cols
    const r = dir === 'down' ? cr - 2 * slot : cr
    const c = dir === 'across' ? cc - 2 * slot : cc
    if (r < 0 || c < 0 || (dir === 'down' ? r + 4 >= rows : c + 4 >= cols)) continue
    const cells = slotCells(rows, cols, r, c, dir)
    const before = dir === 'down' ? (r > 0 ? (r - 1) * cols + c : -1) : (c > 0 ? r * cols + c - 1 : -1)
    const after = dir === 'down' ? (r + 5 < rows ? (r + 5) * cols + c : -1) : (c + 5 < cols ? r * cols + c + 5 : -1)
    if ((before >= 0 && kind[before] !== 'void') || (after >= 0 && kind[after] !== 'void')) continue
    let free = true
    for (const x of cells) {
      if (x === cell) continue
      const xr = Math.floor(x / cols)
      const xc = x % cols
      const sides = dir === 'down' ? [[xr, xc - 1], [xr, xc + 1]] : [[xr - 1, xc], [xr + 1, xc]]
      if (kind[x] !== 'void' || sides.some(([sr, sc]) => sr >= 0 && sc >= 0 && sr < rows && sc < cols && kind[sr * cols + sc] !== 'void')) { free = false; break }
    }
    if (!free) continue
    const eq = randomEquation(level.signs, level.max, random, { slot, value: value[cell] })
    if (!eq) continue
    place(r, c, dir, eq.sign, eq.n)
  }
  return equations.length >= level.equations - 1 ? { rows, cols, kind, symbol, value, equations } : null
}

/** Cuts the empty rows and columns off the edges. */
function crop(l: Layout): Layout {
  let r0 = l.rows, r1 = -1, c0 = l.cols, c1 = -1
  l.kind.forEach((k, i) => {
    if (k === 'void') return
    const r = Math.floor(i / l.cols)
    const c = i % l.cols
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c)
  })
  const rows = r1 - r0 + 1
  const cols = c1 - c0 + 1
  const map = (i: number) => (Math.floor(i / l.cols) - r0) * cols + (i % l.cols) - c0
  const pick = <T,>(arr: readonly T[]): T[] => {
    const out: T[] = []
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(arr[r * l.cols + c])
    return out
  }
  return { rows, cols, kind: pick(l.kind), symbol: pick(l.symbol), value: pick(l.value), equations: l.equations.map((e) => ({ ...e, a: map(e.a), b: map(e.b), c: map(e.c) })) }
}

/* ---- The logic: what is forced from the numbers on the board and the numbers left in the tray ---- */

export type CrossmathTechnique = 'one' | 'fit' | 'tray'

/** One forced move: a square, its number, the rule that forces it, and the equation or other numbers behind it. */
export interface CrossmathMove { index: number; value: number; technique: CrossmathTechnique; equation: number; others: number[] }

/** The numbers still in the tray, once the numbers already on the board are taken out. */
export function trayLeft(tray: readonly number[], vals: readonly number[], blanks: readonly number[]): number[] {
  const left = [...tray]
  for (const i of blanks) if (vals[i] > 0) { const k = left.indexOf(vals[i]); if (k >= 0) left.splice(k, 1) }
  return left
}

/** Every number square that starts blank. */
export const blanksOf = (p: Pick<CrossmathPuzzle, 'start' | 'kind'>): number[] => p.kind.flatMap((k, i) => (k === 'num' && p.start[i] === 0 ? [i] : []))

/** For each blank, the tray numbers that could still go there so every equation through it can be completed from the tray. */
function candidates(equations: readonly Equation[], vals: readonly number[], blanks: readonly number[], left: readonly number[]): Map<number, Set<number>> {
  const distinct = [...new Set(left)]
  const have = (v: number) => left.filter((x) => x === v).length
  const dom = new Map<number, Set<number>>(blanks.filter((i) => vals[i] === 0).map((i) => [i, new Set(distinct)]))
  for (const e of equations) {
    const slots = [e.a, e.b, e.c]
    const blank = slots.filter((s) => vals[s] === 0)
    if (!blank.length) continue
    const support: Set<number>[] = slots.map(() => new Set<number>())
    const tryFill = (n: [number, number, number]) => {
      const used = new Map<number, number>()
      for (let k = 0; k < 3; k++) if (vals[slots[k]] === 0) used.set(n[k], (used.get(n[k]) ?? 0) + 1)
      for (const [v, k] of used) if (k > have(v)) return
      if (!holds(e.sign, n[0], n[1], n[2])) return
      for (let k = 0; k < 3; k++) support[k].add(n[k])
    }
    const choices = (k: number): number[] => (vals[slots[k]] === 0 ? distinct : [vals[slots[k]]])
    for (const a of choices(0)) for (const b of choices(1)) {
      if (vals[e.c] !== 0) tryFill([a, b, vals[e.c]])
      else {
        const c = e.sign === '+' ? a + b : e.sign === '−' ? a - b : e.sign === '×' ? a * b : a / b
        if (Number.isInteger(c) && c >= 1) tryFill([a, b, c])
      }
    }
    slots.forEach((s, k) => {
      const d = dom.get(s)
      if (d) for (const v of [...d]) if (!support[k].has(v)) d.delete(v)
    })
  }
  return dom
}

/** The next forced move from the board as it stands, using only the allowed rules, or null when none applies. */
export function findCrossmathMove(equations: readonly Equation[], vals: readonly number[], blanks: readonly number[], tray: readonly number[], techniques: readonly CrossmathTechnique[]): CrossmathMove | null {
  const open = blanks.filter((i) => vals[i] === 0)
  if (!open.length) return null
  // One blank left in an equation: plain arithmetic.
  if (techniques.includes('one')) {
    for (let q = 0; q < equations.length; q++) {
      const e = equations[q]
      const slots = [e.a, e.b, e.c]
      const missing = slots.filter((s) => vals[s] === 0)
      if (missing.length !== 1) continue
      const v = missingNumber(e.sign, vals[e.a], vals[e.b], vals[e.c])
      if (v !== null) return { index: missing[0], value: v, technique: 'one', equation: q, others: slots.filter((s) => s !== missing[0]) }
    }
  }
  const left = trayLeft(tray, vals, blanks)
  const dom = candidates(equations, vals, open, left)
  if (techniques.includes('fit')) {
    for (const [i, d] of dom) {
      if (d.size !== 1) continue
      const q = equations.findIndex((e) => e.a === i || e.b === i || e.c === i)
      return { index: i, value: [...d][0], technique: 'fit', equation: q, others: [] }
    }
  }
  if (techniques.includes('tray')) {
    for (const v of new Set(left)) {
      const k = left.filter((x) => x === v).length
      const fits = [...dom].filter(([, d]) => d.has(v)).map(([i]) => i)
      if (fits.length === k) return { index: fits[0], value: v, technique: 'tray', equation: -1, others: fits.slice(1) }
    }
  }
  return null
}

/** Whether the allowed logic alone fills every blank starting from `start`. */
export function logicSolveCrossmath(p: Pick<CrossmathPuzzle, 'equations' | 'kind' | 'tray'>, start: readonly number[], techniques: readonly CrossmathTechnique[]): number[] | null {
  const vals = [...start]
  const blanks = p.kind.flatMap((k, i) => (k === 'num' && start[i] === 0 ? [i] : []))
  for (let guard = 0; guard <= blanks.length; guard++) {
    const m = findCrossmathMove(p.equations, vals, blanks, p.tray, techniques)
    if (!m) break
    vals[m.index] = m.value
  }
  return blanks.every((i) => vals[i] > 0) ? vals : null
}

/** Makes a puzzle: lay out and fill equations, then blank numbers one at a time while the allowed logic still finishes the grid. */
export function generateCrossmath(difficulty: Difficulty, random: () => number = Math.random): CrossmathPuzzle {
  const level = CROSSMATH_LEVELS[difficulty]
  for (let attempt = 0; ; attempt++) {
    const layout = growLayout(attempt < 300 ? level : { ...level, equations: 1 }, random)
    if (!layout) continue
    const l = crop(layout)
    const numbers = l.kind.flatMap((k, i) => (k === 'num' ? [i] : []))
    const frame = { equations: l.equations, kind: l.kind, tray: [] as number[] }
    const start = [...l.value]
    const cap = Math.floor(numbers.length * level.blankShare)
    let blank = 0
    for (const i of shuffle(numbers, random)) {
      if (blank >= cap) break
      const was = start[i]
      start[i] = 0
      const tray = numbers.filter((x) => start[x] === 0).map((x) => l.value[x]).sort((x, y) => x - y)
      const solved = logicSolveCrossmath({ ...frame, tray }, start, level.techniques)
      if (solved && numbers.every((x) => solved[x] === l.value[x])) blank++
      else start[i] = was
    }
    const tray = numbers.filter((x) => start[x] === 0).map((x) => l.value[x]).sort((x, y) => x - y)
    if (blank >= Math.min(cap, Math.ceil(numbers.length * 0.3)) || attempt >= 200) {
      return { difficulty, rows: l.rows, cols: l.cols, kind: l.kind, symbol: l.symbol, solution: l.value, start, equations: l.equations, tray }
    }
  }
}

/** Equations that are fully filled but untrue, and every number square in them. */
export function brokenCrossmath(equations: readonly Equation[], vals: readonly number[]): { equations: number[]; cells: Set<number> } {
  const broken: number[] = []
  const cells = new Set<number>()
  equations.forEach((e, q) => {
    if (vals[e.a] > 0 && vals[e.b] > 0 && vals[e.c] > 0 && !holds(e.sign, vals[e.a], vals[e.b], vals[e.c])) {
      broken.push(q)
      cells.add(e.a); cells.add(e.b); cells.add(e.c)
    }
  })
  return { equations: broken, cells }
}

/** True when every blank is filled and every equation holds. */
export const isCrossmathSolved = (p: Pick<CrossmathPuzzle, 'equations' | 'kind'>, vals: readonly number[]): boolean =>
  p.kind.every((k, i) => k !== 'num' || vals[i] > 0) && brokenCrossmath(p.equations, vals).equations.length === 0

export type CrossmathHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: CrossmathMove }
  | { kind: 'reveal'; index: number; value: number }

/** The next hint: wrong numbers first, then the next forced move, then (rarely) the answer for one blank. */
export function nextCrossmathHint(p: CrossmathPuzzle, vals: readonly number[]): CrossmathHint | null {
  const blanks = blanksOf(p)
  const wrong = blanks.filter((i) => vals[i] > 0 && vals[i] !== p.solution[i])
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const move = findCrossmathMove(p.equations, vals, blanks, p.tray, ['one', 'fit', 'tray'])
  if (move) return { kind: 'move', move }
  const next = blanks.find((i) => vals[i] === 0)
  return next === undefined ? null : { kind: 'reveal', index: next, value: p.solution[next] }
}

/** An equation written out, with a ? for a blank: `12 + ? = 20`. */
export const equationText = (e: Equation, vals: readonly number[]): string => {
  const n = (i: number) => (vals[i] > 0 ? String(vals[i]) : '?')
  return `${n(e.a)} ${e.sign} ${n(e.b)} = ${n(e.c)}`
}
