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

export type ShareMode = 'start' | 'current'

/** The games that can be sent so far (the catalogue ids). */
export const SHAREABLE_GAMES = ['sudoku', 'diagonal-sudoku', 'jigsaw-sudoku', 'killer-sudoku', 'binairo', 'futoshiki', 'kenken', 'hitori'] as const
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
    return decodeSudoku(game, m)
  } catch {
    return null
  }
}

/** Which of the two a recipient gets: the clues alone, or the board so far. */
export const startOnly = (s: SharedGame): SharedGame => ({ ...s, entries: s.entries.map(() => 0), notes: s.notes.map(() => 0) })
