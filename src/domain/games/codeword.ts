import { CODEWORD_WORDS } from './codewordWords'
import { shuffle, type Difficulty } from './sudoku'

/**
 * Codeword: a crossword grid with no clues where every square holds a number from 1 to 26 and each number stands for one letter.
 * A few letters are given. The rest are worked out from the words they spell. Letters are 1 (A) to 26 (Z), numbers 1 to 26, and 0 means
 * "none". Words come only from the compact list in `codewordWords.ts`. Framework-free so it can be tested in node.
 */

export interface CSlot { cells: readonly number[]; across: boolean }

/** Grid size, the longest word, the share of black squares, how many different letters the grid must use, and how many letters stay given (at least, and at most). */
export const CODEWORD_LEVELS: Record<Difficulty, { size: number; maxRun: number; density: number; minLetters: number; minGivens: number; maxGivens: number }> = {
  easy: { size: 7, maxRun: 5, density: 0.2, minLetters: 14, minGivens: 10, maxGivens: 16 },
  medium: { size: 9, maxRun: 5, density: 0.3, minLetters: 16, minGivens: 7, maxGivens: 12 },
  hard: { size: 11, maxRun: 5, density: 0.32, minLetters: 18, minGivens: 5, maxGivens: 10 },
  expert: { size: 13, maxRun: 7, density: 0.36, minLetters: 19, minGivens: 3, maxGivens: 9 },
}

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const letterChar = (l: number): string => ALPHABET[l - 1] ?? ''
const lbit = (l: number) => 1 << (l - 1)
const ANY = (1 << 26) - 1
const count = (mask: number) => { let n = 0; for (let m = mask; m; m &= m - 1) n++; return n }
const letterOf = (mask: number) => 32 - Math.clz32(mask) // the letter of a one-bit mask

interface Word { text: string; letters: number[] }

let byLength: Map<number, Word[]> | null = null
/** The word list, split by length with each word as letter numbers. */
function wordsOfLength(len: number): Word[] {
  if (!byLength) {
    byLength = new Map()
    for (const text of CODEWORD_WORDS) {
      const list = byLength.get(text.length) ?? []
      list.push({ text, letters: [...text].map((ch) => ALPHABET.indexOf(ch) + 1) })
      byLength.set(text.length, list)
    }
  }
  return byLength.get(len) ?? []
}

/** Maximal lines of at least two white squares, across then down. */
export function slotsOf(white: readonly boolean[], n: number): CSlot[] {
  const out: CSlot[] = []
  for (const across of [true, false]) {
    for (let a = 0; a < n; a++) {
      let run: number[] = []
      for (let b = 0; b <= n; b++) {
        const i = b < n ? (across ? a * n + b : b * n + a) : -1
        if (i >= 0 && white[i]) run.push(i)
        else { if (run.length >= 2) out.push({ cells: run, across }); run = [] }
      }
    }
  }
  return out
}

const neighbours = (i: number, n: number): number[] => {
  const r = Math.floor(i / n)
  const c = i % n
  return [...(r > 0 ? [i - n] : []), ...(r < n - 1 ? [i + n] : []), ...(c > 0 ? [i - 1] : []), ...(c < n - 1 ? [i + 1] : [])]
}

/** A layout is usable when every white square is in a word of two or more squares, all white squares join up, and no word is longer than `maxRun`. */
function layoutProblems(white: readonly boolean[], n: number, maxRun: number): { tooLong: CSlot[]; ok: boolean } {
  const slots = slotsOf(white, n)
  const inWord = new Set(slots.flatMap((s) => s.cells))
  const whites = white.flatMap((w, i) => (w ? [i] : []))
  const alone = whites.some((i) => !inWord.has(i))
  const seen = new Set<number>([whites[0]])
  const stack = [whites[0]]
  while (stack.length) for (const j of neighbours(stack.pop() as number, n)) if (white[j] && !seen.has(j)) { seen.add(j); stack.push(j) }
  return { tooLong: slots.filter((s) => s.cells.length > maxRun), ok: !alone && seen.size === whites.length }
}

