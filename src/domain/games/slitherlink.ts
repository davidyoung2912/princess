import { shuffle, type Difficulty } from './sudoku'

/**
 * Slitherlink: an n by n grid of squares with a dot at every corner. Draw one single closed loop along the lines between dots so that each number
 * says how many of its four sides the loop uses. Edges are marked 0 blank, 1 line, 2 cross (known to be no line). Framework-free so it can be tested in node.
 *
 * Edge numbering: the (n+1)*n horizontal edges come first (row r of dots, column c), then the n*(n+1) vertical edges (row r of squares, column c of dots).
 */
export type SlitherGrid = readonly number[]
export const BLANK = 0
export const LINE = 1
export const CROSS = 2
/** A square with no number. */
export const NONE = -1

/** Board size, and the share of numbers the generator may take away (the more it removes, the more logic a puzzle needs). */
export const SLITHER_LEVELS: Record<Difficulty, { size: number; remove: number }> = {
  easy: { size: 5, remove: 0.3 },
  medium: { size: 7, remove: 0.6 },
  hard: { size: 8, remove: 1 },
  expert: { size: 10, remove: 1 },
}

export interface Topology {
  n: number
  /** The two dots at the ends of each edge. */
  edgeDots: [number, number][]
  /** The edges that meet at each dot. */
  dotEdges: number[][]
  /** The four sides of each square: top, bottom, left, right. */
  sqEdges: number[][]
  /** Where each edge sits, in half squares from the top left corner (x across, y down). */
  centre: { x: number; y: number }[]
}

const cache = new Map<number, Topology>()

export const dotIndex = (r: number, c: number, n: number) => r * (n + 1) + c

/** The edge, dot and square layout for an n by n board, built once per size. */
export function topology(n: number): Topology {
  const hit = cache.get(n)
  if (hit) return hit
  const h = (r: number, c: number) => r * n + c
  const v = (r: number, c: number) => (n + 1) * n + r * (n + 1) + c
  const edgeDots: [number, number][] = []
  const centre: { x: number; y: number }[] = []
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) { edgeDots[h(r, c)] = [dotIndex(r, c, n), dotIndex(r, c + 1, n)]; centre[h(r, c)] = { x: 2 * c + 1, y: 2 * r } }
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) { edgeDots[v(r, c)] = [dotIndex(r, c, n), dotIndex(r + 1, c, n)]; centre[v(r, c)] = { x: 2 * c, y: 2 * r + 1 } }
  const dotEdges: number[][] = Array.from({ length: (n + 1) * (n + 1) }, () => [])
  edgeDots.forEach(([a, b], e) => { dotEdges[a].push(e); dotEdges[b].push(e) })
  const sqEdges: number[][] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) sqEdges[r * n + c] = [h(r, c), h(r + 1, c), v(r, c), v(r, c + 1)]
  const topo = { n, edgeDots, dotEdges, sqEdges, centre }
  cache.set(n, topo)
  return topo
}

export const edgeCount = (n: number) => 2 * n * (n + 1)

/** Lines and open (blank) edges in a list of edges. */
const tally = (marks: SlitherGrid, edges: readonly number[]) => {
  let lines = 0
  let open = 0
  for (const e of edges) { if (marks[e] === LINE) lines++; else if (marks[e] === BLANK) open++ }
  return { lines, open }
}

/** The loop's own end-to-end path starting at a dot that has exactly one line: its far end and the edges along the way. */
function pathFrom(start: number, marks: SlitherGrid, topo: Topology): { end: number; edges: Set<number> } {
  const edges = new Set<number>()
  let dot = start
  for (;;) {
    const next = topo.dotEdges[dot].find((e) => marks[e] === LINE && !edges.has(e))
    if (next === undefined) return { end: dot, edges }
    edges.add(next)
    const [a, b] = topo.edgeDots[next]
    dot = a === dot ? b : a
  }
}

/** True when the lines make exactly one closed loop (every dot touched has two lines, all joined). */
export function isOneLoop(marks: SlitherGrid, n: number): boolean {
  const topo = topology(n)
  let total = 0
  for (let e = 0; e < marks.length; e++) if (marks[e] === LINE) total++
  if (total === 0) return false
  let first = -1
  for (let d = 0; d < topo.dotEdges.length; d++) {
    const lines = tally(marks, topo.dotEdges[d]).lines
    if (lines !== 0 && lines !== 2) return false
    if (lines === 2 && first < 0) first = d
  }
  let walked = 0
  let dot = first
  let came = -1
  for (;;) {
    const next = topo.dotEdges[dot].find((e) => marks[e] === LINE && e !== came)
    if (next === undefined) return false
    walked++
    came = next
    const [a, b] = topo.edgeDots[next]
    dot = a === dot ? b : a
    if (dot === first) break
  }
  return walked === total
}

