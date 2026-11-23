import type { Difficulty } from './sudoku'

/**
 * Hashi (bridges): join numbered islands with horizontal or vertical bridges, at most two between a pair and none crossing,
 * so every island has as many bridges as its number and all islands form one connected group.
 * Every puzzle is kept only if plain logic (see `propagate`) finishes it, so the answer is unique and no guessing is needed.
 * Framework-free so it can be tested in node.
 */
export const HASHI_LEVELS: Record<Difficulty, { rows: number; cols: number; islands: number }> = {
  easy: { rows: 7, cols: 7, islands: 10 },
  medium: { rows: 9, cols: 9, islands: 16 },
  hard: { rows: 11, cols: 11, islands: 25 },
  expert: { rows: 15, cols: 15, islands: 42 },
}

export interface Island { r: number; c: number; n: number }
/** A pair of islands facing each other along a row or column with no island between. `a` is the upper or left one. */
export interface Link { a: number; b: number; horizontal: boolean; /** Most bridges this pair can take: two, or less when an island shows a 1. */ cap: number }

export interface HashiPuzzle {
  difficulty: Difficulty
  rows: number
  cols: number
  islands: Island[]
  links: Link[]
  /** For each link, the links it would cross. */
  crosses: number[][]
  /** The answer: bridges (0 to 2) on each link. */
  solution: number[]
}

/** Every pair of islands that can be joined: the nearest island to the right and below, when there is room for a bridge between. */
export function buildLinks(islands: readonly Island[]): Link[] {
  const at = new Map<number, number>()
  const cols = islands.reduce((m, i) => Math.max(m, i.c + 1), 0)
  islands.forEach((isl, k) => at.set(isl.r * cols + isl.c, k))
  const rows = islands.reduce((m, i) => Math.max(m, i.r + 1), 0)
  const links: Link[] = []
  islands.forEach((isl, a) => {
    for (const horizontal of [true, false]) {
      let r = isl.r
      let c = isl.c
      for (;;) {
        if (horizontal) c++
        else r++
        if (r >= rows || c >= cols) break
        const b = at.get(r * cols + c)
        if (b === undefined) continue
        if ((horizontal ? c - isl.c : r - isl.r) >= 2) links.push({ a, b, horizontal, cap: Math.min(2, isl.n, islands[b].n) })
        break
      }
    }
  })
  return links
}

/** For each link, the other links that cross it. */
export function crossingsOf(islands: readonly Island[], links: readonly Link[]): number[][] {
  const out: number[][] = links.map(() => [])
  links.forEach((h, i) => {
    if (!h.horizontal) return
    const ha = islands[h.a]
    const hb = islands[h.b]
    links.forEach((v, j) => {
      if (v.horizontal) return
      const va = islands[v.a]
      const vb = islands[v.b]
      if (va.c > ha.c && va.c < hb.c && ha.r > va.r && ha.r < vb.r) { out[i].push(j); out[j].push(i) }
    })
  })
  return out
}

/** Link indices at each island. */
export function linksAt(islandCount: number, links: readonly Link[]): number[][] {
  const out: number[][] = Array.from({ length: islandCount }, () => [])
  links.forEach((l, i) => { out[l.a].push(i); out[l.b].push(i) })
  return out
}

/** The squares strictly between the two islands of a link, as row,column pairs. */
export function linkCells(islands: readonly Island[], l: Link): { r: number; c: number }[] {
  const a = islands[l.a]
  const b = islands[l.b]
  const out: { r: number; c: number }[] = []
  if (l.horizontal) for (let c = a.c + 1; c < b.c; c++) out.push({ r: a.r, c })
  else for (let r = a.r + 1; r < b.r; r++) out.push({ r, c: a.c })
  return out
}

/* ---------- logic ---------- */

/** Why a bridge count is certain. */
export type HashiRule =
  /** An island's number equals the most its neighbours can take: every bridge it has room for is needed. */
  | 'all'
  /** The island's other directions cannot carry its whole number, so this one must carry the rest. */
  | 'least'
  /** The island already has all it needs (or this link is capped by a 1), so no more here. */
  | 'room'
  /** A bridge here would cross one that is certain. */
  | 'cross'
  /** More bridges here would close off a finished group from the rest. */
  | 'link'
  /** Used only when the solver cannot name a reason for a bridge (never for generated puzzles' own hints in practice). */
  | 'reveal'

