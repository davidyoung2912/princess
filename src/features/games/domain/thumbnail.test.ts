import { describe, expect, it } from 'vitest'
import { SHAREABLE_GAMES, decodeGame, encodeGame, type SharedGame } from './share'
import { gameThumbnail, THUMBNAIL_MAX } from './thumbnail'
import { generatePuzzle } from './sudoku'
import { generateKakuro } from './kakuro'
import { generateHashi } from './hashi'

describe('gameThumbnail', () => {
  it('draws a sudoku as 9 by 9 with the givens filled', () => {
    const puzzle = generatePuzzle('easy')
    const t = gameThumbnail({ game: 'sudoku', puzzle, entries: Array(81).fill(0), notes: Array(81).fill(0) })!
    expect([t.rows, t.cols, t.filled.length]).toEqual([9, 9, 81])
    expect(t.filled.filter(Boolean).length).toBe(puzzle.puzzle.filter((c) => c !== 0).length)
  })
  it('marks the dark squares of a kakuro and the islands of a hashi', () => {
    const k = generateKakuro('easy')
    const kt = gameThumbnail({ game: 'kakuro', puzzle: k, entries: [], notes: [] })!
    expect(kt.filled.filter(Boolean).length).toBe(k.white.filter((w) => !w).length)
    const h = generateHashi('easy')
    const ht = gameThumbnail({ game: 'hashi', puzzle: h, entries: [], notes: [] })!
    expect(ht.filled.filter(Boolean).length).toBe(h.islands.length)
  })
  it('has nothing for Cruise Wordle, and every other shareable game has a sensible one after a round trip', () => {
    const wordle = { game: 'cruise-wordle', puzzle: { difficulty: 'easy', index: 0, target: 'CRANE' }, entries: [], notes: [], guesses: [] } as unknown as SharedGame
    expect(gameThumbnail(wordle)).toBeNull()
    const sudoku = { game: 'sudoku', puzzle: generatePuzzle('easy'), entries: Array(81).fill(0), notes: Array(81).fill(0) } as SharedGame
    const back = decodeGame('sudoku', encodeGame(sudoku, 'start'))!
    expect(gameThumbnail(back)).toEqual(gameThumbnail(sudoku))
    expect(SHAREABLE_GAMES.length).toBeGreaterThan(14)
    expect(THUMBNAIL_MAX).toBeGreaterThanOrEqual(169)
  })
})
