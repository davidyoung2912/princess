import { type Rng } from './cards'
import type { Skill } from './search'
import { stepsOf, type Handicap } from './handicap'

/**
 * Gomoku and Pente on a square line board. Players alternate placing a stone on an empty point; five (or more) in a row wins. Pente adds captures: a move that closes
 * exactly two enemy stones between the new stone and one of your own removes them, and ten captured stones (five pairs) also win.
 */
export type FiveMode = 'gomoku' | 'pente'
export const SIZE_OF: Record<FiveMode, number> = { gomoku: 15, pente: 19 }
export interface Five {
  mode: FiveMode
  n: number
  cells: (0 | 1 | 2)[] // 1 black (moves first), 2 white
  turn: 1 | 2
  last: number | null
  /** Pairs captured by black and by white (Pente). */
  captures: [number, number]
  winner: 0 | 1 | 2 | 3 // 3 is a draw
  line: number[]
  /** Stones removed by the last move (Pente). */
  removed: number[]
  moves: number
  /** Pairs that win a game of Pente (five, or three in a quick game). */
  captureWin: number
}

/** A head start for black (the player): one or two extra stones near the middle, placed before white moves. A quick game of Pente is won with three captured pairs. */
export function withHandicap(g: Five, h: Handicap, quick = false): Five {
  const cells = g.cells.slice()
  const m = Math.floor(g.n / 2)
  const spots = [m * g.n + m, (m + 1) * g.n + m + 1].slice(0, stepsOf(h))
  for (const i of spots) cells[i] = 1
  const first: Five = spots.length ? { ...g, cells, moves: spots.length, turn: 2, last: spots[spots.length - 1] } : g
  return { ...first, captureWin: quick && g.mode === 'pente' ? 3 : 5 }
}

export const start = (mode: FiveMode): Five => ({ mode, n: SIZE_OF[mode], cells: Array(SIZE_OF[mode] ** 2).fill(0), turn: 1, last: null, captures: [0, 0], winner: 0, line: [], removed: [], moves: 0, captureWin: 5 })

