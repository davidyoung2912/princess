/**
 * Games in a chat (docs/chat-bundles-plan.md, phase B8): a puzzle as a short piece of plain text and back. Framework-free.
 * The puzzle travels as its clues (never the solution): the receiver's own solver rebuilds the answer and returns null when the text is not a
 * solvable puzzle of that game, so nothing here trusts the sender. `decode` is total (it never throws) and bounded (a search has a node budget).
 * Text is `key=value` pairs joined by `;` using only letters, digits, `=`, `;` and `,` so it can pass the server's allow-list unchanged.
 */
import { connected, makeRules, neighbours, solveUniqueWithin, CLASSIC, DIAGONAL, DIFFICULTIES, type Cage, type Difficulty, type Puzzle } from './sudoku'
import { logicSolve, killerConflicts } from './killer'
import { BINAIRO_LEVELS, isValidBinairo, logicSolveBinairo, type BinairoPuzzle } from './binairo'
import { FUTOSHIKI_LEVELS, futoshikiConflicts, logicSolveFutoshiki, type FutoshikiPuzzle } from './futoshiki'
import { KENKEN_LEVELS, brokenCages, gridNeighbours, kenkenConflicts, logicSolveKenKen, type KCage, type KenKenPuzzle, type Op } from './kenken'
import { BLANK, HITORI_LEVELS, isValidHitori, logicSolveHitori, type HitoriPuzzle } from './hitori'
import { CROSSMATH_LEVELS, isCrossmathSolved, logicSolveCrossmath, type CellKind, type CrossmathPuzzle, type Equation, type Sign } from './crossmath'
import { KAKURO_LEVELS, kakuroConflicts, logicSolveKakuro, runsOf as kakuroRuns, type KakuroPuzzle } from './kakuro'
import { BLANK as SL_BLANK, NONE, SLITHER_LEVELS, edgeCount, isSlitherSolved, logicSolveSlither, type SlitherPuzzle } from './slitherlink'
import { BLANK as NK_BLANK, NURIKABE_LEVELS, WALL, isValidNurikabe, logicSolveNurikabe, type NurikabePuzzle } from './nurikabe'
import { HASHI_LEVELS, buildLinks, crossingsOf, solveByLogic, type HashiPuzzle, type Island } from './hashi'
import { EMPTY, FILLED, NONOGRAM_LEVELS, cluesOf, solveNonogram, type NonogramPuzzle } from './nonogram'

export type ShareMode = 'start' | 'current'

/** The games that can be sent so far (the catalogue ids). */
export const SHAREABLE_GAMES = ['sudoku', 'diagonal-sudoku', 'jigsaw-sudoku', 'killer-sudoku', 'binairo', 'futoshiki', 'kenken', 'hitori', 'crossmath', 'kakuro', 'slitherlink', 'nurikabe', 'hashi', 'nonogram'] as const
export type ShareableGame = (typeof SHAREABLE_GAMES)[number]
export const isShareableGame = (id: string): id is ShareableGame => (SHAREABLE_GAMES as readonly string[]).includes(id)

/** The most a payload may hold; mirrors the server. */
export const GAME_DATA_MAX = 4000
export const GAME_DATA_CHARS = /^[A-Za-z0-9=;,]+$/

type SudokuGame = 'sudoku' | 'diagonal-sudoku' | 'jigsaw-sudoku' | 'killer-sudoku'

/**
 * A puzzle as it stands: for Sudoku `entries` are the digits placed by the player and `notes` the pencil marks (one 9-bit mask per cell); for the others only `entries`
 * (for Hitori the marks, 0 blank, 1 shaded, 2 circled). Notes are not sent for Futoshiki and KenKen yet.
 */
