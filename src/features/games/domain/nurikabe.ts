import { shuffle, type Difficulty } from './sudoku'

/**
 * Nurikabe: a grid with some numbered squares. Shade squares (the wall) so every numbered square sits in a white island of exactly that many squares,
 * every island holds one number, the wall is one joined piece, and the wall has no 2 by 2 block. Marks: 0 blank, 1 wall, 2 dot (known white).
 * Framework-free so it can be tested in node.
 */
export const BLANK = 0
export const WALL = 1
export const DOT = 2

export const NURIKABE_LEVELS: Record<Difficulty, { rows: number; cols: number; split: boolean }> = {
  easy: { rows: 5, cols: 5, split: false },
  medium: { rows: 7, cols: 7, split: true },
  hard: { rows: 9, cols: 9, split: true },
  expert: { rows: 10, cols: 10, split: true },
}

export interface NurikabePuzzle {
  rows: number
  cols: number
  difficulty: Difficulty
  /** The island size shown in a square, or 0 for no number. */
  clues: number[]
  /** 1 for a wall square, 0 for a white one. */
  solution: number[]
}

/** The squares sharing a side with square i. */
export function neighboursOf(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols)
  const c = i % cols
  const out: number[] = []
  if (r > 0) out.push(i - cols)
  if (c > 0) out.push(i - 1)
  if (c < cols - 1) out.push(i + 1)
  if (r < rows - 1) out.push(i + cols)
  return out
}

/** The top-left squares of every 2 by 2 block. */
function blocks(rows: number, cols: number): number[][] {
  const out: number[][] = []
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) { const i = r * cols + c; out.push([i, i + 1, i + cols, i + cols + 1]) }
  return out
}

/** Groups of squares joined by a side, among the squares where `inside` is true. */
function components(rows: number, cols: number, inside: (i: number) => boolean): number[][] {
  const seen = new Set<number>()
  const out: number[][] = []
  for (let i = 0; i < rows * cols; i++) {
    if (!inside(i) || seen.has(i)) continue
    const group = [i]
    seen.add(i)
    for (let k = 0; k < group.length; k++) for (const j of neighboursOf(group[k], rows, cols)) if (inside(j) && !seen.has(j)) { seen.add(j); group.push(j) }
    out.push(group)
  }
  return out
}

/** True when `wall` (1 for wall) is a complete legal answer for the clues. */
export function isValidNurikabe(clues: readonly number[], wall: readonly number[], rows: number, cols: number): boolean {
  if (blocks(rows, cols).some((b) => b.every((i) => wall[i] === 1))) return false
  if (components(rows, cols, (i) => wall[i] === 1).length > 1) return false
  for (const g of components(rows, cols, (i) => wall[i] !== 1)) {
    const numbered = g.filter((i) => clues[i] > 0)
    if (numbered.length !== 1 || clues[numbered[0]] !== g.length) return false
  }
  return true
}

/** The wall as the player has marked it: wall squares only (blank and dotted squares are white). */
export const wallOf = (marks: readonly number[]): number[] => marks.map((m) => (m === WALL ? 1 : 0))

export const isNurikabeSolved = (p: NurikabePuzzle, marks: readonly number[]): boolean => isValidNurikabe(p.clues, wallOf(marks), p.rows, p.cols)

export type NurikabeTechnique = 'between' | 'complete' | 'reach' | 'block' | 'single' | 'wall'

export interface Move { index: number; mark: number; technique: NurikabeTechnique; cells: number[] }

/**
 * The next square that plain logic settles, or null when logic is stuck. Every rule holds for any answer, so a puzzle that logic finishes has one answer.
 *  between: touches two different islands, so it is wall.   complete: next to an island that already has its size, so wall.
 *  reach: no island can stretch to it, so wall.   block: the other three squares of a 2 by 2 are wall, so it is white.
 *  single: an island that needs more squares has only one way to grow.   wall: if it were white the wall would be cut in two, so it is wall.
 */
