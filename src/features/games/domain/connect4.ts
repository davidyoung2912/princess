import { search, type Skill } from './search'
import type { Rng } from './cards'

/** Connect Four: drop discs into a seven-column, six-row grid; they fall to the lowest empty slot. First to line up four, across, up or diagonally, wins. */
export const COLS = 7
export const ROWS = 6
export interface C4 { cells: (0 | 1 | 2)[]; turn: 1 | 2; winner: 0 | 1 | 2 | 3; line: number[]; last: number | null; moves: number }
export const start = (): C4 => ({ cells: Array(COLS * ROWS).fill(0), turn: 1, winner: 0, line: [], last: null, moves: 0 })
/** The row a disc would land in for `col` (0 is the top), or -1 if the column is full. */
export const landing = (cells: readonly number[], col: number): number => { for (let r = ROWS - 1; r >= 0; r--) if (cells[r * COLS + col] === 0) return r; return -1 }
export const legalMoves = (g: C4): number[] => (g.winner ? [] : Array.from({ length: COLS }, (_, c) => c).filter((c) => landing(g.cells, c) >= 0))

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]]
function lineAt(cells: readonly number[], i: number, p: number): number[] {
  const r0 = Math.floor(i / COLS), c0 = i % COLS
  for (const [dr, dc] of DIRS) {
    const line = [i]
    for (const s of [1, -1]) { let r = r0 + dr * s, c = c0 + dc * s; while (r >= 0 && r < ROWS && c >= 0 && c < COLS && cells[r * COLS + c] === p) { line.push(r * COLS + c); r += dr * s; c += dc * s } }
    if (line.length >= 4) return line
  }
  return []
}
export function drop(g: C4, col: number): C4 | null {
  const r = landing(g.cells, col)
  if (g.winner || r < 0) return null
  const cells = g.cells.slice()
  const i = r * COLS + col
  cells[i] = g.turn
  const line = lineAt(cells, i, g.turn)
  const moves = g.moves + 1
  const winner: C4['winner'] = line.length ? g.turn : moves === COLS * ROWS ? 3 : 0
  return { cells, turn: (3 - g.turn) as 1 | 2, winner, line, last: i, moves }
}

/** Every window of four, scored for player 1 minus player 2, plus a lean to the centre. */
const WINDOWS: number[][] = []
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of DIRS) {
  const er = r + 3 * dr, ec = c + 3 * dc
  if (er >= 0 && er < ROWS && ec >= 0 && ec < COLS) WINDOWS.push([0, 1, 2, 3].map((k) => (r + k * dr) * COLS + c + k * dc))
}
function value(g: C4): number {
  if (g.winner === 1) return 100000 - g.moves
  if (g.winner === 2) return -100000 + g.moves
  if (g.winner === 3) return 0
  let v = 0
  for (const w of WINDOWS) {
    let a = 0, b = 0
    for (const i of w) { if (g.cells[i] === 1) a++; else if (g.cells[i] === 2) b++ }
    if (a && b) continue
    const k = a || b
    const s = k === 1 ? 1 : k === 2 ? 6 : k === 3 ? 40 : 0
    v += a ? s : -s
  }
  for (let r = 0; r < ROWS; r++) { const i = r * COLS + 3; v += g.cells[i] === 1 ? 4 : g.cells[i] === 2 ? -4 : 0 }
  return v
}
const ctx = { moves: legalMoves, apply: (g: C4, m: number) => drop(g, m)!, player: (g: C4): 0 | 1 => (g.turn === 1 ? 0 : 1), over: (g: C4) => g.winner !== 0, value }

/** The computer's column. Cadet looks two discs ahead and sometimes drops at random; Captain looks five ahead; Admiral looks eight. Centre columns are tried first. */
export function chooseMove(g: C4, skill: Skill, rng: Rng = Math.random): number | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  for (const m of moves) if (drop(g, m)!.winner === g.turn) return m
  if (skill === 'cadet' && rng() < 0.25) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 2 : skill === 'captain' ? 5 : 8
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 120000 : 30000 })
}