export type SharedGame =
  | { game: SudokuGame; puzzle: Puzzle; entries: number[]; notes: number[] }
  | { game: 'binairo'; puzzle: BinairoPuzzle; entries: number[]; notes: number[] }
  | { game: 'futoshiki'; puzzle: FutoshikiPuzzle; entries: number[]; notes: number[] }
  | { game: 'kenken'; puzzle: KenKenPuzzle; entries: number[]; notes: number[] }
  | { game: 'hitori'; puzzle: HitoriPuzzle; entries: number[]; notes: number[] }
  | { game: 'crossmath'; puzzle: CrossmathPuzzle; entries: number[]; notes: number[] }
  | { game: 'kakuro'; puzzle: KakuroPuzzle; entries: number[]; notes: number[] }
  | { game: 'slitherlink'; puzzle: SlitherPuzzle; entries: number[]; notes: number[] }
  | { game: 'nurikabe'; puzzle: NurikabePuzzle; entries: number[]; notes: number[] }
  | { game: 'hashi'; puzzle: HashiPuzzle; entries: number[]; notes: number[] }
  | { game: 'nonogram'; puzzle: NonogramPuzzle; entries: number[]; notes: number[] }

/** A Sudoku-family puzzle (the ones that have rules, regions or cages and pencil notes). */
export const isSudokuShare = (s: SharedGame): s is Extract<SharedGame, { game: SudokuGame }> => s.game.endsWith('sudoku')

const VARIANT = { sudoku: 'classic', 'diagonal-sudoku': 'diagonal', 'jigsaw-sudoku': 'jigsaw', 'killer-sudoku': 'killer' } as const
const CELLS = 81
const B32 = '0123456789abcdefghijklmnopqrstuv'

const pairs = (data: string): Map<string, string> | null => {
  if (data.length === 0 || data.length > GAME_DATA_MAX || !GAME_DATA_CHARS.test(data)) return null
  const out = new Map<string, string>()
  for (const part of data.split(';')) {
    const at = part.indexOf('=')
    if (at < 1) return null
    const key = part.slice(0, at)
    if (out.has(key)) return null
    out.set(key, part.slice(at + 1))
  }
  return out
}

const join = (m: Record<string, string | undefined>): string => Object.entries(m).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(';')

/** The text for a puzzle. `current` adds the digits the player has placed, and the pencil marks only when `withNotes`; `start` is the clues alone. */
export function encodeGame(s: SharedGame, mode: ShareMode, withNotes = false): string {
  if (s.game === 'futoshiki' || s.game === 'kenken' || s.game === 'hitori') return encodeGrid(s, mode)
  if (isLaterGame(s)) return encodeLater(s, mode)
  const p = s.puzzle
  const clues = p.puzzle
  const entries = clues.map((c, i) => (c !== 0 ? 0 : s.entries[i] ?? 0))
  const extra: Record<string, string | undefined> = {}
  if (mode === 'current' && entries.some((v) => v !== 0)) extra.e = entries.join('')
  if (s.game !== 'binairo') {
    const rules = (p as Puzzle).rules
    if (mode === 'current' && withNotes && s.notes.some((m, i) => m !== 0 && clues[i] === 0 && entries[i] === 0)) {
      extra.n = s.notes.map((m, i) => (clues[i] === 0 && entries[i] === 0 ? B32[(m >> 5) & 31] + B32[m & 31] : '00')).join('')
    }
    return join({
      d: p.difficulty, p: clues.join(''),
      ...(s.game === 'jigsaw-sudoku' ? { r: rules.region.join('') } : {}),
      ...(s.game === 'killer-sudoku' ? { g: rules.cageOf.map((k) => k.toString(36)).join(''), s: rules.cages.map((c) => c.sum).join(',') } : {}),
      ...extra,
    })
  }
  return join({ d: p.difficulty, p: clues.join(''), ...extra })
}

const isLevel = (v: string | undefined): v is Difficulty => (DIFFICULTIES as readonly string[]).includes(v ?? '')

/** Entries: the right length, digits in range, and none on a clue (a clue's cell is the sender's, not the player's). */
function readEntries(m: Map<string, string>, clues: readonly number[], max: number): number[] | null {
  const e = m.get('e')
  if (e === undefined) return clues.map(() => 0)
  if (e.length !== clues.length || ![...e].every((c) => c >= '0' && c <= String(max))) return null
  return [...e].map((c, i) => (clues[i] !== 0 ? 0 : Number(c)))
}

function readNotes(m: Map<string, string>, clues: readonly number[], entries: readonly number[]): number[] | null {
  const n = m.get('n')
  if (n === undefined) return clues.map(() => 0)
  if (n.length !== CELLS * 2) return null
  const out: number[] = []
  for (let i = 0; i < CELLS; i++) {
    const hi = B32.indexOf(n[i * 2])
    const lo = B32.indexOf(n[i * 2 + 1])
    if (hi < 0 || lo < 0 || hi > 15) return null
    out.push(clues[i] === 0 && entries[i] === 0 ? (hi << 5) | lo : 0)
  }
  return out
}

