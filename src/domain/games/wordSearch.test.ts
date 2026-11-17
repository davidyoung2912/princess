import { describe, expect, it } from 'vitest'
import { WORD_SEARCH_LEVELS, generateWordSearch, isWordSearchSolved, lineBetween, matchWord, nextWordHint } from './wordSearch'
import { WORD_SEARCH_ANSWERS, WORD_SEARCH_WORDS } from './wordSearchWords'
import type { Difficulty } from './sudoku'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const LEVELS = Object.keys(WORD_SEARCH_LEVELS) as Difficulty[]

describe('Word Search word lists', () => {
  it('holds upper case themed words and answers of the right length', () => {
    expect(new Set(WORD_SEARCH_WORDS).size).toBe(WORD_SEARCH_WORDS.length)
    for (const w of WORD_SEARCH_WORDS) expect(w).toMatch(/^[A-Z]{3,10}$/)
    for (const [len, list] of Object.entries(WORD_SEARCH_ANSWERS)) for (const a of list) expect(a).toHaveLength(Number(len))
  })
})

describe('lineBetween', () => {
  it('walks straight lines in eight directions and refuses bent ones', () => {
    expect(lineBetween(5, 0, 3)).toEqual([0, 1, 2, 3])
    expect(lineBetween(5, 12, 2)).toEqual([12, 7, 2])
    expect(lineBetween(5, 0, 12)).toEqual([0, 6, 12])
    expect(lineBetween(5, 4, 20)).toEqual([4, 8, 12, 16, 20])
    expect(lineBetween(5, 0, 7)).toBeNull()
  })
})

describe('Word Search', () => {
  for (const level of LEVELS) {
    it(`makes ${level} puzzles where every square is in a word or spells the answer`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generateWordSearch(level, seeded(seed * 7 + level.length))
        const cfg = WORD_SEARCH_LEVELS[level]
        expect(p.size).toBe(cfg.size)
        expect(p.letters).toHaveLength(cfg.size * cfg.size)
        expect(p.answer).toHaveLength(cfg.answer)
        expect(p.answerCells.map((c) => p.letters[c]).join('')).toBe(p.answer)
        const covered = new Set(p.words.flatMap((w) => w.cells))
        p.letters.forEach((l, i) => {
          expect(l).toMatch(/^[A-Z]$/)
          expect(covered.has(i) || p.answerCells.includes(i)).toBe(true)
        })
        expect(p.answerCells.some((c) => covered.has(c))).toBe(false)
        for (const w of p.words) expect(w.cells.map((c) => p.letters[c]).join('')).toBe(w.text)
        expect(new Set(p.words.map((w) => w.text)).size).toBe(p.words.length)
      }
    })
  }

  it('finds words forwards and backwards, once each, and solves when all are found', () => {
    const p = generateWordSearch('easy', seeded(3))
    const found = new Set<number>()
    expect(matchWord(p, [p.answerCells[0], p.answerCells[1]], found)).toBe(-1)
    p.words.forEach((w, k) => {
      const cells = k % 2 ? [...w.cells].reverse() : w.cells
      expect(matchWord(p, cells, found)).toBe(k)
      found.add(k)
      expect(matchWord(p, cells, found)).toBe(-1)
    })
    expect(isWordSearchSolved(p, found)).toBe(true)
    expect(nextWordHint(p, found)).toBeNull()
  })

  it('hints the first letter of the next unfound word and its direction', () => {
    const p = generateWordSearch('medium', seeded(9))
    const h = nextWordHint(p, new Set([0]))
    expect(h?.word).toBe(1)
    expect(h?.cell).toBe(p.words[1].cells[0])
    expect(h?.dir).toBeGreaterThanOrEqual(0)
  })
})
