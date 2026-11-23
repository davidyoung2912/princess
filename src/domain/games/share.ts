/**
 * Games in a chat (docs/chat-bundles-plan.md, phase B8): a puzzle as a short piece of plain text and back. Framework-free.
 * The puzzle travels as its clues (never the solution): the receiver's own solver rebuilds the answer and returns null when the text is not a
 * solvable puzzle of that game, so nothing here trusts the sender. `decode` is total (it never throws) and bounded (a search has a node budget).
 * Text is `key=value` pairs joined by `;` using only letters, digits, `=`, `;` and `,` so it can pass the server's allow-list unchanged.
 */
import { connected, makeRules, neighbours, solveUniqueWithin, CLASSIC, DIAGONAL, DIFFICULTIES, type Cage, type Difficulty, type Puzzle } from './sudoku'
import { logicSolve, killerConflicts } from './killer'
import { BINAIRO_LEVELS, isValidBinairo, logicSolveBinairo, type BinairoPuzzle } from './binairo'

export type ShareMode = 'start' | 'current'

/** The games that can be sent so far (the catalogue ids). */
export const SHAREABLE_GAMES = ['sudoku', 'diagonal-sudoku', 'jigsaw-sudoku', 'killer-sudoku', 'binairo'] as const
export type ShareableGame = (typeof SHAREABLE_GAMES)[number]
export const isShareableGame = (id: string): id is ShareableGame => (SHAREABLE_GAMES as readonly string[]).includes(id)

/** The most a payload may hold; mirrors the server. */
export const GAME_DATA_MAX = 4000
export const GAME_DATA_CHARS = /^[A-Za-z0-9=;,]+$/

/** A puzzle as it stands: for Sudoku `entries` are the digits placed by the player and `notes` the pencil marks (one 9-bit mask per cell); for Binairo only `entries`. */
export type SharedGame =
  | { game: Exclude<ShareableGame, 'binairo'>; puzzle: Puzzle; entries: number[]; notes: number[] }
  | { game: 'binairo'; puzzle: BinairoPuzzle; entries: number[]; notes: number[] }

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

function decodeSudoku(game: Exclude<ShareableGame, 'binairo'>, m: Map<string, string>): SharedGame | null {
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

/** The puzzle in some text for a game, or null when the text is not a solvable puzzle of that game. Never throws. */
export function decodeGame(game: string, data: string): SharedGame | null {
  try {
    if (!isShareableGame(game)) return null
    const m = pairs(data)
    if (!m) return null
    return game === 'binairo' ? decodeBinairo(m) : decodeSudoku(game, m)
  } catch {
    return null
  }
}

/** Which of the two a recipient gets: the clues alone, or the board so far. */
export const startOnly = (s: SharedGame): SharedGame => ({ ...s, entries: s.entries.map(() => 0), notes: s.notes.map(() => 0) })