function cagesFrom(g: string, s: string): Cage[] | null {
  if (!/^[0-9a-z]{81}$/.test(g) || !/^\d{1,2}(,\d{1,2})*$/.test(s)) return null
  const sums = s.split(',').map(Number)
  if (sums.length > CELLS || sums.some((v) => v < 1 || v > 45)) return null
  const groups: number[][] = sums.map(() => [])
  for (let i = 0; i < CELLS; i++) {
    const k = parseInt(g[i], 36)
    if (!groups[k]) return null
    groups[k].push(i)
  }
  for (const cells of groups) {
    if (cells.length === 0 || cells.length > 9) return null
    const seen = new Set<number>([cells[0]])
    const queue = [cells[0]]
    while (queue.length) for (const nb of neighbours(queue.pop()!)) if (cells.includes(nb) && !seen.has(nb)) { seen.add(nb); queue.push(nb) }
    if (seen.size !== cells.length) return null
  }
  return groups.map((cells, k) => ({ cells, sum: sums[k] }))
}

function decodeSudoku(game: SudokuGame, m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  if (!isLevel(d) || p === undefined || !/^[0-9]{81}$/.test(p)) return null
  const clues = [...p].map(Number)
  const variant = VARIANT[game]
  let rules
  if (variant === 'classic') rules = CLASSIC
  else if (variant === 'diagonal') rules = DIAGONAL
  else if (variant === 'jigsaw') {
    const r = m.get('r')
    if (r === undefined || !/^[0-8]{81}$/.test(r)) return null
    const region = [...r].map(Number)
    for (let id = 0; id < 9; id++) if (region.filter((v) => v === id).length !== 9 || !connected(region, id)) return null
    rules = makeRules('jigsaw', region)
  } else {
    const cages = cagesFrom(m.get('g') ?? '', m.get('s') ?? '')
    if (!cages) return null
    rules = makeRules('killer', undefined, cages)
  }
  let solution: number[] | null
  if (variant === 'killer') {
    solution = logicSolve(clues, rules, 2)
    if (solution && (killerConflicts(solution, rules).size > 0 || clues.some((c, i) => c !== 0 && c !== solution![i]))) solution = null
  } else solution = solveUniqueWithin(clues, rules)
  if (!solution) return null
  const entries = readEntries(m, clues, 9)
  if (!entries) return null
  const notes = readNotes(m, clues, entries)
  if (!notes) return null
  return { game, puzzle: { difficulty: d, rules, puzzle: clues, solution }, entries, notes }
}

function decodeBinairo(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  if (!isLevel(d) || p === undefined || !/^[0-2]+$/.test(p)) return null
  const size = Math.round(Math.sqrt(p.length))
  if (size * size !== p.length || !Object.values(BINAIRO_LEVELS).some((l) => l.size === size)) return null
  const clues = [...p].map(Number)
  const solution = logicSolveBinairo(clues, size, true)
  if (!isValidBinairo(solution, size) || clues.some((c, i) => c !== 0 && c !== solution[i])) return null
  const entries = readEntries(m, clues, 2)
  if (!entries) return null
  return { game: 'binairo', puzzle: { size, difficulty: d, puzzle: clues, solution }, entries, notes: Array(p.length).fill(0) }
}

const OP_LETTER: Record<Op, string> = { add: 'a', sub: 's', mul: 'm', div: 'd', given: 'g' }
const LETTER_OP: Record<string, Op> = { a: 'add', s: 'sub', m: 'mul', d: 'div', g: 'given' }

