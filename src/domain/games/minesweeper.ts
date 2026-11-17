import type { Difficulty } from './sudoku'

/**
 * Minesweeper with no guessing: reveal every safe square without touching a mine. Each number counts the mines in the eight squares around it.
 * The start square (and its neighbours) are safe and already opened, and every board is kept only if plain logic can finish it from there.
 * Framework-free so it can be tested in node.
 */
export const MINE_LEVELS: Record<Difficulty, { rows: number; cols: number; mines: number }> = {
  easy: { rows: 8, cols: 8, mines: 10 },
  medium: { rows: 10, cols: 10, mines: 17 },
  hard: { rows: 12, cols: 14, mines: 32 },
  expert: { rows: 16, cols: 16, mines: 48 },
}

export interface MinePuzzle {
  difficulty: Difficulty
  rows: number
  cols: number
  mines: readonly boolean[]
  /** Neighbouring mine count for every square. */
  values: readonly number[]
  /** The square opened at the start; it is a 0, so a patch around it is open. */
  start: number
}

export const neighboursOf = (i: number, rows: number, cols: number): number[] => {
  const r = Math.floor(i / cols)
  const c = i % cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const rr = r + dr
      const cc = c + dc
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) out.push(rr * cols + cc)
    }
  }
  return out
}

/** The squares opened by revealing `i`: a 0 opens its neighbours too, and so on. Mines are never opened here. */
export function revealFrom(p: Pick<MinePuzzle, 'rows' | 'cols' | 'values' | 'mines'>, revealed: readonly boolean[], i: number): boolean[] {
  const next = [...revealed]
  const stack = [i]
  while (stack.length) {
    const k = stack.pop()!
    if (next[k] || p.mines[k]) continue
    next[k] = true
    if (p.values[k] === 0) for (const nb of neighboursOf(k, p.rows, p.cols)) if (!next[nb]) stack.push(nb)
  }
  return next
}

/** Why a square is certain: a number whose mines are all found or all still hidden, two numbers whose hidden squares overlap, or the total mine count. */
export type MineRule = 'count' | 'subset' | 'total'
export interface MineMove { index: number; kind: 'safe' | 'mine'; rule: MineRule; /** The number the deduction starts from (null for the total). */ source: number | null; /** The second number for the subset rule. */ other: number | null }

const PRIORITY: readonly MineRule[] = ['count', 'subset', 'total']

/**
 * Every square that plain logic can now call safe or a mine, given what is open and which mines are already known.
 * `known` holds 1 for a known mine and 2 for a square already known safe that is not yet opened.
 */
export function deduce(p: Pick<MinePuzzle, 'rows' | 'cols' | 'values' | 'mines'>, revealed: readonly boolean[], known: readonly number[], total: number, firstOnly = false): MineMove[] {
  const { rows, cols, values } = p
  const found = new Map<number, MineMove>()
  const add = (m: MineMove) => {
    const old = found.get(m.index)
    if (!old || PRIORITY.indexOf(m.rule) < PRIORITY.indexOf(old.rule)) found.set(m.index, m)
  }
  // For every open number: its unknown squares and how many mines are still to place among them.
  const info = new Map<number, { unk: number[]; need: number }>()
  for (let i = 0; i < rows * cols; i++) {
    if (!revealed[i]) continue
    const unk: number[] = []
    let need = values[i]
    for (const nb of neighboursOf(i, rows, cols)) {
      if (revealed[nb]) continue
      if (known[nb] === 1) need--
      else if (known[nb] !== 2) unk.push(nb)
    }
    if (unk.length) info.set(i, { unk, need })
  }
  for (const [i, { unk, need }] of info) {
    if (need === 0) for (const u of unk) add({ index: u, kind: 'safe', rule: 'count', source: i, other: null })
    else if (need === unk.length) for (const u of unk) add({ index: u, kind: 'mine', rule: 'count', source: i, other: null })
  }
  if (found.size && firstOnly) return [...found.values()]
  for (const [a, A] of info) {
    const ar = Math.floor(a / cols)
    const ac = a % cols
    for (const [b, B] of info) {
      if (a === b || A.unk.length >= B.unk.length) continue
      if (Math.abs(Math.floor(b / cols) - ar) > 2 || Math.abs((b % cols) - ac) > 2) continue
      const inB = new Set(B.unk)
      if (!A.unk.every((u) => inB.has(u))) continue
      const inA = new Set(A.unk)
      const diff = B.unk.filter((u) => !inA.has(u))
      const need = B.need - A.need
      if (need === 0) for (const u of diff) add({ index: u, kind: 'safe', rule: 'subset', source: b, other: a })
      else if (need === diff.length) for (const u of diff) add({ index: u, kind: 'mine', rule: 'subset', source: b, other: a })
    }
  }
  if (found.size && firstOnly) return [...found.values()]
  const hidden: number[] = []
  let mines = 0
  for (let i = 0; i < rows * cols; i++) {
    if (revealed[i]) continue
    if (known[i] === 1) mines++
    else if (known[i] !== 2) hidden.push(i)
  }
  const left = total - mines
  if (hidden.length && left === 0) for (const u of hidden) add({ index: u, kind: 'safe', rule: 'total', source: null, other: null })
  else if (hidden.length && left === hidden.length) for (const u of hidden) add({ index: u, kind: 'mine', rule: 'total', source: null, other: null })
  return [...found.values()]
}

