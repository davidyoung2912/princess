import { isRed, type Card, type Rank, type Suit } from './cards'

/**
 * FreeCell: eight columns all face up, some free cells (four in the classic game) as parking spaces, four foundations built up by suit. Columns build down in alternating colours,
 * and a run moves one card at a time through the free cells and empty columns, so the length that can move together is limited.
 *
 * Deals use the Microsoft numbered deals (1 to 32000), which are all solvable except number 11982; `winnableDeal` skips that one.
 */
export type FreeCellLevel = 'classic' | 'hard' | 'expert'
export const FREECELL_LEVELS: readonly FreeCellLevel[] = ['classic', 'hard', 'expert']
/** Classic has the usual four free cells; fewer cells make a harder game, and not every deal can then be won. */
export const CELLS_OF: Record<FreeCellLevel, number> = { classic: 4, hard: 3, expert: 2 }
export const UNSOLVABLE_DEAL = 11982
export const DEAL_COUNT = 32000

export interface FreeCell {
  columns: Card[][]
  cells: (Card | null)[]
  foundations: Card[][] // indexed by suit
  dealNumber: number
}

/** The Microsoft deal: a linear congruential generator picks cards from the deck, and they are dealt across the columns left to right. */
export function dealCards(dealNumber: number): Card[] {
  let seed = dealNumber >>> 0
  const rand = () => { seed = (Math.imul(seed, 214013) + 2531011) >>> 0 & 0x7fffffff; return seed >>> 16 }
  // Microsoft's deck order: rank by rank, suits clubs, diamonds, hearts, spades.
  const MS_SUIT: Suit[] = [3, 2, 1, 0]
  const deck: Card[] = Array.from({ length: 52 }, (_, i) => ({ id: i, suit: MS_SUIT[i % 4], rank: (Math.floor(i / 4) + 1) as Rank }))
  const out: Card[] = []
  let left = 52
  for (let i = 0; i < 52; i++) {
    const j = rand() % left
    out.push(deck[j])
    deck[j] = deck[--left]
  }
  return out
}

export function deal(level: FreeCellLevel, dealNumber: number): FreeCell {
  const cards = dealCards(dealNumber)
  const columns: Card[][] = Array.from({ length: 8 }, () => [])
  cards.forEach((c, i) => columns[i % 8].push(c))
  return { columns, cells: Array<Card | null>(CELLS_OF[level]).fill(null), foundations: [[], [], [], []], dealNumber }
}

export const randomDeal = (rng: () => number = Math.random): number => {
  let n = 1 + Math.floor(rng() * DEAL_COUNT)
  if (n === UNSOLVABLE_DEAL) n++
  return n
}

export type Src = { kind: 'column'; col: number; index: number } | { kind: 'cell'; cell: number }
export type Dst = { kind: 'column'; col: number } | { kind: 'cell'; cell: number } | { kind: 'foundation' }

export const cardsOf = (g: FreeCell, s: Src): Card[] => {
  if (s.kind === 'cell') { const c = g.cells[s.cell]; return c ? [c] : [] }
  return g.columns[s.col].slice(s.index)
}

const fits = (top: Card, below: Card): boolean => top.rank === below.rank + 1 && isRed(top) !== isRed(below)

/** Is the run from `index` in a column a proper descending, alternating run? */
export const isRun = (cards: readonly Card[]): boolean => cards.every((c, i) => i === 0 || fits(cards[i - 1], c))

/** How many cards can move together to a column: (free cells + 1) times two for each empty column, not counting the one moved to. */
export function maxMovable(g: FreeCell, toEmptyColumn: boolean): number {
  const freeCells = g.cells.filter((c) => c === null).length
  const empties = g.columns.filter((c) => c.length === 0).length - (toEmptyColumn ? 1 : 0)
  return (freeCells + 1) * 2 ** Math.max(0, empties)
}

export const foundationFits = (g: FreeCell, c: Card): boolean => g.foundations[c.suit].length === c.rank - 1