/** Futoshiki, KenKen and Hitori: the same `d=` level and `p=` digits as the others, plus what each game needs (`s` signs, `g`/`o`/`t` cages, `e` entries or marks). */
function encodeGrid(s: Extract<SharedGame, { game: 'futoshiki' | 'kenken' | 'hitori' }>, mode: ShareMode): string {
  const p = s.puzzle
  const clues = s.game === 'hitori' ? s.puzzle.values.map((v) => v % 10) : (p as FutoshikiPuzzle | KenKenPuzzle).puzzle
  const entries = s.game === 'hitori' ? s.entries : clues.map((c, i) => (c !== 0 ? 0 : s.entries[i] ?? 0))
  const extra: Record<string, string | undefined> = {}
  if (mode === 'current' && entries.some((v) => v !== 0)) extra.e = entries.join('')
  if (s.game === 'futoshiki') return join({ d: p.difficulty, p: clues.join(''), s: s.puzzle.signs.flatMap((g) => [g.lo, g.hi]).join(','), ...extra })
  if (s.game === 'kenken') {
    const cages = s.puzzle.cages
    const owner = Array<number>(clues.length).fill(0)
    cages.forEach((c, k) => c.cells.forEach((i) => { owner[i] = k }))
    return join({ d: p.difficulty, p: clues.join(''), g: owner.map((k) => k.toString(36).padStart(2, '0')).join(''), o: cages.map((c) => OP_LETTER[c.op]).join(''), t: cages.map((c) => c.target).join(','), ...extra })
  }
  return join({ d: p.difficulty, p: clues.join(''), ...extra })
}

/** The size of a square board from its cell count, when a game has a level of that size. */
const sizeOf = (len: number, sizes: readonly number[]): number | null => {
  const n = Math.round(Math.sqrt(len))
  return n * n === len && sizes.includes(n) ? n : null
}

function readGridEntries(m: Map<string, string>, len: number, max: number, fixed: (i: number) => boolean): number[] | null {
  const e = m.get('e')
  if (e === undefined) return Array(len).fill(0)
  if (e.length !== len || ![...e].every((c) => c >= '0' && c <= String(max))) return null
  return [...e].map((c, i) => (fixed(i) ? 0 : Number(c)))
}

function decodeFutoshiki(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  if (!isLevel(d) || p === undefined || !/^[0-9]+$/.test(p)) return null
  const n = sizeOf(p.length, Object.values(FUTOSHIKI_LEVELS).map((l) => l.size))
  if (n === null) return null
  const clues = [...p].map(Number)
  if (clues.some((c) => c > n)) return null
  const raw = m.get('s') ?? ''
  if (raw !== '' && !/^\d{1,2}(,\d{1,2})*$/.test(raw)) return null
  const flat = raw === '' ? [] : raw.split(',').map(Number)
  if (flat.length % 2 !== 0 || flat.length > n * n * 2) return null
  const signs = []
  for (let k = 0; k < flat.length; k += 2) {
    const lo = flat[k]
    const hi = flat[k + 1]
    if (lo >= n * n || hi >= n * n || !gridNeighbours(lo, n).includes(hi)) return null
    signs.push({ lo, hi })
  }
  const solution = logicSolveFutoshiki(clues, n, signs)
  if (solution.some((v) => v === 0) || futoshikiConflicts(solution, n, signs).size > 0) return null
  const entries = readGridEntries(m, p.length, n, (i) => clues[i] !== 0)
  if (!entries) return null
  return { game: 'futoshiki', puzzle: { size: n, difficulty: d, puzzle: clues, solution, signs }, entries, notes: Array(p.length).fill(0) }
}