export function findMove(clues: readonly number[], marks: readonly number[], rows: number, cols: number, split = true): Move | null {
  const total = rows * cols
  const unknown = (i: number) => marks[i] === BLANK && clues[i] === 0
  const white = (i: number) => marks[i] === DOT || clues[i] > 0
  const nbrs = (i: number) => neighboursOf(i, rows, cols)

  // Islands: groups of white squares; owned when they hold a number.
  const groups = components(rows, cols, white)
  const groupOf = new Array<number>(total).fill(-1)
  groups.forEach((g, k) => g.forEach((i) => { groupOf[i] = k }))
  const clueOf = groups.map((g) => g.find((i) => clues[i] > 0) ?? -1)
  const sizeOf = groups.map((g) => g.length)
  const needOf = groups.map((_, k) => (clueOf[k] >= 0 ? clues[clueOf[k]] : 0))

  // between: an unknown square touching two islands that each hold a number is wall (a dotted group with no number yet could still join one).
  for (let i = 0; i < total; i++) {
    if (!unknown(i)) continue
    const touching = [...new Set(nbrs(i).filter((j) => white(j)).map((j) => groupOf[j]))].filter((k) => clueOf[k] >= 0)
    if (touching.length >= 2) return { index: i, mark: WALL, technique: 'between', cells: touching.slice(0, 2).map((k) => clueOf[k]) }
  }
  // complete: an island that has its size is walled in.
  for (let k = 0; k < groups.length; k++) {
    if (clueOf[k] < 0 || sizeOf[k] !== needOf[k]) continue
    for (const i of groups[k]) for (const j of nbrs(i)) if (unknown(j)) return { index: j, mark: WALL, technique: 'complete', cells: [clueOf[k]] }
  }
  // block: three wall squares of a 2 by 2 force the fourth to be white.
  for (const b of blocks(rows, cols)) {
    const walls = b.filter((i) => marks[i] === WALL)
    const open = b.filter(unknown)
    if (walls.length === 3 && open.length === 1) return { index: open[0], mark: DOT, technique: 'block', cells: walls }
  }
  // single: an island that needs more squares and has one way to grow must take it.
  for (let k = 0; k < groups.length; k++) {
    if (clueOf[k] < 0 || sizeOf[k] >= needOf[k]) continue
    const out = new Set<number>()
    for (const i of groups[k]) for (const j of nbrs(i)) if (unknown(j)) out.add(j)
    if (out.size === 1) return { index: [...out][0], mark: DOT, technique: 'single', cells: [clueOf[k]] }
  }
  // reach: a square no island can stretch to is wall.
  const reachable = new Array<boolean>(total).fill(false)
  for (let k = 0; k < groups.length; k++) {
    if (clueOf[k] < 0) continue
    const room = needOf[k] - sizeOf[k]
    for (const i of groups[k]) reachable[i] = true
    if (room <= 0) continue
    // Squares an island may not use: part of, or touching, another island that holds a number. A dotted group without a number can be joined.
    const other = (x: number) => white(x) && groupOf[x] !== k && clueOf[groupOf[x]] >= 0
    const blockedFor = (j: number) => other(j) || nbrs(j).some(other)
    let frontier = [...groups[k]]
    const dist = new Map<number, number>(frontier.map((i) => [i, 0]))
    for (let d = 1; d <= room; d++) {
      const next: number[] = []
      for (const i of frontier) for (const j of nbrs(i)) {
        if (dist.has(j) || marks[j] === WALL || blockedFor(j)) continue
        dist.set(j, d)
        reachable[j] = true
        next.push(j)
      }
      frontier = next
    }
  }
  for (let i = 0; i < total; i++) if (unknown(i) && !reachable[i]) return { index: i, mark: WALL, technique: 'reach', cells: [] }
  // wall: the wall must stay in one piece.
  if (split) {
    const wallsNow = Array.from({ length: total }, (_, i) => i).filter((i) => marks[i] === WALL)
    if (wallsNow.length >= 1) {
      for (let x = 0; x < total; x++) {
        if (!unknown(x)) continue
        // Treat x as white: the wall squares must still be joinable through wall and blank squares.
        const seen = new Set<number>([wallsNow[0]])
        const stack = [wallsNow[0]]
        while (stack.length) for (const j of nbrs(stack.pop()!)) if (j !== x && marks[j] !== DOT && clues[j] === 0 && !seen.has(j)) { seen.add(j); stack.push(j) }
        const cut = wallsNow.find((j) => !seen.has(j))
        if (cut !== undefined) return { index: x, mark: WALL, technique: 'wall', cells: [wallsNow[0], cut] }
      }
    }
  }
  return null
}

/** Settles squares with plain logic only. The result still has blanks if logic gets stuck. */
export function logicSolveNurikabe(clues: readonly number[], start: readonly number[], rows: number, cols: number, split = true): number[] {
  const marks = [...start]
  for (let m = findMove(clues, marks, rows, cols, split); m; m = findMove(clues, marks, rows, cols, split)) marks[m.index] = m.mark
  return marks
}

/** Grows islands one square at a time (never touching another island, wall kept in one piece) until about `share` of the grid is white, so there are few lone ones. */
function grow(white: boolean[], island: number[], sizes: number[], rows: number, cols: number, maxIsland: number, share: number, random: () => number, wallJoined: (extra: number) => boolean) {
  const total = rows * cols
  let count = white.filter(Boolean).length
  for (let guard = 0; guard < total * 8 && count < total * share; guard++) {
    const i = Math.floor(random() * total)
    if (white[i]) continue
    const touching = [...new Set(neighboursOf(i, rows, cols).filter((j) => white[j]).map((j) => island[j]))]
    if (touching.length !== 1 || sizes[touching[0]] >= maxIsland || !wallJoined(i)) continue
    white[i] = true
    island[i] = touching[0]
    sizes[touching[0]]++
    count++
  }
  return { white, island, sizes }
}

