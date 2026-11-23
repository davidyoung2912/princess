import { CODEWORD_WORDS } from './codewordWords'
import { shuffle, type Difficulty } from './sudoku'
import { WORD_SEARCH_ANSWERS, WORD_SEARCH_WORDS } from './wordSearchWords'

/**
 * Word Search with no spare letters: every square of the grid belongs to a word on the list, except a few that spell a hidden answer.
 * Words run in up to eight directions and cross each other. Find every listed word and the squares left unmarked, read left to right and
 * top to bottom, spell the answer. Framework-free so it can be tested in node.
 */

/** Row and column steps: right, left, down, up, down-right, up-left, up-right, down-left. */
export const DIRS: readonly (readonly [number, number])[] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1]]

/** Grid size, answer length, how many of DIRS are used, and the longest word. */
export const WORD_SEARCH_LEVELS: Record<Difficulty, { size: number; answer: number; dirs: number; maxLen: number }> = {
  easy: { size: 6, answer: 5, dirs: 4, maxLen: 5 },
  medium: { size: 8, answer: 6, dirs: 6, maxLen: 6 },
  hard: { size: 10, answer: 7, dirs: 8, maxLen: 8 },
  expert: { size: 12, answer: 8, dirs: 8, maxLen: 10 },
}

/** The direction order that fills DIRS in: easy uses right, down, down-right and left; harder levels add the rest. */
const DIR_ORDER = [0, 2, 4, 1, 3, 6, 5, 7]

export interface PlacedWord { text: string; cells: number[] }

export interface WordSearch {
  size: number
  difficulty: Difficulty
  /** One upper case letter per square. */
  letters: string[]
  /** The listed words, alphabetical, each with the squares it was placed on. */
  words: PlacedWord[]
  answer: string
  /** The answer's squares in reading order; they hold the answer's letters in order. */
  answerCells: number[]
}

/** The squares on the straight line from a to b (any of the eight directions), or null when they are not in line. */
export function lineBetween(n: number, a: number, b: number): number[] | null {
  const dr = Math.floor(b / n) - Math.floor(a / n)
  const dc = (b % n) - (a % n)
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null
  const len = Math.max(Math.abs(dr), Math.abs(dc))
  const sr = Math.sign(dr)
  const sc = Math.sign(dc)
  return Array.from({ length: len + 1 }, (_, k) => a + k * (sr * n + sc))
}

const textOf = (g: Pick<WordSearch, 'letters'>, cells: readonly number[]) => cells.map((i) => g.letters[i]).join('')

/** The index of an unfound listed word that these squares spell, forwards or backwards; -1 when none. */
export function matchWord(g: WordSearch, cells: readonly number[], found: ReadonlySet<number>): number {
  const text = textOf(g, cells)
  const back = [...text].reverse().join('')
  return g.words.findIndex((w, k) => !found.has(k) && (w.text === text || w.text === back))
}

export const isWordSearchSolved = (g: WordSearch, found: ReadonlySet<number>): boolean => found.size === g.words.length

/** The next word to point out: the first unfound word in the list. Null when all are found. */
export function nextWordHint(g: WordSearch, found: ReadonlySet<number>): { word: number; cell: number; dir: number } | null {
  const k = g.words.findIndex((_, i) => !found.has(i))
  if (k < 0) return null
  const [a, b] = g.words[k].cells
  const step = b - a
  const dir = DIRS.findIndex(([dr, dc]) => dr * g.size + dc === step)
  return { word: k, cell: a, dir }
}

/** Every line of squares in the grid that spells `text` (either way round), as square lists. */
export function occurrences(n: number, letters: readonly string[], text: string): number[][] {
  const out: number[][] = []
  for (let i = 0; i < n * n; i++) {
    for (const [dr, dc] of DIRS) {
      const r1 = Math.floor(i / n) + dr * (text.length - 1)
      const c1 = (i % n) + dc * (text.length - 1)
      if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue
      const cells = Array.from({ length: text.length }, (_, k) => i + k * (dr * n + dc))
      if (cells.every((c, k) => letters[c] === text[k])) out.push(cells)
    }
  }
  return out
}