/** A deduction: this link now has between `lo` and `hi` bridges. */
export interface HashiMove { link: number; lo: number; hi: number; rule: HashiRule; island: number | null; /** The most the island's other links can carry between them (for the 'least' rule). */ rest: number }

const lowOf = (m: number): number => (m & 1 ? 0 : m & 2 ? 1 : 2)
const highOf = (m: number): number => (m & 4 ? 2 : m & 2 ? 1 : 0)
/** Mask of the counts from `lo` to `hi`. */
const range = (lo: number, hi: number): number => { let m = 0; for (let k = lo; k <= hi; k++) m |= 1 << k; return m }

type Shape = Pick<HashiPuzzle, 'islands' | 'links' | 'crosses'>

/**
 * Narrows what each link can hold until nothing more follows. `dom` holds, for each link, a mask of the allowed counts (bit k means k bridges).
 * Rules: island totals (all, least, room), no crossing, and no finished group closed off from the rest. Every step is a necessary consequence,
 * so the true answer is never removed; when every mask is down to one count, that count is the only answer.
 */
export function propagate(p: Shape, dom: readonly number[], trace?: HashiMove[]): { dom: number[]; contradiction: boolean } {
  const { islands, links, crosses } = p
  const d = [...dom]
  const at = linksAt(islands.length, links)
  let contradiction = false
  const narrow = (l: number, mask: number, rule: HashiRule, island: number | null, rest: number): boolean => {
    const next = d[l] & mask
    if (next === d[l]) return false
    if (next === 0) { contradiction = true; return false }
    d[l] = next
    trace?.push({ link: l, lo: lowOf(next), hi: highOf(next), rule, island, rest })
    return true
  }
  let changed = true
  while (changed && !contradiction) {
    changed = false
    islands.forEach((isl, i) => {
      if (contradiction) return
      let sumHi = 0
      let sumLo = 0
      for (const l of at[i]) { sumHi += highOf(d[l]); sumLo += lowOf(d[l]) }
      if (sumHi < isl.n || sumLo > isl.n) { contradiction = true; return }
      for (const l of at[i]) {
        const rest = sumHi - highOf(d[l])
        const least = isl.n - rest
        if (least > lowOf(d[l]) && narrow(l, range(least, 2), sumHi === isl.n ? 'all' : 'least', i, rest)) changed = true
        const most = isl.n - (sumLo - lowOf(d[l]))
        if (most < highOf(d[l]) && narrow(l, range(0, Math.max(0, most)), 'room', i, 0)) changed = true
      }
    })
    if (contradiction) break
    links.forEach((_, l) => {
      if (lowOf(d[l]) > 0) for (const x of crosses[l]) if (narrow(x, 1, 'cross', null, 0)) changed = true
    })
    if (contradiction) break
    // Groups: join islands by the bridges that are certain, then rule out any extra count that would finish a group while islands remain outside it.
    const parent = islands.map((_, i) => i)
    const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    const deg = islands.map(() => 0)
    links.forEach((l, k) => {
      const lo = lowOf(d[k])
      if (lo > 0) parent[find(l.a)] = find(l.b)
      deg[l.a] += lo
      deg[l.b] += lo
    })
    const size = new Map<number, number>()
    const unsat = new Map<number, number>()
    islands.forEach((isl, i) => {
      const root = find(i)
      size.set(root, (size.get(root) ?? 0) + 1)
      unsat.set(root, (unsat.get(root) ?? 0) + (deg[i] === isl.n ? 0 : 1))
    })
    links.forEach((l, k) => {
      if (contradiction) return
      const lo = lowOf(d[k])
      for (let v = lo + 1; v <= highOf(d[k]); v++) {
        if (!(d[k] & (1 << v))) continue
        const ra = find(l.a)
        const rb = find(l.b)
        let left = (unsat.get(ra) ?? 0) + (ra === rb ? 0 : (unsat.get(rb) ?? 0))
        const total = (size.get(ra) ?? 0) + (ra === rb ? 0 : (size.get(rb) ?? 0))
        for (const end of [l.a, l.b]) {
          const isl = islands[end]
          if (deg[end] !== isl.n && deg[end] + (v - lo) === isl.n) left--
          else if (deg[end] === isl.n) left++
        }
        if (left === 0 && total < islands.length && narrow(k, ~(1 << v) & 7, 'link', null, 0)) changed = true
      }
    })
  }
  return { dom: d, contradiction }
}