const AXES: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]]
const ALL: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]
const inside = (n: number, r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n

/** The run of `p` stones through `i` along an axis (including `i`), and how many of its two ends are open. */
function runAt(cells: readonly number[], n: number, i: number, p: number, [dr, dc]: [number, number]): { len: number; open: number; line: number[] } {
  const r0 = Math.floor(i / n), c0 = i % n
  const line = [i]
  let open = 0
  for (const s of [1, -1]) {
    let r = r0 + dr * s, c = c0 + dc * s
    while (inside(n, r, c) && cells[r * n + c] === p) { line.push(r * n + c); r += dr * s; c += dc * s }
    if (inside(n, r, c) && cells[r * n + c] === 0) open++
  }
  return { len: line.length, open, line }
}

export function place(g: Five, i: number): Five | null {
  if (g.winner || i < 0 || i >= g.cells.length || g.cells[i] !== 0) return null
  const { n, turn } = g
  const cells = g.cells.slice()
  cells[i] = turn
  const removed: number[] = []
  const captures: [number, number] = [g.captures[0], g.captures[1]]
  if (g.mode === 'pente') {
    const r0 = Math.floor(i / n), c0 = i % n
    for (const [dr, dc] of ALL) {
      const a = [r0 + dr, c0 + dc], b = [r0 + 2 * dr, c0 + 2 * dc], c = [r0 + 3 * dr, c0 + 3 * dc]
      if (inside(n, c[0], c[1]) && cells[a[0] * n + a[1]] === 3 - turn && cells[b[0] * n + b[1]] === 3 - turn && cells[c[0] * n + c[1]] === turn) {
        cells[a[0] * n + a[1]] = 0
        cells[b[0] * n + b[1]] = 0
        removed.push(a[0] * n + a[1], b[0] * n + b[1])
        captures[turn - 1]++
      }
    }
  }
  let winner: Five['winner'] = 0
  let line: number[] = []
  for (const ax of AXES) { const r = runAt(cells, n, i, turn, ax); if (r.len >= 5) { winner = turn; line = r.line; break } }
  if (!winner && g.mode === 'pente' && captures[turn - 1] >= g.captureWin) winner = turn
  const moves = g.moves + 1
  if (!winner && cells.every((x) => x !== 0)) winner = 3
  return { ...g, cells, turn: (3 - turn) as 1 | 2, last: i, captures, winner, line, removed, moves }
}

/** How good a point is for `p`: the strength of the lines it would make, plus captures in Pente. */
function strength(g: Five, i: number, p: 1 | 2): number {
  const { n } = g
  const cells = g.cells.slice()
  cells[i] = p
  let s = 0
  for (const ax of AXES) {
    const { len, open } = runAt(cells, n, i, p, ax)
    if (len >= 5) s += 1e6
    else if (len === 4) s += open === 2 ? 20000 : open === 1 ? 2000 : 0
    else if (len === 3) s += open === 2 ? 1500 : open === 1 ? 150 : 0
    else if (len === 2) s += open === 2 ? 120 : open === 1 ? 12 : 0
    else s += open
  }
  if (g.mode === 'pente') {
    const r0 = Math.floor(i / n), c0 = i % n
    for (const [dr, dc] of ALL) {
      const a = [r0 + dr, c0 + dc], b = [r0 + 2 * dr, c0 + 2 * dc], c = [r0 + 3 * dr, c0 + 3 * dc]
      if (inside(n, c[0], c[1]) && cells[a[0] * n + a[1]] === 3 - p && cells[b[0] * n + b[1]] === 3 - p && cells[c[0] * n + c[1]] === p) s += g.captures[p - 1] >= 4 ? 1e6 : 900
    }
  }
  return s
}

function candidates(g: Five): number[] {
  const { n, cells } = g
  const out = new Set<number>()
  let any = false
  cells.forEach((v, i) => {
    if (!v) return
    any = true
    const r0 = Math.floor(i / n), c0 = i % n
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const r = r0 + dr, c = c0 + dc; if (inside(n, r, c) && cells[r * n + c] === 0) out.add(r * n + c) }
  })
  if (!any) return [Math.floor(n / 2) * n + Math.floor(n / 2)]
  return [...out]
}

/** The computer's move, from the board only. Cadet usually plays a sensible point near the stones; Captain takes wins, blocks and builds lines; Admiral also looks at the reply to each of its best moves. */
export function chooseMove(g: Five, skill: Skill, rng: Rng = Math.random): number | null {
  const cand = candidates(g)
  if (cand.length === 0) return null
  const me = g.turn, them = (3 - g.turn) as 1 | 2
  if (g.moves === 0) return cand[0]
  const scored = cand.map((i) => ({ i, own: strength(g, i, me), theirs: strength(g, i, them) }))
  if (skill === 'cadet') {
    scored.sort((a, b) => (b.own + b.theirs * 0.6) - (a.own + a.theirs * 0.6))
    if (scored[0].own >= 1e6 && rng() < 0.7) return scored[0].i
    const top = scored.slice(0, 8)
    return top[Math.floor(rng() * top.length)].i
  }
  const rated = scored.map((s) => ({ ...s, k: s.own * 1.05 + s.theirs + rng() }))
  rated.sort((a, b) => b.k - a.k)
  if (skill === 'captain' || rated[0].own >= 1e6 || rated[0].theirs >= 1e6) return rated[0].i
  // Admiral: for each of the best points, play it and see how strong the best reply is.
  let best = rated[0].i
  let bestV = -Infinity
  for (const s of rated.slice(0, 10)) {
    const next = place(g, s.i)
    if (!next) continue
    if (next.winner === me) return s.i
    let reply = 0
    for (const j of candidates(next).map((x) => ({ x, v: strength(next, x, them) + strength(next, x, me) * 0.5 })).sort((a, b) => b.v - a.v).slice(0, 6)) reply = Math.max(reply, j.v)
    const v = s.own * 1.05 + s.theirs - reply * 0.9 + rng()
    if (v > bestV) { bestV = v; best = s.i }
  }
  return best
}