/** Every number is met exactly by the lines around its square. */
const cluesMet = (clues: SlitherGrid, marks: SlitherGrid, topo: Topology) => clues.every((k, s) => k === NONE || tally(marks, topo.sqEdges[s]).lines === k)

/** Solved when the lines make one closed loop and every number is met (crosses are optional). */
export const isSlitherSolved = (clues: SlitherGrid, marks: SlitherGrid, n: number): boolean => isOneLoop(marks, n) && cluesMet(clues, marks, topology(n))

/** Why an edge is a line or a cross. */
export type SlitherTechnique = 'full' | 'need' | 'dotFull' | 'dotContinue' | 'dotDead' | 'closing' | 'threes' | 'corner' | 'finish'

/** `at` is the square (for number rules) or the dot (for dot rules) the reasoning is about; -1 when there is none. */
export interface Move { edge: number; mark: number; technique: SlitherTechnique; at: number }

/** The next edge that plain logic settles, or null when logic is stuck. Every rule holds in every legal answer, so the moves never guess. */
export function findMove(clues: SlitherGrid, marks: SlitherGrid, n: number): Move | null {
  const topo = topology(n)
  const blankIn = (edges: readonly number[]) => edges.find((e) => marks[e] === BLANK)

  // A number with all its lines drawn crosses the rest; one that needs every open side draws them all.
  for (let s = 0; s < n * n; s++) {
    const k = clues[s]
    if (k === NONE) continue
    const { lines, open } = tally(marks, topo.sqEdges[s])
    if (open === 0) continue
    if (lines === k) return { edge: blankIn(topo.sqEdges[s])!, mark: CROSS, technique: 'full', at: s }
    if (lines + open === k) return { edge: blankIn(topo.sqEdges[s])!, mark: LINE, technique: 'need', at: s }
  }
  // Dots: a loop passes through a dot by two lines or none.
  for (let d = 0; d < topo.dotEdges.length; d++) {
    const { lines, open } = tally(marks, topo.dotEdges[d])
    if (open === 0) continue
    if (lines === 2) return { edge: blankIn(topo.dotEdges[d])!, mark: CROSS, technique: 'dotFull', at: d }
    if (lines === 1 && open === 1) return { edge: blankIn(topo.dotEdges[d])!, mark: LINE, technique: 'dotContinue', at: d }
    if (lines === 0 && open === 1) return { edge: blankIn(topo.dotEdges[d])!, mark: CROSS, technique: 'dotDead', at: d }
  }
  // Two threes side by side: the edge between them and the two edges on the far sides are lines. A three or a one in a corner works the same way.
  for (let s = 0; s < n * n; s++) {
    const k = clues[s]
    if (k === NONE) continue
    const r = Math.floor(s / n)
    const c = s % n
    const [top, bottom, left, right] = topo.sqEdges[s]
    if (k === 3 && c + 1 < n && clues[s + 1] === 3) {
      const e = [left, right, topo.sqEdges[s + 1][3]].find((x) => marks[x] === BLANK)
      if (e !== undefined) return { edge: e, mark: LINE, technique: 'threes', at: s }
    }
    if (k === 3 && r + 1 < n && clues[s + n] === 3) {
      const e = [top, bottom, topo.sqEdges[s + n][1]].find((x) => marks[x] === BLANK)
      if (e !== undefined) return { edge: e, mark: LINE, technique: 'threes', at: s }
    }
    if ((k === 1 || k === 3) && (r === 0 || r === n - 1) && (c === 0 || c === n - 1)) {
      const border = [r === 0 ? top : bottom, c === 0 ? left : right]
      const e = border.find((x) => marks[x] === BLANK)
      if (e !== undefined) return { edge: e, mark: k === 3 ? LINE : CROSS, technique: 'corner', at: s }
    }
  }
  // A line would close a loop while other lines are still outside it: not allowed.
  let total = 0
  for (let e = 0; e < marks.length; e++) if (marks[e] === LINE) total++
  for (let e = 0; e < marks.length; e++) {
    if (marks[e] !== BLANK) continue
    const [a, b] = topo.edgeDots[e]
    if (tally(marks, topo.dotEdges[a]).lines !== 1 || tally(marks, topo.dotEdges[b]).lines !== 1) continue
    const path = pathFrom(a, marks, topo)
    if (path.end === b && path.edges.size < total) return { edge: e, mark: CROSS, technique: 'closing', at: a }
  }
  // The loop is finished: everything else is empty.
  if (isOneLoop(marks, n) && cluesMet(clues, marks, topo)) {
    const e = marks.indexOf(BLANK)
    if (e >= 0) return { edge: e, mark: CROSS, technique: 'finish', at: -1 }
  }
  return null
}