function decodeKenKen(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  const g = m.get('g')
  const o = m.get('o')
  const t = m.get('t')
  if (!isLevel(d) || p === undefined || g === undefined || o === undefined || t === undefined || !/^[0-9]+$/.test(p) || !/^[0-9a-z]+$/.test(g)) return null
  const n = sizeOf(p.length, Object.values(KENKEN_LEVELS).map((l) => l.size))
  if (n === null || g.length !== p.length * 2 || !/^[asmdg]+$/.test(o) || !/^\d{1,4}(,\d{1,4})*$/.test(t)) return null
  const clues = [...p].map(Number)
  if (clues.some((c) => c > n)) return null
  const targets = t.split(',').map(Number)
  if (targets.length !== o.length || o.length > p.length) return null
  const groups: number[][] = o.split('').map(() => [])
  for (let i = 0; i < p.length; i++) {
    const k = parseInt(g.slice(i * 2, i * 2 + 2), 36)
    if (!groups[k]) return null
    groups[k].push(i)
  }
  const cages: KCage[] = []
  for (let k = 0; k < groups.length; k++) {
    const cells = groups[k]
    const op = LETTER_OP[o[k]]
    if (cells.length === 0 || cells.length > Math.max(...Object.values(KENKEN_LEVELS).map((l) => l.maxCage)) || targets[k] < 1) return null
    if ((op === 'given') !== (cells.length === 1) || ((op === 'sub' || op === 'div') && cells.length !== 2)) return null
    const seen = new Set<number>([cells[0]])
    const queue = [cells[0]]
    while (queue.length) for (const nb of gridNeighbours(queue.pop()!, n)) if (cells.includes(nb) && !seen.has(nb)) { seen.add(nb); queue.push(nb) }
    if (seen.size !== cells.length) return null
    cages.push({ cells, op, target: targets[k] })
  }
  const solution = logicSolveKenKen(clues, n, cages)
  if (solution.some((v) => v === 0) || kenkenConflicts(solution, n, cages).size > 0 || brokenCages(solution, cages).length > 0) return null
  if (clues.some((c, i) => c !== 0 && c !== solution[i])) return null
  const entries = readGridEntries(m, p.length, n, (i) => clues[i] !== 0)
  if (!entries) return null
  return { game: 'kenken', puzzle: { size: n, difficulty: d, puzzle: clues, solution, cages }, entries, notes: Array(p.length).fill(0) }
}

function decodeHitori(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  if (!isLevel(d) || p === undefined || !/^[0-9]+$/.test(p)) return null
  const n = sizeOf(p.length, Object.values(HITORI_LEVELS).map((l) => l.size))
  if (n === null) return null
  const values = [...p].map((c) => (c === '0' ? 10 : Number(c)))
  if (values.some((v) => v > n)) return null
  const solution = logicSolveHitori(values, Array(p.length).fill(BLANK), n, true)
  if (solution.some((v) => v === BLANK) || !isValidHitori(values, solution, n)) return null
  const entries = readGridEntries(m, p.length, 2, () => false)
  if (!entries) return null
  return { game: 'hitori', puzzle: { size: n, difficulty: d, values, solution }, entries, notes: Array(p.length).fill(0) }
}


/* ---- Crossmath, Kakuro, Slitherlink, Nurikabe, Hashi and Nonogram (phase B9, part 2) ---- */

type LaterShare = Extract<SharedGame, { game: 'crossmath' | 'kakuro' | 'slitherlink' | 'nurikabe' | 'hashi' | 'nonogram' }>
const isLaterGame = (s: SharedGame): s is LaterShare => ['crossmath', 'kakuro', 'slitherlink', 'nurikabe', 'hashi', 'nonogram'].includes(s.game)

const KIND_LETTER: Record<CellKind, string> = { void: 'v', num: 'n', op: 'o', eq: 'e' }
const LETTER_KIND: Record<string, CellKind> = { v: 'void', n: 'num', o: 'op', e: 'eq' }
const SIGN_LETTER: Record<Sign, string> = { '+': 'a', '−': 's', '×': 'm', '÷': 'd' }
const LETTER_SIGN: Record<string, Sign> = { a: '+', s: '−', m: '×', d: '÷' }
/** Rows and columns as four digits, two each ("0711"), for the games whose size is not a square. */
const dims = (rows: number, cols: number): string => String(rows).padStart(2, '0') + String(cols).padStart(2, '0')
const clueRun = (r: readonly number[]): string => (r.length === 0 ? '0' : r.map((v) => v.toString(16)).join(''))