/** A random layout with the black squares turned half a turn onto each other, no word longer than `maxRun`. Null when it gets stuck. */
export function makeLayout(n: number, maxRun: number, random: () => number, density = 0.2): boolean[] | null {
  const total = n * n
  const white = Array<boolean>(total).fill(true)
  const target = Math.round(total * density)
  const block = (i: number): boolean => {
    const j = total - 1 - i
    if (!white[i] || (i !== j && !white[j])) return false
    white[i] = false
    white[j] = false
    if (layoutProblems(white, n, maxRun).ok) return true
    white[i] = true
    white[j] = true
    return false
  }
  for (let guard = 0; guard < 400; guard++) {
    const { tooLong } = layoutProblems(white, n, maxRun)
    const blocks = white.filter((w) => !w).length
    if (tooLong.length === 0 && blocks >= target) return white
    const pool = tooLong.length ? shuffle(tooLong.flatMap((s) => s.cells.slice(1, -1)), random) : shuffle(white.map((_, i) => i), random)
    for (const i of pool.slice(0, 24)) if (block(i)) break
  }
  return null
}

/** The slots sharing each square, for filling. */
function crossings(slots: readonly CSlot[], total: number): number[][] {
  const at: number[][] = Array.from({ length: total }, () => [])
  slots.forEach((s, k) => s.cells.forEach((i) => at[i].push(k)))
  return at
}

/** Fill a layout with words from the list, a crossword style search with a step budget. Letters per square, or null. */
export function fillLayout(white: readonly boolean[], n: number, random: () => number, budget = 4000): number[] | null {
  const slots = slotsOf(white, n)
  const at = crossings(slots, n * n)
  const letters = Array<number>(n * n).fill(0)
  const used = new Set<string>()
  const placed = Array<boolean>(slots.length).fill(false)
  let steps = 0
  const fits = (s: CSlot, w: Word) => s.cells.every((i, k) => letters[i] === 0 || letters[i] === w.letters[k]) && !used.has(w.text)
  const domains: Word[][] = slots.map((s) => shuffle(wordsOfLength(s.cells.length), random))

  const search = (domain: Word[][]): boolean => {
    if (++steps > budget) return false
    let best = -1
    for (let k = 0; k < slots.length; k++) {
      if (placed[k]) continue
      if (best < 0 || domain[k].length < domain[best].length) best = k
    }
    if (best < 0) return true
    if (domain[best].length === 0) return false
    const s = slots[best]
    for (const w of domain[best].slice(0, 12)) {
      if (!fits(s, w)) continue
      const before = s.cells.map((i) => letters[i])
      s.cells.forEach((i, k) => { letters[i] = w.letters[k] })
      used.add(w.text)
      placed[best] = true
      const touched = new Set(s.cells.flatMap((i) => at[i]).filter((k) => !placed[k]))
      const next = domain.slice()
      let alive = true
      for (const k of touched) {
        next[k] = domain[k].filter((x) => fits(slots[k], x))
        if (next[k].length === 0) { alive = false; break }
      }
      if (alive && search(next)) return true
      placed[best] = false
      used.delete(w.text)
      s.cells.forEach((i, k) => { letters[i] = before[k] })
      if (steps > budget) return false
    }
    return false
  }
  return search(domains) ? letters : null
}

/** Per slot, the number in each square. */
const numbersOf = (slots: readonly CSlot[], code: readonly number[]): number[][] => slots.map((s) => s.cells.map((i) => code[i]))

