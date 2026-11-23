import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import { canDeal, canMove, deal, dealRow, hint, isWon, move, runLength, spiderDeck, type Spider } from './spider'

const c = (id: number, suit: 0 | 1 | 2 | 3, rank: number) => ({ id, suit, rank: rank as 1 })

describe('Spider', () => {
  it('uses 104 cards: eight sets of each rank at every level', () => {
    for (const level of ['one', 'two', 'four'] as const) {
      const d = spiderDeck(level)
      expect(d).toHaveLength(104)
      expect(new Set(d.map((x) => x.id)).size).toBe(104)
      for (let r = 1; r <= 13; r++) expect(d.filter((x) => x.rank === r)).toHaveLength(8)
    }
    expect(new Set(spiderDeck('two').map((x) => x.suit)).size).toBe(2)
  })

  it('deals 54 cards to ten columns (6,6,6,6,5,...) and leaves five rows of ten', () => {
    const g = deal('four', seededRng(1))
    expect(g.columns.map((x) => x.down.length + x.up.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5])
    expect(g.columns.every((x) => x.up.length === 1)).toBe(true)
    expect(g.stock).toHaveLength(50)
  })

  it('moves only single-suit descending runs, onto the next higher card of any suit', () => {
    const base = deal('four', seededRng(2))
    const g: Spider = { ...base, columns: [{ down: [], up: [c(1, 0, 9), c(2, 0, 8), c(3, 1, 7)] }, { down: [], up: [c(4, 2, 10)] }, { down: [], up: [] }, ...base.columns.slice(3)] }
    expect(runLength(g.columns[0])).toBe(1)
    expect(canMove(g, 0, 2, 1)).toBe(false) // 7 onto 10 no
    expect(canMove(g, 0, 1, 1)).toBe(false) // 8,7 are not one suit
    expect(canMove(g, 0, 0, 1)).toBe(false)
    const h: Spider = { ...g, columns: [{ down: [c(9, 3, 4)], up: [c(2, 0, 9), c(3, 0, 8)] }, g.columns[1], g.columns[2], ...g.columns.slice(3)] }
    expect(canMove(h, 0, 0, 1)).toBe(true)
    const m = move(h, 0, 0, 1)
    expect(m.columns[1].up.map((x) => x.id)).toEqual([4, 2, 3])
    expect(m.columns[0].up.map((x) => x.id)).toEqual([9])
    expect(canMove(h, 0, 1, 2)).toBe(true) // a single card to an empty column
  })

  it('takes a complete King to Ace run off the table, and wins with eight', () => {
    const base = deal('one', seededRng(3))
    const run = Array.from({ length: 13 }, (_, i) => c(100 + i, 0, 13 - i))
    const g: Spider = { ...base, done: [0, 0, 0, 0, 0, 0, 0], columns: [{ down: [c(1, 0, 5)], up: run.slice(0, 12) }, { down: [], up: [run[12]] }, ...base.columns.slice(2)] }
    const m = move(g, 1, 0, 0)
    expect(m.done).toHaveLength(8)
    expect(isWon(m)).toBe(true)
    expect(m.columns[0].up.map((x) => x.id)).toEqual([1]) // the hidden card turned up
  })

  it('will not deal a row onto an empty column, and deals ten cards otherwise', () => {
    const g = deal('two', seededRng(4))
    expect(canDeal(g)).toBe(true)
    const d = dealRow(g)
    expect(d.stock).toHaveLength(40)
    expect(d.columns.every((x, i) => x.up.length === g.columns[i].up.length + 1)).toBe(true)
    const empty: Spider = { ...g, columns: [{ down: [], up: [] }, ...g.columns.slice(1)] }
    expect(canDeal(empty)).toBe(false)
    expect(dealRow(empty)).toBe(empty)
  })

  it('always has some hint at the start, and it is legal', () => {
    for (let s = 1; s <= 20; s++) {
      const g = deal('two', seededRng(s))
      const h = hint(g)
      expect(h).not.toBeNull()
      if (h && h !== 'deal') expect(canMove(g, h.from, h.index, h.to)).toBe(true)
    }
  })
})