/** Masks to start from: each link takes 0 up to its cap. */
export const startDomains = (links: readonly Link[]): number[] => links.map((l) => range(0, l.cap))

/** The counts when logic alone settles every link, else null. */
export function solveByLogic(p: Shape): number[] | null {
  const { dom, contradiction } = propagate(p, startDomains(p.links))
  if (contradiction) return null
  const out: number[] = []
  for (const m of dom) {
    if (lowOf(m) !== highOf(m)) return null
    out.push(lowOf(m))
  }
  return out
}

/** Bridges at each island. */
export function islandTotals(p: Pick<HashiPuzzle, 'islands' | 'links'>, counts: readonly number[]): number[] {
  const out = p.islands.map(() => 0)
  p.links.forEach((l, i) => { out[l.a] += counts[i]; out[l.b] += counts[i] })
  return out
}

/** Whether every island can reach every other along the bridges placed. */
export function isConnected(p: Pick<HashiPuzzle, 'islands' | 'links'>, counts: readonly number[]): boolean {
  const parent = p.islands.map((_, i) => i)
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  p.links.forEach((l, i) => { if (counts[i] > 0) parent[find(l.a)] = find(l.b) })
  const root = find(0)
  return p.islands.every((_, i) => find(i) === root)
}

/** Solved when every island has its number and the whole group is one piece. Crossings cannot be placed, so they are not checked here. */
export function isHashiSolved(p: Pick<HashiPuzzle, 'islands' | 'links'>, counts: readonly number[]): boolean {
  const totals = islandTotals(p, counts)
  return p.islands.every((isl, i) => totals[i] === isl.n) && isConnected(p, counts)
}

/** Whether a bridge may be added to a link: nothing certain crosses it. */
export const isBlocked = (p: Pick<HashiPuzzle, 'crosses'>, counts: readonly number[], link: number): boolean => p.crosses[link].some((x) => counts[x] > 0)

/** The next count when a link is tapped: none, one, two, then none again (a pair with a 1 stops at one). Null when a crossing bridge is in the way. */
export function cycleCount(p: Pick<HashiPuzzle, 'links' | 'crosses'>, counts: readonly number[], link: number): number | null {
  const cur = counts[link]
  if (cur > 0) return (cur + 1) % (p.links[link].cap + 1)
  return isBlocked(p, counts, link) || p.links[link].cap === 0 ? null : 1
}

export interface IslandStatus {
  /** Has its number exactly. */
  done: boolean[]
  /** Has too many, or cannot reach its number any more. */
  bad: boolean[]
  /** Part of a finished group that is cut off from the other islands. */
  closed: boolean[]
}

export function islandStatus(p: Pick<HashiPuzzle, 'islands' | 'links' | 'crosses'>, counts: readonly number[]): IslandStatus {
  const totals = islandTotals(p, counts)
  const room = p.islands.map(() => 0)
  p.links.forEach((l, i) => {
    const free = isBlocked(p, counts, i) ? counts[i] : l.cap
    // Room is capped by what the island at the other end can still take.
    room[l.a] += Math.min(free, counts[i] + Math.max(0, p.islands[l.b].n - totals[l.b]))
    room[l.b] += Math.min(free, counts[i] + Math.max(0, p.islands[l.a].n - totals[l.a]))
  })
  const done = p.islands.map((isl, i) => totals[i] === isl.n)
  const bad = p.islands.map((isl, i) => totals[i] > isl.n || room[i] < isl.n)
  const parent = p.islands.map((_, i) => i)
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  p.links.forEach((l, i) => { if (counts[i] > 0) parent[find(l.a)] = find(l.b) })
  const finished = new Map<number, boolean>()
  p.islands.forEach((_, i) => finished.set(find(i), (finished.get(find(i)) ?? true) && done[i]))
  const closed = p.islands.map((_, i) => !!finished.get(find(i)) && p.islands.some((__, j) => find(j) !== find(i)))
  return { done, bad, closed }
}

export type HashiHint =
  | { kind: 'mistake'; links: number[] }
  | { kind: 'move'; move: HashiMove }

