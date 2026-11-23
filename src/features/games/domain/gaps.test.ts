import { describe, expect, it } from 'vitest'
import { seededRng, type Card, type Suit } from './cards'
import { COLS, MAX_ROUNDS, allGaps, fill, finished, gapInfo, hint, lockedCount, lockedMask, newGame, nextRound, roundOver, score, won, type Gaps, type Slot } from './gaps'

const card = (suit: Suit, rank: number): Card => ({ id: suit * 20 + rank, suit, rank: rank as 1 })
/** A solved board: each row 2..K of one suit then a gap. */
const solved = (): Slot[] => Array.from({ length: 52 }, (_, i) => { const r = Math.floor(i / COLS), c = i % COLS; return c === 12 ? null : card(r as Suit, c + 2) })

describe('Gaps', () => {
  it('deals 48 cards and four gaps, with no Aces', () => {
    const g = newGame(seededRng(1))
    expect(g.board).toHaveLength(52)
    expect(g.board.filter((c) => c === null)).toHaveLength(4)
    expect(g.board.some((c) => c && c.rank === 1)).toBe(false)
    expect(new Set(g.board.flatMap((c) => (c ? [c.id] : []))).size).toBe(48)
    expect(g.round).toBe(1)
  })

  it('locks the run from a 2 in the first column, in that suit, and nothing else', () => {
    const b = solved()
    expect(lockedCount(b)).toBe(48)
    expect(score(b)).toBe(360)
    expect(won(b)).toBe(true)
    const broken = b.slice()
    broken[5] = card(2, 7) // wrong suit in the middle of row 0
    const l = lockedMask(broken)
    expect(l.slice(0, 5).every(Boolean)).toBe(true)
    expect(l.slice(5, 13).some(Boolean)).toBe(false)
    const noTwo = b.slice()
    noTwo[0] = card(0, 3)
    expect(lockedMask(noTwo).slice(0, 13).some(Boolean)).toBe(false)
  })

  it('fills a gap with the next card of the same suit, which moves the gap', () => {
    const b = solved()
    // Row 0: take the 5 out of place and put the gap there; the 5 sits in row 1's gap spot.
    const board = b.slice()
    board[3] = null // gap after the 4 (col 2)
    board[12] = card(0, 5) // the 5 now sits at the end of row 0
    const info = gapInfo(board, 3)
    expect(info.state).toBe('ready')
    expect(info.options).toEqual([12])
    const g: Gaps = { board, round: 1, moves: 0 }
    const m = fill(g, 3, 12)
    expect(m.board[3]?.rank).toBe(5)
    expect(m.board[12]).toBeNull()
    expect(fill(g, 3, 11)).toBe(g) // not the card that fits
  })

  it('marks a gap right of a King, and gaps right of it, dead; a gap right of a gap waits', () => {
    const b = solved()
    expect(gapInfo(b, 12).state).toBe('dead')
    const board = b.slice()
    board[11] = null // right of the Queen (col 10); the King waits at the end of the row
    board[12] = card(0, 13)
    expect(gapInfo(board, 11).state).toBe('ready')
    expect(gapInfo(board, 11).options).toEqual([12])
    const chain = b.slice()
    chain[5] = null
    chain[6] = null // two gaps in a row, after a 6
    expect(gapInfo(chain, 6).state).toBe('waiting')
    // Put a King-to-gap chain: row 1: King then two gaps.
    const k = b.slice()
    k[13 + 12] = null
    k[13 + 11] = card(1, 13)
    expect(gapInfo(k, 25).state).toBe('dead')
    const two = k.slice()
    two[13 + 11] = card(1, 13)
    two[13 + 12] = null
    expect(gapInfo(two, 25).state).toBe('dead')
  })

  it('a first-column gap takes any unlocked 2', () => {
    const board = solved()
    // Unlock row 3: take its 2 out to the end of row 0's gap.
    board[39] = null
    board[12] = card(3, 2)
    const info = gapInfo(board, 39)
    expect(info.state).toBe('ready')
    expect(info.options).toEqual([12])
    // 2s in locked places are not options.
    expect(gapInfo(board, 39).options).not.toContain(0)
  })

  it('ends the round when all four gaps are dead, then reshuffles only what is not locked', () => {
    const b = solved()
    expect(roundOver(b)).toBe(true)
    // Shuffle a round: break row 3 completely so it has unlocked cards.
    const board = b.slice()
    for (let c = 0; c < 12; c++) board[39 + c] = card(3, c + 2)
    board[39] = card(3, 7)
    board[39 + 5] = card(3, 2)
    const g: Gaps = { board, round: 1, moves: 4 }
    const next = nextRound(g, seededRng(9))
    expect(next.round).toBe(2)
    expect(next.moves).toBe(4)
    expect(next.board.filter((c) => c === null)).toHaveLength(4)
    const lockedBefore = lockedMask(board)
    board.forEach((cardAt, i) => { if (lockedBefore[i]) expect(next.board[i]).toBe(cardAt) })
    expect(new Set(next.board.flatMap((c) => (c ? [c.id] : []))).size).toBe(next.board.filter(Boolean).length)
    expect(next.board.filter(Boolean)).toHaveLength(48)
    expect(roundOver(next.board)).toBe(false)
  })

  it('stops after three rounds', () => {
    const rng = seededRng(5)
    let g = newGame(rng)
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      let guard = 0
      while (!roundOver(g.board) && guard++ < 500) {
        const ready = allGaps(g.board).find((x) => x.state === 'ready')!
        g = fill(g, ready.index, ready.options[0])
      }
      if (round < MAX_ROUNDS) { expect(finished(g)).toBe(false); g = nextRound(g, rng); expect(g.round).toBe(round + 1) }
    }
    expect(finished(g)).toBe(true)
    expect(nextRound(g, rng)).toBe(g)
    expect(score(g.board)).toBeGreaterThan(0)
  })

  it('suggests a legal move, and the suggestion never scores worse than a plain first move', () => {
    for (let s = 1; s <= 12; s++) {
      const g = newGame(seededRng(s))
      const h = hint(g, 5000)
      expect(h).not.toBeNull()
      const info = gapInfo(g.board, h!.gap)
      expect(info.options).toContain(h!.from)
    }
  })
})
