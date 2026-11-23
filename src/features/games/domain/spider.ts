import { shuffle, type Card, type Rank, type Rng, type Suit } from './cards'

/**
 * Spider: two decks (104 cards) on ten columns. Build columns downward in any suit, but only a run of one suit moves as a unit. A complete King to Ace run of one suit
 * leaves the table; clear all eight to win. Levels are 1, 2 or 4 suits.
 */
export type SpiderLevel = 'one' | 'two' | 'four'
export const SPIDER_LEVELS: readonly SpiderLevel[] = ['one', 'two', 'four']
export const SUITS_OF: Record<SpiderLevel, number> = { one: 1, two: 2, four: 4 }

export interface SpiderColumn { down: Card[]; up: Card[] }
export interface Spider {
  columns: SpiderColumn[]
  stock: Card[] // dealt ten at a time from the end
  /** Complete runs taken off, by suit. */
  done: Suit[]
  suits: number
}

/** The 104 cards for a level: 1 suit uses spades eight times, 2 suits spades and hearts four times each, 4 suits two full decks. */
export function spiderDeck(level: SpiderLevel): Card[] {
  const suits: Suit[] = level === 'one' ? [0] : level === 'two' ? [0, 1] : [0, 1, 2, 3]
  const copies = 8 / suits.length
  const out: Card[] = []
  let id = 0
  for (const suit of suits) for (let k = 0; k < copies; k++) for (let r = 1; r <= 13; r++) out.push({ id: id++, suit, rank: r as Rank })
  return out
}

export function deal(level: SpiderLevel, rng: Rng = Math.random): Spider {
  const deck = shuffle(spiderDeck(level), rng)
  const columns: SpiderColumn[] = []
  let at = 0
  for (let c = 0; c < 10; c++) {
    const n = c < 4 ? 6 : 5
    const pile = deck.slice(at, at + n)
    at += n
    columns.push({ down: pile.slice(0, n - 1), up: [pile[n - 1]] })
  }
  return { columns, stock: deck.slice(at), done: [], suits: SUITS_OF[level] }
}

/** The length of the movable run at the end of a column: descending by one in a single suit. */
export function runLength(col: SpiderColumn): number {
  const u = col.up
  let n = 0
  for (let i = u.length - 1; i >= 0; i--) {
    if (i === u.length - 1 || (u[i].suit === u[i + 1].suit && u[i].rank === u[i + 1].rank + 1)) n++
    else break
  }
  return n
}

/** Whether the cards from `index` of a column's face-up part are a movable run. */
export const canPick = (g: Spider, col: number, index: number): boolean => {
  const c = g.columns[col]
  return index >= 0 && index < c.up.length && c.up.length - index <= runLength(c)
}

export function canMove(g: Spider, from: number, index: number, to: number): boolean {
  if (from === to || !canPick(g, from, index)) return false
  const dest = g.columns[to]
  const lead = g.columns[from].up[index]
  if (dest.up.length === 0) return dest.down.length === 0
  return dest.up[dest.up.length - 1].rank === lead.rank + 1
}

/** Takes a King-to-Ace run of one suit off the end of a column, if there is one. */
function clearRuns(g: Spider): Spider {
  let cur = g
  for (let i = 0; i < 10; i++) {
    const col = cur.columns[i]
    if (col.up.length >= 13 && runLength(col) >= 13) {
      const keep = col.up.slice(0, col.up.length - 13)
      const suit = col.up[col.up.length - 1].suit
      const nd = { down: col.down.slice(), up: keep }
      if (nd.up.length === 0 && nd.down.length > 0) nd.up.push(nd.down.pop()!)
      cur = { ...cur, columns: cur.columns.map((c, k) => (k === i ? nd : c)), done: [...cur.done, suit] }
    }
  }
  return cur
}

export function move(g: Spider, from: number, index: number, to: number): Spider {
  if (!canMove(g, from, index, to)) return g
  const run = g.columns[from].up.slice(index)
  const columns = g.columns.map((c) => ({ down: c.down.slice(), up: c.up.slice() }))
  columns[from].up.length = index
  if (columns[from].up.length === 0 && columns[from].down.length > 0) columns[from].up.push(columns[from].down.pop()!)
  columns[to].up.push(...run)
  return clearRuns({ ...g, columns })
}

/** Dealing a row needs a card on every column's pile to land on (the usual rule). */
export const canDeal = (g: Spider): boolean => g.stock.length >= 10 && g.columns.every((c) => c.up.length + c.down.length > 0)

export function dealRow(g: Spider): Spider {
  if (!canDeal(g)) return g
  const row = g.stock.slice(-10)
  const columns = g.columns.map((c, i) => ({ down: c.down.slice(), up: [...c.up, row[i]] }))
  return clearRuns({ ...g, columns, stock: g.stock.slice(0, -10) })
}

export const isWon = (g: Spider): boolean => g.done.length === 8

/** A best move: one that joins to the same suit, uncovers a hidden card or empties a column; never one that only shuffles. */
export function hint(g: Spider): { from: number; index: number; to: number } | 'deal' | null {
  type M = { from: number; index: number; to: number; score: number }
  const options: M[] = []
  for (let from = 0; from < 10; from++) {
    const col = g.columns[from]
    const first = col.up.length - runLength(col)
    for (let index = first; index < col.up.length; index++) {
      for (let to = 0; to < 10; to++) {
        if (!canMove(g, from, index, to)) continue
        const dest = g.columns[to]
        const lead = col.up[index]
        const top = dest.up[dest.up.length - 1]
        let score = 0
        if (top && top.suit === lead.suit) score += 10
        if (index === 0 && col.down.length > 0) score += 8
        if (index === 0 && col.down.length === 0) score += 3
        if (!top) score -= 6
        // A same-suit run split in two when it was whole is a step back.
        if (index > 0 && col.up[index - 1].suit === lead.suit && col.up[index - 1].rank === lead.rank + 1) score -= 12
        if (!top && index === 0 && col.down.length === 0) score -= 20 // an empty column to an empty column
        if (score > 0) options.push({ from, index, to, score })
      }
    }
  }
  options.sort((a, b) => b.score - a.score)
  if (options[0]) return options[0]
  if (canDeal(g)) return 'deal'
  return null
}

/** Where a tapped run should go: onto the same suit if it can, then onto any card, then (last) an empty column. The fullest column is preferred among equals so a column is not needlessly emptied. */
export function bestDest(g: Spider, from: number, index: number): number | null {
  const lead = g.columns[from].up[index]
  if (!lead) return null
  let best: { to: number; score: number } | null = null
  for (let to = 0; to < 10; to++) {
    if (!canMove(g, from, index, to)) continue
    const dest = g.columns[to]
    const top = dest.up[dest.up.length - 1]
    const score = top ? (top.suit === lead.suit ? 100 : 50) + dest.up.length : 0
    if (!best || score > best.score) best = { to, score }
  }
  return best ? best.to : null
}
