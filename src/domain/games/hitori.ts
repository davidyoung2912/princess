import { latinSquare } from './futoshiki'
import { shuffle, type Difficulty } from './sudoku'

/**
 * Hitori: an n by n grid of digits. Shade some squares so that no digit repeats among the squares left unshaded in any row or column, no two shaded
 * squares touch along a side, and all unshaded squares stay joined as one group. Every shaded square must be one that repeats a digit that stays
 * (the usual convention, and what makes the answer unique). Marks: 0 blank, 1 shaded, 2 circled (known to stay). Framework-free so it can be tested in node.
 */
export type HitoriGrid = readonly number[]
export const BLANK = 0
export const SHADED = 1
export const CIRCLED = 2

/** Board size, the share of squares shaded, and whether the "shading here would split the group" rule may be needed. */
export const HITORI_LEVELS: Record<Difficulty, { size: number; share: number; split: boolean }> = {
  easy: { size: 5, share: 0.2, split: false },
  medium: { size: 6, share: 0.22, split: true },
  hard: { size: 8, share: 0.24, split: true },
  expert: { size: 10, share: 0.24, split: true },
}

const rowOf = (i: number, n: number) => Math.floor(i / n)
const colOf = (i: number, n: number) => i % n

/** The squares sharing a side with square i. */
export function neighboursOf(i: number, n: number): number[] {
  const r = rowOf(i, n)
  const c = colOf(i, n)
  const out: number[] = []
  if (r > 0) out.push(i - n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  if (r < n - 1) out.push(i + n)
  return out
}

/** The squares in the same row or column as square i (not i itself) that show the same digit. */
export function twinsOf(values: HitoriGrid, i: number, n: number): number[] {
  const r = rowOf(i, n)
  const c = colOf(i, n)
  const out: number[] = []
  for (let k = 0; k < n; k++) {
    const a = r * n + k
    const b = k * n + c
    if (a !== i && values[a] === values[i]) out.push(a)
    if (b !== i && values[b] === values[i]) out.push(b)
  }
  return out
}

/** Whether every square that is not excluded is joined into one group (squares joined by a shared side). */
function joined(n: number, excluded: (i: number) => boolean): boolean {
  const open = Array.from({ length: n * n }, (_, i) => i).filter((i) => !excluded(i))
  if (open.length === 0) return true
  const seen = new Set<number>([open[0]])
  const stack = [open[0]]
  while (stack.length) for (const j of neighboursOf(stack.pop()!, n)) if (!excluded(j) && !seen.has(j)) { seen.add(j); stack.push(j) }
  return seen.size === open.length
}

/** True when the marks are a finished, legal Hitori answer: no repeats among unshaded squares, no touching shaded squares, one joined group. */
export function isValidHitori(values: HitoriGrid, marks: HitoriGrid, n: number): boolean {
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === SHADED) { if (neighboursOf(i, n).some((j) => marks[j] === SHADED)) return false }
    else if (twinsOf(values, i, n).some((j) => marks[j] !== SHADED)) return false
  }
  return joined(n, (i) => marks[i] === SHADED)
}

/** Why a square is shaded or kept: it stays when a shaded neighbour needs it, or a kept twin demands the shading, and so on. */
export type HitoriTechnique = 'alone' | 'neighbour' | 'match' | 'pair' | 'sandwich' | 'split'

export interface Move { index: number; mark: number; technique: HitoriTechnique; cells: number[] }

/** Cells grouped by where they are for the line rules: every row then every column. */
const lineCells = (n: number): number[][] => [
  ...Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c)),
  ...Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c)),
]

/** The next square that plain logic settles, or null when logic is stuck. `split` allows the connectivity rule. */
export function findMove(values: HitoriGrid, marks: HitoriGrid, n: number, split = true): Move | null {
  const lines = lineCells(n)
  const total = n * n
  const unknown = (i: number) => marks[i] === BLANK

  // A square next to a shaded one has to stay.
  for (let i = 0; i < total; i++) {
    if (!unknown(i)) continue
    const black = neighboursOf(i, n).find((j) => marks[j] === SHADED)
    if (black !== undefined) return { index: i, mark: CIRCLED, technique: 'neighbour', cells: [black] }
  }
  // A twin of a kept square has to be shaded.
  for (let i = 0; i < total; i++) {
    if (!unknown(i)) continue
    const kept = twinsOf(values, i, n).find((j) => marks[j] === CIRCLED)
    if (kept !== undefined) return { index: i, mark: SHADED, technique: 'match', cells: [kept] }
  }
  // Two equal digits side by side: one of them is shaded, the other stays, so every other copy in the line is shaded.
  for (const line of lines) {
    for (let k = 0; k + 1 < n; k++) {
      const a = line[k]
      const b = line[k + 1]
      if (values[a] !== values[b] || marks[a] === SHADED || marks[b] === SHADED) continue
      for (const x of line) if (x !== a && x !== b && values[x] === values[a] && unknown(x)) return { index: x, mark: SHADED, technique: 'pair', cells: [a, b] }
    }
  }
  // A digit with the same digit on both sides: the one between them stays (shading it would force a shaded square beside it).
  for (const line of lines) {
    for (let k = 0; k + 2 < n; k++) {
      const [a, b, c] = [line[k], line[k + 1], line[k + 2]]
      if (values[a] === values[c] && values[b] !== values[a] && unknown(b)) return { index: b, mark: CIRCLED, technique: 'sandwich', cells: [a, c] }
    }
  }
  // A square with no twin left in play has no reason to be shaded.
  for (let i = 0; i < total; i++) {
    if (unknown(i) && twinsOf(values, i, n).every((j) => marks[j] === SHADED)) return { index: i, mark: CIRCLED, technique: 'alone', cells: [] }
  }
  // Shading this square would cut the kept squares into two groups.
  if (split) {
    const kept = Array.from({ length: total }, (_, i) => i).filter((i) => marks[i] === CIRCLED)
    if (kept.length >= 2) {
      for (let x = 0; x < total; x++) {
        if (!unknown(x)) continue
        const seen = new Set<number>([kept[0]])
        const stack = [kept[0]]
        while (stack.length) for (const j of neighboursOf(stack.pop()!, n)) if (j !== x && marks[j] !== SHADED && !seen.has(j)) { seen.add(j); stack.push(j) }
        const cut = kept.filter((j) => !seen.has(j))
        if (cut.length) return { index: x, mark: CIRCLED, technique: 'split', cells: [kept[0], cut[0]] }
      }
    }
  }
  return null
}