/** The text for one of the later six: the clues, never the solution; `e` is what the player has put down when sending the board so far. */
function encodeLater(s: LaterShare, mode: ShareMode): string {
  const p = s.puzzle
  const extra = (list: readonly number[], sep = ''): Record<string, string | undefined> => (mode === 'current' && list.some((v) => v !== 0) ? { e: list.join(sep) } : {})
  switch (s.game) {
    case 'crossmath': {
      const q = s.puzzle
      const nums = q.kind.flatMap((k, i) => (k === 'num' ? [i] : []))
      const blanks = nums.filter((i) => q.start[i] === 0)
      return join({
        d: q.difficulty, p: dims(q.rows, q.cols), k: q.kind.map((k) => KIND_LETTER[k]).join(''),
        y: q.kind.flatMap((k, i) => (k === 'op' ? [SIGN_LETTER[q.symbol[i] as Sign]] : [])).join(''),
        v: nums.map((i) => q.start[i]).join(','), t: q.tray.join(','),
        ...extra(blanks.map((i) => s.entries[i] ?? 0), ','),
      })
    }
    case 'kakuro': {
      const q = s.puzzle
      const entries = q.puzzle.map((g, i) => (q.white[i] && g === 0 ? s.entries[i] ?? 0 : 0))
      return join({ d: q.difficulty, p: q.puzzle.join(''), w: q.white.map((w) => (w ? '1' : '0')).join(''), s: q.runs.map((r) => r.sum).join(','), ...extra(entries) })
    }
    case 'slitherlink':
      return join({ d: p.difficulty, p: s.puzzle.clues.map((c) => (c === NONE ? 4 : c)).join(''), ...extra(s.entries) })
    case 'nurikabe': {
      const q = s.puzzle
      const at = q.clues.flatMap((c, i) => (c > 0 ? [i] : []))
      return join({ d: q.difficulty, p: dims(q.rows, q.cols), i: at.join(','), v: at.map((i) => q.clues[i]).join(','), ...extra(s.entries) })
    }
    case 'hashi': {
      const q = s.puzzle
      return join({ d: q.difficulty, p: dims(q.rows, q.cols), i: q.islands.map((x) => x.r * q.cols + x.c).join(','), v: q.islands.map((x) => x.n).join(''), ...extra(s.entries) })
    }
    default: {
      const q = s.puzzle
      return join({ d: q.difficulty, p: String(q.size), r: q.rows.map(clueRun).join(','), c: q.cols.map(clueRun).join(','), ...extra(s.entries) })
    }
  }
}

const digitList = (v: string | undefined, max: number, count: number): number[] | null => {
  if (v === undefined || v === '' || !/^\d{1,3}(,\d{1,3})*$/.test(v)) return null
  const out = v.split(',').map(Number)
  return out.length === count && out.every((x) => x <= max) ? out : null
}

/** Rows and columns from four digits, when they are within a bound. */
function readDims(p: string | undefined, maxRows: number, maxCols: number): { rows: number; cols: number } | null {
  if (p === undefined || !/^\d{4}$/.test(p)) return null
  const rows = Number(p.slice(0, 2))
  const cols = Number(p.slice(2))
  return rows >= 3 && cols >= 3 && rows <= maxRows && cols <= maxCols ? { rows, cols } : null
}

function decodeCrossmath(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const size = readDims(m.get('p'), 13, 13)
  const k = m.get('k')
  const y = m.get('y')
  if (!isLevel(d) || !size || k === undefined || y === undefined || !/^[vnoe]+$/.test(k) || !/^[asmd]*$/.test(y)) return null
  const { rows, cols } = size
  if (k.length !== rows * cols) return null
  const kind = [...k].map((c) => LETTER_KIND[c])
  const nums = kind.flatMap((x, i) => (x === 'num' ? [i] : []))
  if (kind.filter((x) => x === 'op').length !== y.length || nums.length === 0 || nums.length > 60) return null
  const symbol: string[] = []
  let at = 0
  kind.forEach((x) => symbol.push(x === 'op' ? LETTER_SIGN[y[at++]] : x === 'eq' ? '=' : ''))
  const equations: Equation[] = []
  for (const dir of ['across', 'down'] as const) {
    const step = dir === 'across' ? 1 : cols
    for (let i = 0; i < rows * cols; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      if (dir === 'across' ? c + 4 >= cols : r + 4 >= rows) continue
      if (['num', 'op', 'num', 'eq', 'num'].every((want, j) => kind[i + j * step] === want)) equations.push({ a: i, b: i + 2 * step, c: i + 4 * step, sign: symbol[i + step] as Sign, dir })
    }
  }
  if (equations.length === 0 || equations.length > 40) return null
  const values = digitList(m.get('v'), 99, nums.length)
  if (!values) return null
  const start = Array<number>(rows * cols).fill(0)
  nums.forEach((i, j) => { start[i] = values[j] })
  const blanks = nums.filter((i) => start[i] === 0)
  const tray = blanks.length === 0 ? [] : digitList(m.get('t'), 99, blanks.length)
  if (!tray || tray.some((x) => x < 1) || nums.some((i) => start[i] > 0 && start[i] < 1)) return null
  tray.sort((a, b) => a - b)
  const solved = logicSolveCrossmath({ equations, kind, tray }, start, CROSSMATH_LEVELS.expert.techniques)
  if (!solved || !isCrossmathSolved({ equations, kind }, solved)) return null
  if (blanks.map((i) => solved[i]).sort((a, b) => a - b).join(',') !== tray.join(',')) return null
  const entries = Array<number>(rows * cols).fill(0)
  if (m.has('e')) {
    const e = digitList(m.get('e'), 99, blanks.length)
    if (!e) return null
    blanks.forEach((i, j) => { entries[i] = e[j] })
  }
  return { game: 'crossmath', puzzle: { difficulty: d, rows, cols, kind, symbol, solution: solved, start, equations, tray }, entries, notes: [] }
}