/** A random legal layout: wall only at first, then white squares are added until no 2 by 2 block of wall is left, keeping the wall in one piece. */
function randomLayout(rows: number, cols: number, maxIsland: number, share: number, random: () => number): { white: boolean[]; island: number[]; sizes: number[] } | null {
  const total = rows * cols
  const white = new Array<boolean>(total).fill(false)
  const island = new Array<number>(total).fill(-1)
  const sizes: number[] = []
  const bl = blocks(rows, cols)
  const wallJoined = (extra: number) => {
    const isWall = (i: number) => !white[i] && i !== extra
    const g = components(rows, cols, isWall)
    return g.length <= 1
  }
  for (let guard = 0; guard < total * 6; guard++) {
    const bad = bl.filter((b) => b.every((i) => !white[i]))
    if (bad.length === 0) return grow(white, island, sizes, rows, cols, maxIsland, share, random, wallJoined)
    const block = bad[Math.floor(random() * bad.length)]
    const options: { cell: number; k: number }[] = []
    for (const cell of block) {
      const touching = [...new Set(neighboursOf(cell, rows, cols).filter((j) => white[j]).map((j) => island[j]))]
      if (touching.length === 0) options.push({ cell, k: -1 })
      else if (touching.length === 1 && sizes[touching[0]] < maxIsland) options.push({ cell, k: touching[0] })
    }
    let placed = false
    for (const o of shuffle(options, random)) {
      if (!wallJoined(o.cell)) continue
      white[o.cell] = true
      if (o.k < 0) { island[o.cell] = sizes.length; sizes.push(1) }
      else { island[o.cell] = o.k; sizes[o.k]++ }
      placed = true
      break
    }
    if (!placed) return null
  }
  return null
}

/**
 * A new puzzle: a random legal layout, one number per island at a random square of it, kept only when plain logic finishes the whole grid to that layout,
 * so the answer is unique and needs no guessing.
 */
export function generateNurikabe(difficulty: Difficulty, random: () => number = Math.random): NurikabePuzzle {
  const { rows, cols, split } = NURIKABE_LEVELS[difficulty]
  const total = rows * cols
  const maxIsland = Math.max(4, Math.round(Math.sqrt(total) * 1.3))
  for (;;) {
    const layout = randomLayout(rows, cols, maxIsland, 0.4, random)
    if (!layout) continue
    const solution = layout.white.map((w) => (w ? 0 : 1))
    const members = layout.sizes.map((_, k) => Array.from({ length: total }, (_, i) => i).filter((i) => layout.island[i] === k))
    for (let attempt = 0; attempt < 25; attempt++) {
      const clues = new Array<number>(total).fill(0)
      members.forEach((m) => { clues[m[Math.floor(random() * m.length)]] = m.length })
      const done = logicSolveNurikabe(clues, new Array<number>(total).fill(BLANK), rows, cols, split)
      if (done.every((m, i) => clues[i] > 0 || (m !== BLANK && (m === WALL) === (solution[i] === 1)))) {
        return { rows, cols, difficulty, clues, solution }
      }
    }
  }
}

/** Squares that break a rule right now, judged only on what is certain: blanks may still become wall or white. */
export function nurikabeConflicts(clues: readonly number[], marks: readonly number[], rows: number, cols: number): Set<number> {
  const bad = new Set<number>()
  for (const b of blocks(rows, cols)) if (b.every((i) => marks[i] === WALL)) b.forEach((i) => bad.add(i))
  // Regions of squares that are not wall: judge them by what is known inside them.
  for (const g of components(rows, cols, (i) => marks[i] !== WALL)) {
    const numbered = g.filter((i) => clues[i] > 0)
    const known = g.filter((i) => clues[i] > 0 || marks[i] === DOT)
    if (numbered.length >= 2) numbered.forEach((i) => bad.add(i))
    else if (numbered.length === 1 && (g.length < clues[numbered[0]] || known.length > clues[numbered[0]])) known.forEach((i) => bad.add(i))
    else if (numbered.length === 0) g.filter((i) => marks[i] === DOT).forEach((i) => bad.add(i))
  }
  // Wall that can no longer be joined: separated even if every blank became wall.
  const parts = components(rows, cols, (i) => marks[i] === WALL || marks[i] === BLANK && clues[i] === 0)
  const withWall = parts.filter((p) => p.some((i) => marks[i] === WALL))
  if (withWall.length > 1) {
    withWall.sort((a, b) => b.filter((i) => marks[i] === WALL).length - a.filter((i) => marks[i] === WALL).length)
    for (const p of withWall.slice(1)) p.filter((i) => marks[i] === WALL).forEach((i) => bad.add(i))
  }
  return bad
}

export type NurikabeHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: Move }
  | { kind: 'reveal'; index: number; mark: number }

/** The next helpful step: wrong marks first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextNurikabeHint(p: NurikabePuzzle, marks: readonly number[]): NurikabeHint | null {
  const wrong = marks.flatMap((m, i) => (m !== BLANK && (m === WALL) !== (p.solution[i] === 1) ? [i] : []))
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  // Squares that are certainly white (numbered) never need a mark.
  const open = marks.flatMap((m, i) => (m === BLANK && p.clues[i] === 0 ? [i] : []))
  if (open.length === 0) return null
  const move = findMove(p.clues, marks, p.rows, p.cols, true)
  if (move) return { kind: 'move', move }
  const index = open[0]
  return { kind: 'reveal', index, mark: p.solution[index] === 1 ? WALL : DOT }
}