/** Settles edges with plain logic only. The result still has blanks if logic gets stuck. */
export function logicSolveSlither(clues: SlitherGrid, start: SlitherGrid, n: number): number[] {
  const marks = [...start]
  for (let m = findMove(clues, marks, n); m; m = findMove(clues, marks, n)) marks[m.edge] = m.mark
  return marks
}

/** Whether a square is inside the loop, given a region of squares; anything off the board counts as outside. */
const insideAt = (inside: readonly boolean[], n: number, r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && inside[r * n + c]

/** A region makes a single loop when its outside is one piece (no holes) and no dot has the region only on a diagonal (a pinch). Inside stays joined by construction. */
function validRegion(inside: readonly boolean[], n: number): boolean {
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const a = insideAt(inside, n, r - 1, c - 1)
      const b = insideAt(inside, n, r - 1, c)
      const d = insideAt(inside, n, r, c - 1)
      const e = insideAt(inside, n, r, c)
      if ((a && e && !b && !d) || (b && d && !a && !e)) return false
    }
  }
  const side = n + 2
  const seen = Array<boolean>(side * side).fill(false)
  const stack = [0]
  seen[0] = true
  let reached = 1
  while (stack.length) {
    const p = stack.pop()!
    const pr = Math.floor(p / side)
    const pc = p % side
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const qr = pr + dr
      const qc = pc + dc
      if (qr < 0 || qc < 0 || qr >= side || qc >= side || seen[qr * side + qc] || insideAt(inside, n, qr - 1, qc - 1)) continue
      seen[qr * side + qc] = true
      reached++
      stack.push(qr * side + qc)
    }
  }
  const outside = side * side - inside.filter(Boolean).length
  return reached === outside
}

/** A random loop: grow a joined region of squares with no holes and no pinch points, and take its boundary. Returns the edge marks (line or cross). */
function randomLoop(n: number, random: () => number): number[] {
  const inside = Array<boolean>(n * n).fill(false)
  const target = Math.round(n * n * (0.5 + random() * 0.15))
  inside[Math.floor(random() * n * n)] = true
  let count = 1
  for (let tries = 0; count < target && tries < n * n * 30; tries++) {
    const s = Math.floor(random() * n * n)
    if (inside[s]) continue
    const r = Math.floor(s / n)
    const c = s % n
    if (!(insideAt(inside, n, r - 1, c) || insideAt(inside, n, r + 1, c) || insideAt(inside, n, r, c - 1) || insideAt(inside, n, r, c + 1))) continue
    inside[s] = true
    if (validRegion(inside, n)) count++
    else inside[s] = false
  }
  const marks = Array<number>(edgeCount(n)).fill(CROSS)
  // An edge is a line when the squares either side of it differ.
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) if (insideAt(inside, n, r - 1, c) !== insideAt(inside, n, r, c)) marks[r * n + c] = LINE
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) if (insideAt(inside, n, r, c - 1) !== insideAt(inside, n, r, c)) marks[(n + 1) * n + r * (n + 1) + c] = LINE
  return marks
}

export interface SlitherPuzzle { size: number; difficulty: Difficulty; clues: number[]; solution: number[] }

/**
 * A new puzzle: a random loop, a number in every square, then numbers taken away one at a time while plain logic still finds the whole loop. It is kept
 * only when logic finishes to that loop, so the answer is unique and needs no guessing.
 */