function decodeKakuro(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  const w = m.get('w')
  const sums = m.get('s')
  if (!isLevel(d) || p === undefined || w === undefined || sums === undefined || !/^[0-9]+$/.test(p) || !/^[01]+$/.test(w)) return null
  const n = sizeOf(p.length, Object.values(KAKURO_LEVELS).map((l) => l.size))
  if (n === null || w.length !== p.length) return null
  const white = [...w].map((c) => c === '1')
  const puzzle = [...p].map(Number)
  if (puzzle.some((g, i) => g !== 0 && !white[i])) return null
  const shape = kakuroRuns(white, n, Array(n * n).fill(0))
  const list = digitList(sums, 45, shape.length)
  if (!list || list.some((x) => x < 3)) return null
  const runs = shape.map((r, k) => ({ ...r, sum: list[k] }))
  const solution = logicSolveKakuro(puzzle, n, runs)
  if (white.some((x, i) => x && solution[i] === 0) || kakuroConflicts(solution, runs).size > 0) return null
  if (runs.some((r) => r.cells.reduce((a, i) => a + solution[i], 0) !== r.sum || new Set(r.cells.map((i) => solution[i])).size !== r.cells.length)) return null
  const entries = readGridEntries(m, p.length, 9, (i) => !white[i] || puzzle[i] !== 0)
  if (!entries) return null
  return { game: 'kakuro', puzzle: { size: n, difficulty: d, white, puzzle, solution, runs }, entries, notes: [] }
}

function decodeSlitherlink(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  if (!isLevel(d) || p === undefined || !/^[0-4]+$/.test(p)) return null
  const n = sizeOf(p.length, Object.values(SLITHER_LEVELS).map((l) => l.size))
  if (n === null) return null
  const clues = [...p].map((c) => (c === '4' ? NONE : Number(c)))
  const solution = logicSolveSlither(clues, Array(edgeCount(n)).fill(SL_BLANK), n)
  if (solution.some((v) => v === SL_BLANK) || !isSlitherSolved(clues, solution, n)) return null
  const entries = readGridEntries(m, edgeCount(n), 2, () => false)
  if (!entries) return null
  return { game: 'slitherlink', puzzle: { size: n, difficulty: d, clues, solution }, entries, notes: [] }
}

function decodeNurikabe(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  if (!isLevel(d)) return null
  const size = readDims(m.get('p'), 12, 12)
  const level = size && Object.values(NURIKABE_LEVELS).find((l) => l.rows === size.rows && l.cols === size.cols)
  if (!size || !level) return null
  const total = size.rows * size.cols
  const iRaw = m.get('i')
  if (iRaw === undefined || !/^\d{1,3}(,\d{1,3})*$/.test(iRaw)) return null
  const at = iRaw.split(',').map(Number)
  const sizes = digitList(m.get('v'), total, at.length)
  if (!sizes || new Set(at).size !== at.length || at.some((i) => i >= total) || sizes.some((v) => v < 1)) return null
  const clues = Array<number>(total).fill(0)
  at.forEach((i, j) => { clues[i] = sizes[j] })
  const done = logicSolveNurikabe(clues, Array(total).fill(NK_BLANK), size.rows, size.cols, level.split)
  const solution = done.map((v) => (v === WALL ? 1 : 0))
  if (done.some((v, i) => v === NK_BLANK && clues[i] === 0) || !isValidNurikabe(clues, solution, size.rows, size.cols)) return null
  const entries = readGridEntries(m, total, 2, () => false)
  if (!entries) return null
  return { game: 'nurikabe', puzzle: { rows: size.rows, cols: size.cols, difficulty: d, clues, solution }, entries, notes: [] }
}