/** Pack words so that every square outside `blocked` is covered. Null when the step budget runs out. */
function pack(n: number, blocked: ReadonlySet<number>, level: { dirs: number; maxLen: number }, answer: string, random: () => number, budget: number): { letters: string[]; words: PlacedWord[] } | null {
  const dirs = DIR_ORDER.slice(0, level.dirs).map((d) => DIRS[d])
  const themed = shuffle(WORD_SEARCH_WORDS.filter((w) => w.length >= 3 && w.length <= Math.min(level.maxLen, n) && w !== answer), random)
  const common = shuffle(CODEWORD_WORDS.filter((w) => w.length >= 4 && w.length <= level.maxLen && w !== answer), random).slice(0, 250)
  const pool = [...themed, ...common]
  const letters = Array<string>(n * n).fill('')
  const covered = Array<boolean>(n * n).fill(false)
  blocked.forEach((i) => { covered[i] = true })
  const used = new Set<string>()
  const placed: PlacedWord[] = []
  let steps = 0

  const search = (): boolean => {
    const u = covered.indexOf(false)
    if (u < 0) return true
    if (++steps > budget) return false
    const options: { word: string; cells: number[]; fresh: number }[] = []
    for (const word of pool) {
      if (used.has(word)) continue
      for (const [dr, dc] of dirs) {
        for (let k = 0; k < word.length; k++) {
          const r0 = Math.floor(u / n) - dr * k
          const c0 = (u % n) - dc * k
          const r1 = r0 + dr * (word.length - 1)
          const c1 = c0 + dc * (word.length - 1)
          if (r0 < 0 || r0 >= n || c0 < 0 || c0 >= n || r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue
          const cells = Array.from({ length: word.length }, (_, j) => (r0 + dr * j) * n + c0 + dc * j)
          if (cells.some((c, j) => blocked.has(c) || (letters[c] !== '' && letters[c] !== word[j]))) continue
          options.push({ word, cells, fresh: cells.filter((c) => !covered[c]).length })
        }
      }
      if (options.length >= 60) break
    }
    options.sort((a, b) => b.fresh - a.fresh || random() - 0.5)
    for (const o of options.slice(0, 24)) {
      const before = o.cells.map((c) => [c, letters[c], covered[c]] as const)
      o.cells.forEach((c, j) => { letters[c] = o.word[j]; covered[c] = true })
      used.add(o.word)
      placed.push({ text: o.word, cells: o.cells })
      if (search()) return true
      placed.pop()
      used.delete(o.word)
      for (const [c, l, v] of before) { letters[c] = l; covered[c] = v }
      if (steps > budget) return false
    }
    return false
  }
  return search() ? { letters, words: placed } : null
}

/** A new puzzle at a level. Retries layouts until one packs, and rejects any where a listed word also hides over an answer square. */
export function generateWordSearch(level: Difficulty, random: () => number = Math.random): WordSearch {
  const cfg = WORD_SEARCH_LEVELS[level]
  const n = cfg.size
  const answers = WORD_SEARCH_ANSWERS[cfg.answer]
  for (let attempt = 0; attempt < 400; attempt++) {
    const answer = answers[Math.floor(random() * answers.length)]
    const answerCells = shuffle(Array.from({ length: n * n }, (_, i) => i), random).slice(0, cfg.answer).sort((a, b) => a - b)
    const packed = pack(n, new Set(answerCells), cfg, answer, random, 250)
    if (!packed) continue
    const letters = packed.letters
    answerCells.forEach((c, k) => { letters[c] = answer[k] })
    const clean = packed.words.every((w) => occurrences(n, letters, w.text).every((cells) => !cells.some((c) => answerCells.includes(c))))
    if (!clean) continue
    return { size: n, difficulty: level, letters, words: [...packed.words].sort((a, b) => a.text.localeCompare(b.text)), answer, answerCells }
  }
  throw new Error('Word Search: no layout found')
}