export function canMove(g: FreeCell, s: Src, d: Dst): boolean {
  const run = cardsOf(g, s)
  if (run.length === 0 || !isRun(run)) return false
  if (d.kind === 'foundation') return run.length === 1 && foundationFits(g, run[0])
  if (d.kind === 'cell') return run.length === 1 && g.cells[d.cell] === null && !(s.kind === 'cell' && s.cell === d.cell)
  if (s.kind === 'column' && s.col === d.col) return false
  const dest = g.columns[d.col]
  if (dest.length === 0) return run.length <= maxMovable(g, true)
  return fits(dest[dest.length - 1], run[0]) && run.length <= maxMovable(g, false)
}

export function move(g: FreeCell, s: Src, d: Dst): FreeCell {
  if (!canMove(g, s, d)) return g
  const run = cardsOf(g, s)
  const columns = g.columns.map((c) => c.slice())
  const cells = g.cells.slice()
  const foundations = g.foundations.map((p) => p.slice())
  if (s.kind === 'cell') cells[s.cell] = null
  else columns[s.col].length = s.index
  if (d.kind === 'foundation') foundations[run[0].suit].push(run[0])
  else if (d.kind === 'cell') cells[d.cell] = run[0]
  else columns[d.col].push(...run)
  return { ...g, columns, cells, foundations }
}

export const isWon = (g: FreeCell): boolean => g.foundations.every((p) => p.length === 13)

/** Every card sits in a proper run: whatever is left can be finished by moving cards home. */
export const canAutoFinish = (g: FreeCell): boolean => !isWon(g) && g.columns.every(isRun) && g.cells.every((c) => c === null)

/** The next card that can go to a foundation, lowest rank first, or null. */
export function autoStep(g: FreeCell): { from: Src; to: Dst } | null {
  const picks: { from: Src; rank: number }[] = []
  g.cells.forEach((c, cell) => { if (c && foundationFits(g, c)) picks.push({ from: { kind: 'cell', cell }, rank: c.rank }) })
  g.columns.forEach((col, i) => { const c = col[col.length - 1]; if (c && foundationFits(g, c)) picks.push({ from: { kind: 'column', col: i, index: col.length - 1 }, rank: c.rank }) })
  picks.sort((a, b) => a.rank - b.rank)
  return picks[0] ? { from: picks[0].from, to: { kind: 'foundation' } } : null
}

/** A tapped card's best place: the foundation, then a column it fits on, then an empty column (a single card only), then a free cell. */
export function bestDest(g: FreeCell, s: Src): Dst | null {
  const run = cardsOf(g, s)
  if (run.length === 0) return null
  const f: Dst = { kind: 'foundation' }
  if (canMove(g, s, f)) return f
  let empty: Dst | null = null
  for (let col = 0; col < 8; col++) {
    const d: Dst = { kind: 'column', col }
    if (!canMove(g, s, d)) continue
    if (g.columns[col].length > 0) return d
    empty = empty ?? d
  }
  if (empty) return empty
  if (run.length === 1) { const cell = g.cells.indexOf(null); if (cell >= 0) { const d: Dst = { kind: 'cell', cell }; if (canMove(g, s, d)) return d } }
  return null
}

/* ------------------------------------------------------------------------------------------------ the solver (for hints) */

/** One single-card step the solver uses. */
export interface Step { from: Src; to: Dst }

const keyOf = (g: FreeCell): string => {
  const cols = g.columns.map((c) => c.map((x) => x.suit * 13 + x.rank).join(',')).sort().join('|')
  const cells = g.cells.map((c) => (c ? c.suit * 13 + c.rank : -1)).sort((a, b) => a - b).join(',')
  return `${cols}#${cells}#${g.foundations.map((p) => p.length).join(',')}`
}

/** Moves cards that are safe to send home at once (nothing still in play needs them as a landing spot). */
function safeHome(g: FreeCell, steps: Step[]): FreeCell {
  let cur = g
  for (;;) {
    let moved = false
    const cands: { from: Src; c: Card }[] = []
    cur.cells.forEach((c, cell) => { if (c) cands.push({ from: { kind: 'cell', cell }, c }) })
    cur.columns.forEach((col, i) => { const c = col[col.length - 1]; if (c) cands.push({ from: { kind: 'column', col: i, index: col.length - 1 }, c }) })
    for (const { from, c } of cands) {
      if (!foundationFits(cur, c)) continue
      const other = isRed(c) ? [0, 3] : [1, 2]
      const safe = c.rank <= 2 || other.every((s) => cur.foundations[s].length >= c.rank - 1)
      if (!safe) continue
      steps.push({ from, to: { kind: 'foundation' } })
      cur = move(cur, from, { kind: 'foundation' })
      moved = true
      break
    }
    if (!moved) return cur
  }
}