function decodeHashi(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  if (!isLevel(d)) return null
  const size = readDims(m.get('p'), 15, 15)
  if (!size || !Object.values(HASHI_LEVELS).some((l) => l.rows === size.rows && l.cols === size.cols)) return null
  const { rows, cols } = size
  const v = m.get('v')
  const iRaw = m.get('i')
  if (v === undefined || iRaw === undefined || !/^[1-8]+$/.test(v) || !/^\d{1,3}(,\d{1,3})*$/.test(iRaw)) return null
  const at = iRaw.split(',').map(Number)
  if (at.length !== v.length || at.length < 2 || at.length > 60 || new Set(at).size !== at.length || at.some((i) => i >= rows * cols)) return null
  const islands: Island[] = at.map((i, j) => ({ r: Math.floor(i / cols), c: i % cols, n: Number(v[j]) }))
  const links = buildLinks(islands)
  const crosses = crossingsOf(islands, links)
  const solution = solveByLogic({ islands, links, crosses })
  if (!solution) return null
  const entries = readGridEntries(m, links.length, 2, () => false)
  if (!entries || entries.some((x, i) => x > links[i].cap)) return null
  return { game: 'hashi', puzzle: { difficulty: d, rows, cols, islands, links, crosses, solution }, entries, notes: [] }
}

function decodeNonogram(m: Map<string, string>): SharedGame | null {
  const d = m.get('d')
  const p = m.get('p')
  if (!isLevel(d) || p === undefined || !/^\d{1,2}$/.test(p)) return null
  const n = Number(p)
  if (!Object.values(NONOGRAM_LEVELS).some((l) => l.size === n)) return null
  const readLines = (raw: string | undefined): number[][] | null => {
    if (raw === undefined) return null
    const lines = raw.split(',')
    if (lines.length !== n || !lines.every((l) => /^[0-9a-f]+$/.test(l))) return null
    const out = lines.map((l) => (l === '0' ? [] : [...l].map((c) => parseInt(c, 16))))
    return out.every((r) => r.every((x) => x >= 1 && x <= n) && r.reduce((a, b) => a + b, 0) + r.length - 1 <= n) ? out : null
  }
  const rows = readLines(m.get('r'))
  const cols = readLines(m.get('c'))
  if (!rows || !cols) return null
  const done = solveNonogram(rows, cols)
  if (!done || done.some((v) => v === EMPTY)) return null
  const solution = done.map((v) => (v === FILLED ? 1 : 0))
  const check = cluesOf(solution, n)
  if (JSON.stringify(check.rows) !== JSON.stringify(rows) || JSON.stringify(check.cols) !== JSON.stringify(cols)) return null
  const entries = readGridEntries(m, n * n, 2, () => false)
  if (!entries) return null
  return { game: 'nonogram', puzzle: { difficulty: d, size: n, solution, rows, cols }, entries, notes: [] }
}

/** The puzzle in some text for a game, or null when the text is not a solvable puzzle of that game. Never throws. */
export function decodeGame(game: string, data: string): SharedGame | null {
  try {
    if (!isShareableGame(game)) return null
    const m = pairs(data)
    if (!m) return null
    if (game === 'binairo') return decodeBinairo(m)
    if (game === 'futoshiki') return decodeFutoshiki(m)
    if (game === 'kenken') return decodeKenKen(m)
    if (game === 'hitori') return decodeHitori(m)
    if (game === 'crossmath') return decodeCrossmath(m)
    if (game === 'kakuro') return decodeKakuro(m)
    if (game === 'slitherlink') return decodeSlitherlink(m)
    if (game === 'nurikabe') return decodeNurikabe(m)
    if (game === 'hashi') return decodeHashi(m)
    if (game === 'nonogram') return decodeNonogram(m)
    return decodeSudoku(game, m)
  } catch {
    return null
  }
}

/** Which of the two a recipient gets: the clues alone, or the board so far. */
export const startOnly = (s: SharedGame): SharedGame => ({ ...s, entries: s.entries.map(() => 0), notes: s.notes.map(() => 0) })