// A word fits a slot when every square's number can still stand for the letter there, one number has one letter, and two numbers never share a letter.
const owner = new Int8Array(27)
const holder = new Int8Array(27)
function fits(letters: readonly number[], nums: readonly number[], cand: readonly number[]): boolean {
  let ok = true
  let k = 0
  for (; k < nums.length; k++) {
    const u = nums[k]
    const l = letters[k]
    if (!(cand[u] & lbit(l))) { ok = false; break }
    if (owner[u] === 0) {
      if (holder[l] !== 0) { ok = false; break }
      owner[u] = l
      holder[l] = u
    } else if (owner[u] !== l) { ok = false; break }
  }
  for (let j = 0; j <= Math.min(k, nums.length - 1); j++) { owner[nums[j]] = 0; holder[letters[j]] = 0 }
  return ok
}

/** What logic can work out: the letters each number can still be, as masks, with `live` words per slot. */
interface State { cand: number[]; live: Word[][] }

function startState(slots: readonly CSlot[], known: readonly number[]): State {
  let taken = 0
  for (let u = 1; u <= 26; u++) if (known[u]) taken |= lbit(known[u])
  const cand = Array<number>(27).fill(0)
  for (let u = 1; u <= 26; u++) cand[u] = known[u] ? lbit(known[u]) : ANY & ~taken
  return { cand, live: slots.map((s) => wordsOfLength(s.cells.length)) }
}

/** The step that cleans up after a number gets one letter: no other number may use that letter. Returns false on a contradiction. */
function eliminate(cand: number[], numbers: readonly number[]): { ok: boolean; changed: boolean; single?: number } {
  let changed = false
  let single: number | undefined
  for (let again = true; again;) {
    again = false
    for (const u of numbers) {
      if (count(cand[u]) !== 1) continue
      for (const v of numbers) {
        if (v !== u && cand[v] & cand[u]) {
          cand[v] &= ~cand[u]
          if (cand[v] === 0) return { ok: false, changed }
          changed = true
          again = true
          if (count(cand[v]) === 1 && single === undefined) single = v
        }
      }
    }
  }
  return { ok: true, changed, single }
}

/** Run word-list reasoning to a standstill. False means the letters given cannot work. */
function propagate(slots: readonly CSlot[], nums: readonly number[][], used: readonly number[], st: State): boolean {
  for (let changed = true; changed;) {
    changed = false
    for (let s = 0; s < slots.length; s++) {
      const live = st.live[s].filter((w) => fits(w.letters, nums[s], st.cand))
      if (live.length === 0) return false
      if (live.length !== st.live[s].length) st.live[s] = live
      const allowed = new Map<number, number>()
      for (const w of live) nums[s].forEach((u, k) => allowed.set(u, (allowed.get(u) ?? 0) | lbit(w.letters[k])))
      for (const [u, m] of allowed) {
        const c = st.cand[u] & m
        if (c === 0) return false
        if (c !== st.cand[u]) { st.cand[u] = c; changed = true }
      }
    }
    const e = eliminate(st.cand, used)
    if (!e.ok) return false
    if (e.changed) changed = true
  }
  return true
}

/** The letters logic alone reaches from the given ones: a letter per number, 0 where it is still open. Null when contradictory. */
export function logicSolveCodeword(slots: readonly CSlot[], code: readonly number[], known: readonly number[]): number[] | null {
  const nums = numbersOf(slots, code)
  const used = [...new Set(code.filter((u) => u > 0))]
  const st = startState(slots, known)
  if (!propagate(slots, nums, used, st)) return null
  return Array.from({ length: 27 }, (_, u) => (u > 0 && used.includes(u) && count(st.cand[u]) === 1 ? letterOf(st.cand[u]) : 0))
}

export interface CodewordPuzzle {
  size: number
  difficulty: Difficulty
  /** Which squares are white. */
  white: boolean[]
  /** The number (1 to 26) in each white square, 0 in a black one. */
  code: number[]
  slots: CSlot[]
  /** The numbers in the grid, ascending. */
  used: number[]
  /** The letter each number stands for (index 0 unused, 0 for a number not in the grid). */
  solution: number[]
  /** The numbers whose letters are shown from the start. */
  givens: number[]
}

const knownFrom = (givens: readonly number[], solution: readonly number[]): number[] => {
  const known = Array<number>(27).fill(0)
  for (const u of givens) known[u] = solution[u]
  return known
}