/**
 * How far a position is from won (lower is closer): cards not yet home, how many cards bury the next card each foundation needs, cards sitting out of order, and cells in use.
 */
const score = (g: FreeCell): number => {
  let home = 0
  for (const p of g.foundations) home += p.length
  let s = (52 - home) * 4
  for (let suit = 0; suit < 4; suit++) {
    const need = g.foundations[suit].length + 1
    if (need > 13) continue
    for (const col of g.columns) {
      const at = col.findIndex((c) => c.suit === suit && c.rank === need)
      if (at >= 0) s += (col.length - 1 - at) * 3
    }
  }
  for (const col of g.columns) {
    for (let i = 1; i < col.length; i++) if (!fits(col[i - 1], col[i])) s += 2 + (col[i].rank > col[i - 1].rank ? 1 : 0)
  }
  s += g.cells.filter((c) => c !== null).length * 3
  s -= g.columns.filter((c) => c.length === 0).length * 2
  return s
}

/** Every single-card move (to a foundation, a column or a free cell) from a position. */
function singleMoves(g: FreeCell): Step[] {
  const out: Step[] = []
  const srcs: Src[] = []
  g.cells.forEach((c, cell) => { if (c) srcs.push({ kind: 'cell', cell }) })
  g.columns.forEach((col, i) => { if (col.length) srcs.push({ kind: 'column', col: i, index: col.length - 1 }) })
  const firstEmpty = g.columns.findIndex((c) => c.length === 0)
  const firstCell = g.cells.indexOf(null)
  for (const from of srcs) {
    for (let col = 0; col < 8; col++) {
      if (g.columns[col].length === 0 && col !== firstEmpty) continue
      const to: Dst = { kind: 'column', col }
      if (canMove(g, from, to)) {
        // Moving the only card of a column to an empty column changes nothing.
        if (g.columns[col].length === 0 && from.kind === 'column' && from.index === 0) continue
        out.push({ from, to })
      }
    }
    if (from.kind === 'column' && firstCell >= 0) out.push({ from, to: { kind: 'cell', cell: firstCell } })
  }
  return out
}

/**
 * A best-first search for a winning line of single-card steps from `start`. Returns the steps, or null if it gave up after `limit` positions (it may still be winnable).
 * Sequences are played one card at a time, so a hint is always one card move.
 */
export function solve(start: FreeCell, limit = 40000): Step[] | null {
  interface Node { g: FreeCell; steps: Step[]; f: number }
  const first: Step[] = []
  const root = safeHome(start, first)
  if (isWon(root)) return first
  const seen = new Set<string>([keyOf(root)])
  // A binary min-heap on f.
  const heap: Node[] = []
  const push = (n: Node) => {
    heap.push(n)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p].f <= heap[i].f) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = (): Node => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length > 0) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < heap.length && heap[l].f < heap[m].f) m = l
        if (r < heap.length && heap[r].f < heap[m].f) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  push({ g: root, steps: first, f: score(root) })
  let expanded = 0
  while (heap.length > 0 && expanded < limit) {
    const node = pop()
    expanded++
    for (const st of singleMoves(node.g)) {
      const steps = node.steps.slice()
      steps.push(st)
      const next = safeHome(move(node.g, st.from, st.to), steps)
      const k = keyOf(next)
      if (seen.has(k)) continue
      seen.add(k)
      if (isWon(next)) return steps
      push({ g: next, steps, f: score(next) + steps.length * 0.5 })
    }
  }
  return null
}

/** The next move to suggest: the first step of a solution if one is found, otherwise a plain sensible move. */
export function hint(g: FreeCell, limit = 40000): { step: Step; solved: boolean } | null {
  const line = solve(g, limit)
  if (line && line.length > 0) return { step: line[0], solved: true }
  const auto = autoStep(g)
  if (auto) return { step: auto, solved: false }
  const moves = singleMoves(g).filter((m) => m.to.kind === 'column')
  return moves[0] ? { step: moves[0], solved: false } : null
}