/** The next hint: any link with more bridges than the answer first, then the first link that logic says needs more. */
export function nextHashiHint(p: HashiPuzzle, counts: readonly number[]): HashiHint | null {
  const wrong = counts.flatMap((c, i) => (c > p.solution[i] ? [i] : []))
  if (wrong.length) return { kind: 'mistake', links: wrong }
  // Start from what is placed: the answer has at least as many on each link, so logic from here stays sound.
  const dom = p.links.map((l, i) => range(counts[i], l.cap))
  const trace: HashiMove[] = []
  propagate(p, dom, trace)
  const raise = trace.find((m) => m.lo > counts[m.link] && (m.rule === 'all' || m.rule === 'least'))
  if (raise) return { kind: 'move', move: raise }
  const l = p.solution.findIndex((s, i) => s > counts[i])
  return l < 0 ? null : { kind: 'move', move: { link: l, lo: p.solution[l], hi: p.solution[l], rule: 'reveal', island: null, rest: 0 } }
}

/* ---------- generator ---------- */

/** Grows a connected set of islands joined by straight, non-crossing bridges, then adds a few extra bridges between neighbours. */
function growLayout(rows: number, cols: number, count: number, random: () => number): { cells: number[]; planted: { a: number; b: number; k: number }[] } | null {
  const grid = Array<number>(rows * cols).fill(0) // 0 empty, 1 island, 2 bridge
  const cells: number[] = []
  const planted: { a: number; b: number; k: number }[] = []
  const first = Math.floor(random() * rows * cols)
  grid[first] = 1
  cells.push(first)
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]]
  const touchesIsland = (r: number, c: number) => DIRS.some(([dr, dc]) => r + dr >= 0 && c + dc >= 0 && r + dr < rows && c + dc < cols && grid[(r + dr) * cols + c + dc] === 1)
  for (let attempt = 0; attempt < 3000 && cells.length < count; attempt++) {
    const from = cells[Math.floor(random() * cells.length)]
    const [dr, dc] = DIRS[Math.floor(random() * 4)]
    const r0 = Math.floor(from / cols)
    const c0 = from % cols
    const reach: number[] = []
    for (let s = 1; s <= 7; s++) {
      const r = r0 + dr * s
      const c = c0 + dc * s
      if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r * cols + c] !== 0) break
      reach.push(s)
    }
    const options = reach.filter((s) => s >= 2 && !touchesIsland(r0 + dr * s, c0 + dc * s))
    if (!options.length) continue
    const s = options[Math.floor(random() * options.length)]
    for (let k = 1; k < s; k++) grid[(r0 + dr * k) * cols + c0 + dc * k] = 2
    const to = (r0 + dr * s) * cols + c0 + dc * s
    grid[to] = 1
    cells.push(to)
    planted.push({ a: from, b: to, k: random() < 0.3 ? 2 : 1 })
  }
  if (cells.length < Math.ceil(count * 0.85)) return null
  // Extra bridges between islands that already face each other across empty squares make loops.
  const probe = cells.map((i) => ({ r: Math.floor(i / cols), c: i % cols, n: 0 }))
  for (const l of buildLinks(probe)) {
    const a = probe[l.a]
    const b = probe[l.b]
    const between: number[] = []
    if (l.horizontal) for (let c = a.c + 1; c < b.c; c++) between.push(a.r * cols + c)
    else for (let r = a.r + 1; r < b.r; r++) between.push(r * cols + a.c)
    if (between.some((i) => grid[i] !== 0) || random() > 0.45) continue
    for (const i of between) grid[i] = 2
    planted.push({ a: cells[l.a], b: cells[l.b], k: random() < 0.3 ? 2 : 1 })
  }
  return { cells, planted }
}

/** Makes a puzzle that logic alone solves, so the answer is unique. */
export function generateHashi(difficulty: Difficulty, random: () => number = Math.random): HashiPuzzle {
  const { rows, cols, islands: count } = HASHI_LEVELS[difficulty]
  for (;;) {
    const layout = growLayout(rows, cols, count, random)
    if (!layout) continue
    const { cells, planted } = layout
    const need = cells.map(() => 0)
    for (const { a, b, k } of planted) { need[cells.indexOf(a)] += k; need[cells.indexOf(b)] += k }
    const islands: Island[] = cells.map((i, k) => ({ r: Math.floor(i / cols), c: i % cols, n: need[k] }))
    const links = buildLinks(islands)
    const crosses = crossingsOf(islands, links)
    const solution = links.map((l) => {
      const a = cells[l.a]
      const b = cells[l.b]
      return planted.find((q) => (q.a === a && q.b === b) || (q.a === b && q.b === a))?.k ?? 0
    })
    const found = solveByLogic({ islands, links, crosses })
    if (found && found.every((v, i) => v === solution[i])) return { difficulty, rows, cols, islands, links, crosses, solution }
  }
}