/** True when only the given letters, with the word list, are enough to work out everything. */
const solvesWith = (slots: readonly CSlot[], code: readonly number[], used: readonly number[], solution: readonly number[], givens: readonly number[]): boolean => {
  const got = logicSolveCodeword(slots, code, knownFrom(givens, solution))
  return got !== null && used.every((u) => got[u] === solution[u])
}

/** Build a puzzle: a filled grid, a random letter for each number, then as few given letters as logic needs (but at least the level's minimum). */
export function generateCodeword(difficulty: Difficulty, random: () => number = Math.random): CodewordPuzzle {
  const cfg = CODEWORD_LEVELS[difficulty]
  const n = cfg.size
  for (;;) {
    const white = makeLayout(n, cfg.maxRun, random, cfg.density)
    if (!white) continue
    const letters = fillLayout(white, n, random)
    if (!letters) continue
    const present = [...new Set(letters.filter((l) => l > 0))]
    if (present.length < cfg.minLetters) continue
    const slots = slotsOf(white, n)
    // Each letter gets a random number from 1 to 26.
    const numberOf = Array<number>(27).fill(0)
    shuffle(Array.from({ length: 26 }, (_, k) => k + 1), random).forEach((u, k) => { numberOf[k + 1] = u })
    const code = letters.map((l) => (l ? numberOf[l] : 0))
    const solution = Array<number>(27).fill(0)
    for (let l = 1; l <= 26; l++) if (present.includes(l)) solution[numberOf[l]] = l
    const used = [...new Set(code.filter((u) => u > 0))].sort((a, b) => a - b)
    const freq = (u: number) => code.filter((x) => x === u).length

    // Reveal the most common unsolved number until logic finishes, then take back any reveal that is not needed.
    const givens: number[] = []
    while (!solvesWith(slots, code, used, solution, givens)) {
      const got = logicSolveCodeword(slots, code, knownFrom(givens, solution)) ?? []
      const open = used.filter((u) => !givens.includes(u) && got[u] !== solution[u])
      const pick = (open.length ? open : used.filter((u) => !givens.includes(u))).sort((a, b) => freq(b) - freq(a) || random() - 0.5)[0]
      givens.push(pick)
      if (givens.length > cfg.maxGivens + 6) break
    }
    if (!solvesWith(slots, code, used, solution, givens)) continue
    for (const u of shuffle(givens, random)) {
      if (givens.length <= cfg.minGivens) break
      const rest = givens.filter((g) => g !== u)
      if (solvesWith(slots, code, used, solution, rest)) givens.splice(0, givens.length, ...rest)
    }
    // Pad with common letters on the easier levels.
    for (const u of [...used].sort((a, b) => freq(b) - freq(a) || random() - 0.5)) {
      if (givens.length >= cfg.minGivens) break
      if (!givens.includes(u)) givens.push(u)
    }
    if (givens.length > cfg.maxGivens) continue
    return { size: n, difficulty, white, code, slots, used, solution, givens: givens.sort((a, b) => a - b) }
  }
}

/** The letter shown for each number right now: the given ones and the player's own entries. */
export function knownLetters(p: CodewordPuzzle, entries: readonly number[]): number[] {
  const known = Array<number>(27).fill(0)
  for (const u of p.used) known[u] = p.givens.includes(u) ? p.solution[u] : (entries[u] ?? 0)
  return known
}

/** Numbers that break a rule: two numbers holding the same letter. */
export function codewordConflicts(p: CodewordPuzzle, entries: readonly number[]): Set<number> {
  const known = knownLetters(p, entries)
  const bad = new Set<number>()
  for (const u of p.used) if (known[u] && p.used.some((v) => v !== u && known[v] === known[u])) bad.add(u)
  return bad
}

export const isCodewordSolved = (p: CodewordPuzzle, entries: readonly number[]): boolean => {
  const known = knownLetters(p, entries)
  return p.used.every((u) => known[u] === p.solution[u])
}

