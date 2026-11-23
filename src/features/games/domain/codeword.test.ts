import { describe, expect, it } from 'vitest'
import { CODEWORD_LEVELS, codewordConflicts, generateCodeword, isCodewordSolved, knownLetters, letterChar, logicSolveCodeword, nextCodewordHint, patternOf, slotsOf } from './codeword'
import { CODEWORD_WORDS } from './codewordWords'
import type { Difficulty } from './sudoku'

/** A small seeded random so a failure can be repeated. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(CODEWORD_LEVELS) as Difficulty[]
const WORDS = new Set(CODEWORD_WORDS)

describe('Codeword word list', () => {
  it('holds upper case words of 2 to 7 letters with no repeats', () => {
    expect(new Set(CODEWORD_WORDS).size).toBe(CODEWORD_WORDS.length)
    for (const w of CODEWORD_WORDS) { expect(w).toMatch(/^[A-Z]{2,7}$/) }
    expect(CODEWORD_WORDS.length).toBeGreaterThan(1000)
  })
})

describe('Codeword', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles that the word list and the given letters solve to one answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateCodeword(level, seeded(seed * 13 + level.length))
        const cfg = CODEWORD_LEVELS[level]
        expect(p.size).toBe(cfg.size)
        expect(p.used.length).toBeGreaterThanOrEqual(cfg.minLetters)
        expect(p.givens.length).toBeGreaterThanOrEqual(cfg.minGivens)
        expect(p.givens.length).toBeLessThanOrEqual(cfg.maxGivens)
        // Every white square has a number, black squares have none, and one number is one letter.
        p.white.forEach((w, i) => expect(p.code[i] > 0).toBe(w))
        expect(new Set(p.used.map((u) => p.solution[u])).size).toBe(p.used.length)
        // Every word is in the list, and no word repeats.
        const spelled = p.slots.map((s) => s.cells.map((i) => letterChar(p.solution[p.code[i]])).join(''))
        spelled.forEach((w) => expect(WORDS.has(w)).toBe(true))
        expect(new Set(spelled).size).toBe(spelled.length)
        expect(slotsOf(p.white, p.size)).toEqual(p.slots)
        // Logic from the given letters reaches the answer.
        const known = Array<number>(27).fill(0)
        for (const u of p.givens) known[u] = p.solution[u]
        const got = logicSolveCodeword(p.slots, p.code, known)
        expect(p.used.every((u) => got?.[u] === p.solution[u])).toBe(true)
      }
    })
  }

  it('walks a whole puzzle to the end by following hints, without a plain reveal', () => {
    const p = generateCodeword('medium', seeded(5))
    const entries = Array<number>(27).fill(0)
    let guard = 0
    while (!isCodewordSolved(p, entries) && guard++ < 40) {
      const h = nextCodewordHint(p, entries)
      expect(h).not.toBeNull()
      if (!h) break
      expect(h.kind).toBe('move')
      if (h.kind !== 'move') break
      expect(h.move.fills.length).toBeGreaterThan(0)
      for (const f of h.move.fills) { expect(f.letter).toBe(p.solution[f.num]); entries[f.num] = f.letter }
      if (h.move.technique === 'word') expect(h.move.words).toHaveLength(1)
    }
    expect(isCodewordSolved(p, entries)).toBe(true)
  })

  it('points at wrong letters first and flags a letter used for two numbers', () => {
    const p = generateCodeword('easy', seeded(9))
    const entries = Array<number>(27).fill(0)
    const [a, b] = p.used.filter((u) => !p.givens.includes(u))
    entries[a] = p.solution[a] === 26 ? 25 : p.solution[a] + 1
    const h = nextCodewordHint(p, entries)
    expect(h).toEqual({ kind: 'mistake', nums: [a] })
    entries[b] = entries[a]
    expect(codewordConflicts(p, entries).has(a)).toBe(true)
    expect(codewordConflicts(p, entries).has(b)).toBe(true)
    expect(isCodewordSolved(p, entries)).toBe(false)
  })

  it('shows what is known of a word as a pattern', () => {
    const p = generateCodeword('easy', seeded(2))
    const known = knownLetters(p, Array<number>(27).fill(0))
    const pattern = patternOf(p, 0, known).split(' ')
    expect(pattern).toHaveLength(p.slots[0].cells.length)
    p.slots[0].cells.forEach((i, k) => expect(pattern[k]).toBe(known[p.code[i]] ? letterChar(known[p.code[i]]) : '_'))
  })
})