/** Whether logic alone opens every safe square from the start. */
export function solvableByLogic(p: Pick<MinePuzzle, 'rows' | 'cols' | 'values' | 'mines'> & { start: number }, total: number): boolean {
  const n = p.rows * p.cols
  let revealed = revealFrom(p, Array<boolean>(n).fill(false), p.start)
  const known = Array<number>(n).fill(0)
  for (;;) {
    const moves = deduce(p, revealed, known, total)
    let progress = false
    for (const m of moves) {
      if (m.kind === 'mine') { if (known[m.index] !== 1) { known[m.index] = 1; progress = true } }
      else if (!revealed[m.index]) { revealed = revealFrom(p, revealed, m.index); progress = true }
    }
    if (!progress) break
  }
  return revealed.every((r, i) => r || p.mines[i])
}

/** Makes a board that logic alone clears from the opening square, so no guess is ever needed. */
export function generateMinesweeper(difficulty: Difficulty, random: () => number = Math.random): MinePuzzle {
  const { rows, cols, mines: count } = MINE_LEVELS[difficulty]
  const n = rows * cols
  for (;;) {
    const start = Math.floor(random() * n)
    const safe = new Set([start, ...neighboursOf(start, rows, cols)])
    const pool = Array.from({ length: n }, (_, i) => i).filter((i) => !safe.has(i))
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1))
      ;[pool[k], pool[j]] = [pool[j], pool[k]]
    }
    const mines = Array<boolean>(n).fill(false)
    for (const i of pool.slice(0, count)) mines[i] = true
    const values = mines.map((_, i) => neighboursOf(i, rows, cols).filter((nb) => mines[nb]).length)
    const p = { difficulty, rows, cols, mines, values, start }
    if (solvableByLogic(p, count)) return p
  }
}

/** Opens a hidden number's neighbours when its flags match it (a chord). Returns the squares to open, or null when the flags do not match. */
export function chordTargets(p: Pick<MinePuzzle, 'rows' | 'cols' | 'values'>, revealed: readonly boolean[], flags: readonly boolean[], i: number): number[] | null {
  if (!revealed[i] || p.values[i] === 0) return null
  const nbs = neighboursOf(i, p.rows, p.cols)
  if (nbs.filter((k) => flags[k]).length !== p.values[i]) return null
  const targets = nbs.filter((k) => !revealed[k] && !flags[k])
  return targets.length ? targets : null
}

/** Solved when every safe square is open. */
export const isMinesweeperSolved = (p: Pick<MinePuzzle, 'mines'>, revealed: readonly boolean[]): boolean => p.mines.every((m, i) => m || revealed[i])

/** Flags on squares that are not mines. */
export const wrongFlags = (p: Pick<MinePuzzle, 'mines'>, flags: readonly boolean[]): number[] => flags.flatMap((f, i) => (f && !p.mines[i] ? [i] : []))

/** Open numbers whose flags cannot be right: more flags than the number, or too few squares left to reach it. */
export function badNumbers(p: Pick<MinePuzzle, 'rows' | 'cols' | 'values'>, revealed: readonly boolean[], flags: readonly boolean[]): Set<number> {
  const bad = new Set<number>()
  revealed.forEach((open, i) => {
    if (!open || p.values[i] === 0) return
    const nbs = neighboursOf(i, p.rows, p.cols)
    const flagged = nbs.filter((k) => flags[k]).length
    const hidden = nbs.filter((k) => !revealed[k]).length
    if (flagged > p.values[i] || hidden < p.values[i]) bad.add(i)
  })
  return bad
}

export type MineHint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'move'; move: MineMove }

/** The next hint: wrong flags first, then the first certain square (counting the flags already placed as known mines). */
export function nextMineHint(p: MinePuzzle, revealed: readonly boolean[], flags: readonly boolean[]): MineHint | null {
  const wrong = wrongFlags(p, flags)
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const known = flags.map((f) => (f ? 1 : 0))
  const total = p.mines.filter(Boolean).length
  const moves = deduce(p, revealed, known, total).filter((m) => !revealed[m.index] && !(m.kind === 'mine' && flags[m.index]))
  moves.sort((a, b) => PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule) || a.index - b.index)
  if (moves.length) return { kind: 'move', move: moves[0] }
  const i = revealed.findIndex((r, k) => !r && !p.mines[k])
  return i < 0 ? null : { kind: 'move', move: { index: i, kind: 'safe', rule: 'total', source: null, other: null } }
}