export type CodewordTechnique = 'word' | 'cross' | 'deep'
export interface CodewordMove {
  technique: CodewordTechnique
  /** The word that gives the move away (null for a "deep" step that works across the whole grid). */
  slot: number | null
  fills: { num: number; letter: number }[]
  /** The words that fit the slot, up to four. */
  words: string[]
}

export type CodewordHint =
  | { kind: 'mistake'; nums: number[] }
  | { kind: 'move'; move: CodewordMove }
  | { kind: 'reveal'; num: number; letter: number }

/** The word a slot spells so far, with an underscore for each number still open. */
export const patternOf = (p: CodewordPuzzle, slot: number, known: readonly number[]): string =>
  p.slots[slot].cells.map((i) => (known[p.code[i]] ? letterChar(known[p.code[i]]) : '_')).join(' ')

/** The next move that logic gives from what is known: a slot with one word that fits, then a number the fitting words pin down, then a deeper step. */
export function findCodewordMove(p: CodewordPuzzle, known: readonly number[]): CodewordMove | null {
  const nums = numbersOf(p.slots, p.code)
  const open = (s: number) => [...new Set(nums[s].filter((u) => !known[u]))]
  const base = startState(p.slots, known)

  // 1. A word that is the only one that fits.
  let best: { s: number; word: Word } | null = null
  p.slots.forEach((_, s) => {
    const o = open(s)
    if (o.length === 0 || (best && open(best.s).length <= o.length)) return
    const live = base.live[s].filter((w) => fits(w.letters, nums[s], base.cand))
    if (live.length === 1) best = { s, word: live[0] }
  })
  const one = best as { s: number; word: Word } | null
  if (one) return { technique: 'word', slot: one.s, words: [one.word.text], fills: open(one.s).map((u) => ({ num: u, letter: one.word.letters[nums[one.s].indexOf(u)] })) }

  // 2. Words that fit leave one letter for a number, then 3. letters used up elsewhere leave one.
  const st = startState(p.slots, known)
  const used = p.used
  for (let changed = true; changed;) {
    changed = false
    for (let s = 0; s < p.slots.length; s++) {
      const live = st.live[s].filter((w) => fits(w.letters, nums[s], st.cand))
      if (live.length === 0) return null
      st.live[s] = live
      const allowed = new Map<number, number>()
      for (const w of live) nums[s].forEach((u, k) => allowed.set(u, (allowed.get(u) ?? 0) | lbit(w.letters[k])))
      for (const [u, m] of allowed) {
        const c = st.cand[u] & m
        if (c === 0) return null
        if (c === st.cand[u]) continue
        const wasOpen = count(st.cand[u]) > 1
        st.cand[u] = c
        changed = true
        if (wasOpen && count(c) === 1 && !known[u]) return { technique: 'cross', slot: s, words: live.slice(0, 4).map((w) => w.text), fills: [{ num: u, letter: letterOf(c) }] }
      }
    }
    const e = eliminate(st.cand, used)
    if (!e.ok) return null
    if (e.single !== undefined && !known[e.single]) return { technique: 'deep', slot: null, words: [], fills: [{ num: e.single, letter: letterOf(st.cand[e.single]) }] }
    if (e.changed) changed = true
  }
  return null
}

/** The next helpful step: wrong letters first, then the next logical move with its reason, then (rarely) a plain reveal. */
export function nextCodewordHint(p: CodewordPuzzle, entries: readonly number[]): CodewordHint | null {
  const wrong = p.used.filter((u) => !p.givens.includes(u) && entries[u] && entries[u] !== p.solution[u])
  if (wrong.length) return { kind: 'mistake', nums: wrong }
  const known = knownLetters(p, entries)
  const left = p.used.filter((u) => !known[u])
  if (left.length === 0) return null
  const move = findCodewordMove(p, known)
  if (!move) return { kind: 'reveal', num: left[0], letter: p.solution[left[0]] }
  return { kind: 'move', move }
}