/** Settles squares with plain logic only. The result still has blanks if logic gets stuck. */
export function logicSolveHitori(values: HitoriGrid, start: HitoriGrid, n: number, split = true): number[] {
  const marks = [...start]
  for (let m = findMove(values, marks, n, split); m; m = findMove(values, marks, n, split)) marks[m.index] = m.mark
  return marks
}

export interface HitoriPuzzle { size: number; difficulty: Difficulty; values: number[]; solution: number[] }

/** A random shading: no two touching, the rest joined. Goes square by square in random order until it has about `target` shaded. */
function randomShading(n: number, target: number, random: () => number): number[] {
  const marks = Array(n * n).fill(CIRCLED)
  let count = 0
  for (const i of shuffle(Array.from({ length: n * n }, (_, k) => k), random)) {
    if (count >= target) break
    if (neighboursOf(i, n).some((j) => marks[j] === SHADED)) continue
    marks[i] = SHADED
    if (joined(n, (j) => marks[j] === SHADED)) count++
    else marks[i] = CIRCLED
  }
  return marks
}

/**
 * A new puzzle: a Latin square, a legal shading, then each shaded square takes a copy of a digit that stays in its row or column. It is kept only when
 * plain logic finishes the whole grid to that shading, so the answer is unique and needs no guessing.
 */
export function generateHitori(difficulty: Difficulty, random: () => number = Math.random): HitoriPuzzle {
  const { size: n, share, split } = HITORI_LEVELS[difficulty]
  const target = Math.round(n * n * share)
  for (;;) {
    const base = latinSquare(n, random)
    const solution = randomShading(n, target, random)
    for (let attempt = 0; attempt < 12; attempt++) {
      const values = [...base]
      for (let i = 0; i < n * n; i++) {
        if (solution[i] !== SHADED) continue
        const pool: number[] = []
        for (let k = 0; k < n; k++) {
          const a = rowOf(i, n) * n + k
          const b = k * n + colOf(i, n)
          if (a !== i && solution[a] !== SHADED) pool.push(base[a])
          if (b !== i && solution[b] !== SHADED) pool.push(base[b])
        }
        values[i] = pool[Math.floor(random() * pool.length)]
      }
      const done = logicSolveHitori(values, Array(n * n).fill(BLANK), n, split)
      if (done.every((m, i) => m === solution[i])) return { size: n, difficulty, values, solution }
    }
  }
}

/** Squares that break a rule right now: two touching shaded squares, a repeat among circled squares, or a shaded square that cuts the unshaded squares apart. */
export function hitoriConflicts(values: HitoriGrid, marks: HitoriGrid, n: number): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === SHADED && neighboursOf(i, n).some((j) => marks[j] === SHADED)) bad.add(i)
    if (marks[i] === CIRCLED) for (const j of twinsOf(values, i, n)) if (marks[j] === CIRCLED) { bad.add(i); bad.add(j) }
  }
  // The unshaded squares should be one group; flag every square outside the biggest group.
  const groups: number[][] = []
  const seen = new Set<number>()
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === SHADED || seen.has(i)) continue
    const group = [i]
    seen.add(i)
    for (let k = 0; k < group.length; k++) for (const j of neighboursOf(group[k], n)) if (marks[j] !== SHADED && !seen.has(j)) { seen.add(j); group.push(j) }
    groups.push(group)
  }
  if (groups.length > 1) {
    groups.sort((a, b) => b.length - a.length)
    for (const g of groups.slice(1)) for (const i of g) bad.add(i)
  }
  return bad
}

export type HitoriHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: Move }
  | { kind: 'reveal'; index: number; mark: number }

/** The next helpful step: wrong marks first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextHitoriHint(values: HitoriGrid, marks: HitoriGrid, solution: HitoriGrid, n: number): HitoriHint | null {
  const wrong = marks.flatMap((m, i) => (m !== BLANK && (m === SHADED) !== (solution[i] === SHADED) ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const index = marks.indexOf(BLANK)
  if (index < 0) return null
  const move = findMove(values, marks, n, true)
  return move ? { kind: 'move', move } : { kind: 'reveal', index, mark: solution[index] }
}

/** Solved when the shading is a legal answer (circles are optional). */
export const isHitoriSolved = (values: HitoriGrid, marks: HitoriGrid, n: number): boolean => isValidHitori(values, marks, n)