export function generateSlitherlink(difficulty: Difficulty, random: () => number = Math.random): SlitherPuzzle {
  const { size: n, remove } = SLITHER_LEVELS[difficulty]
  const topo = topology(n)
  const blank = Array<number>(edgeCount(n)).fill(BLANK)
  const same = (a: readonly number[], b: readonly number[]) => a.every((m, i) => m === b[i])
  for (;;) {
    const solution = randomLoop(n, random)
    const full = Array.from({ length: n * n }, (_, s) => tally(solution, topo.sqEdges[s]).lines)
    if (!same(logicSolveSlither(full, blank, n), solution)) continue
    const clues = [...full]
    const budget = Math.floor(n * n * remove)
    let removed = 0
    for (const s of shuffle(Array.from({ length: n * n }, (_, k) => k), random)) {
      if (removed >= budget) break
      const keep = clues[s]
      clues[s] = NONE
      if (same(logicSolveSlither(clues, blank, n), solution)) removed++
      else clues[s] = keep
    }
    return { size: n, difficulty, clues, solution }
  }
}

export interface SlitherConflicts { edges: Set<number>; dots: Set<number>; squares: Set<number> }

/** What breaks a rule right now: a dot with three lines or a dead end, a number with too many or too few sides left, a closed loop that is too small. */
export function slitherConflicts(clues: SlitherGrid, marks: SlitherGrid, n: number): SlitherConflicts {
  const topo = topology(n)
  const out: SlitherConflicts = { edges: new Set(), dots: new Set(), squares: new Set() }
  let total = 0
  for (let e = 0; e < marks.length; e++) if (marks[e] === LINE) total++
  topo.dotEdges.forEach((edges, d) => {
    const { lines, open } = tally(marks, edges)
    if (lines >= 3 || (lines === 1 && open === 0)) out.dots.add(d)
  })
  for (let s = 0; s < n * n; s++) {
    const k = clues[s]
    if (k === NONE) continue
    const { lines, open } = tally(marks, topo.sqEdges[s])
    if (lines > k || lines + open < k) out.squares.add(s)
  }
  // A closed loop is only right when it is the whole answer.
  const seen = new Set<number>()
  for (let e = 0; e < marks.length; e++) {
    if (marks[e] !== LINE || seen.has(e)) continue
    const part = new Set<number>([e])
    const queue = [e]
    let closed = true
    for (let k = 0; k < queue.length; k++) {
      for (const d of topo.edgeDots[queue[k]]) {
        const lines = topo.dotEdges[d].filter((x) => marks[x] === LINE)
        if (lines.length !== 2) closed = false
        for (const x of lines) if (!part.has(x)) { part.add(x); queue.push(x) }
      }
    }
    part.forEach((x) => seen.add(x))
    if (closed && (part.size < total || !cluesMet(clues, marks, topo))) part.forEach((x) => out.edges.add(x))
  }
  return out
}

/**
 * Moves the cursor from one edge to the next in a direction. Along the edge's own direction it goes to the next edge in the same line; across it, it
 * steps to the edge that meets it at the nearest dot (the upper or left one first), so every edge can be reached with the arrow keys.
 */
export function moveEdge(edge: number, dir: 'left' | 'right' | 'up' | 'down', n: number): number {
  const { centre } = topology(n)
  const here = centre[edge]
  const horizontalEdge = here.y % 2 === 0
  const horizontalMove = dir === 'left' || dir === 'right'
  const along = (p: { x: number; y: number }) => {
    const d = horizontalMove ? p.x - here.x : p.y - here.y
    return dir === 'right' || dir === 'down' ? d : -d
  }
  const across = (p: { x: number; y: number }) => Math.abs(horizontalMove ? p.y - here.y : p.x - here.x)
  const sameLine = horizontalEdge === horizontalMove
  let best = edge
  let bestScore = Infinity
  centre.forEach((p, e) => {
    const a = along(p)
    if (a <= 0 || (sameLine ? across(p) !== 0 : a !== 1 || across(p) !== 1)) return
    const score = a * 100000 + e
    if (score < bestScore) { bestScore = score; best = e }
  })
  return best
}

export type SlitherHint =
  | { kind: 'mistake'; edges: number[] }
  | { kind: 'move'; move: Move }
  | { kind: 'reveal'; edge: number; mark: number }

/** The next helpful step: wrong marks first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextSlitherHint(clues: SlitherGrid, marks: SlitherGrid, solution: SlitherGrid, n: number): SlitherHint | null {
  const wrong = marks.flatMap((m, e) => (m !== BLANK && m !== solution[e] ? [e] : []))
  if (wrong.length) return { kind: 'mistake', edges: wrong }
  const edge = marks.indexOf(BLANK)
  if (edge < 0) return null
  const move = findMove(clues, marks, n)
  return move ? { kind: 'move', move } : { kind: 'reveal', edge, mark: solution[edge] }
}
