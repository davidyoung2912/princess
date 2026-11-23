import { newDeck, shuffle, isRed, type Card, type Rng } from './cards'

/**
 * Klondike ("Solitaire" or "Patience"): seven columns, four foundations built up from Ace to King by suit, columns built down in alternating colours.
 * Pure functions on an immutable state, so Undo is a stack of states.
 */

export type KlondikeLevel = 'draw1' | 'draw3'
export const KLONDIKE_LEVELS: readonly KlondikeLevel[] = ['draw1', 'draw3']

export interface Column { down: Card[]; up: Card[] }
export interface Klondike {
  draw: 1 | 3
  stock: Card[] // the top of the stock is the last card
  waste: Card[] // the top of the waste is the last card
  foundations: Card[][] // 4 piles, any suit goes on an empty one and the pile then keeps that suit
  columns: Column[]
  /** How many times the waste has been turned back over into the stock. */
  redeals: number
}

export function deal(level: KlondikeLevel, rng: Rng = Math.random): Klondike {
  const deck = shuffle(newDeck(), rng)
  const columns: Column[] = []
  let at = 0
  for (let c = 0; c < 7; c++) {
    const pile = deck.slice(at, at + c + 1)
    at += c + 1
    columns.push({ down: pile.slice(0, c), up: [pile[c]] })
  }
  return { draw: level === 'draw3' ? 3 : 1, stock: deck.slice(at), waste: [], foundations: [[], [], [], []], columns, redeals: 0 }
}

/** Where a move starts: the waste's top card, a foundation's top card, or the face-up run of a column from `index`. */
export type Source = { kind: 'waste' } | { kind: 'foundation'; pile: number } | { kind: 'column'; col: number; index: number }
export type Dest = { kind: 'foundation'; pile: number } | { kind: 'column'; col: number }

export const cardsAt = (g: Klondike, s: Source): Card[] => {
  if (s.kind === 'waste') return g.waste.length ? [g.waste[g.waste.length - 1]] : []
  if (s.kind === 'foundation') { const p = g.foundations[s.pile]; return p.length ? [p[p.length - 1]] : [] }
  return g.columns[s.col].up.slice(s.index)
}

export const canOnFoundation = (g: Klondike, card: Card, pile: number): boolean => {
  const f = g.foundations[pile]
  if (f.length === 0) return card.rank === 1 && g.foundations.every((p) => p.length === 0 || p[0].suit !== card.suit)
  const top = f[f.length - 1]
  return top.suit === card.suit && card.rank === top.rank + 1
}

export const canOnColumn = (g: Klondike, card: Card, col: number): boolean => {
  const c = g.columns[col]
  if (c.up.length === 0) return c.down.length === 0 && card.rank === 13
  const top = c.up[c.up.length - 1]
  return top.rank === card.rank + 1 && isRed(top) !== isRed(card)
}

/** The foundation pile this card would go on, if any. */
export const foundationFor = (g: Klondike, card: Card): number => {
  for (let p = 0; p < 4; p++) if (canOnFoundation(g, card, p)) return p
  return -1
}

export function canMove(g: Klondike, s: Source, d: Dest): boolean {
  const run = cardsAt(g, s)
  if (run.length === 0) return false
  if (d.kind === 'foundation') return run.length === 1 && canOnFoundation(g, run[0], d.pile) && !(s.kind === 'foundation' && s.pile === d.pile)
  if (s.kind === 'column' && s.col === d.col) return false
  return canOnColumn(g, run[0], d.col)
}

/** Makes a move (assumed legal) and turns up a newly uncovered column card. */
export function move(g: Klondike, s: Source, d: Dest): Klondike {
  if (!canMove(g, s, d)) return g
  const run = cardsAt(g, s)
  const columns = g.columns.map((c) => ({ down: c.down.slice(), up: c.up.slice() }))
  const foundations = g.foundations.map((p) => p.slice())
  let waste = g.waste
  if (s.kind === 'waste') waste = g.waste.slice(0, -1)
  else if (s.kind === 'foundation') foundations[s.pile].pop()
  else {
    const col = columns[s.col]
    col.up.length = s.index
    if (col.up.length === 0 && col.down.length > 0) col.up.push(col.down.pop()!)
  }
  if (d.kind === 'foundation') foundations[d.pile].push(...run)
  else columns[d.col].up.push(...run)
  return { ...g, waste, foundations, columns }
}

/** Turns cards from the stock to the waste (one or three), or, when the stock is empty, turns the waste back over. */
export function drawFromStock(g: Klondike): Klondike {
  if (g.stock.length > 0) {
    const take = g.stock.slice(-g.draw).reverse()
    return { ...g, stock: g.stock.slice(0, g.stock.length - take.length), waste: [...g.waste, ...take] }
  }
  if (g.waste.length === 0) return g
  return { ...g, stock: g.waste.slice().reverse(), waste: [], redeals: g.redeals + 1 }
}

export const canDraw = (g: Klondike): boolean => g.stock.length > 0 || g.waste.length > 0

export const isWon = (g: Klondike): boolean => g.foundations.every((p) => p.length === 13)

/** Every card is face up and the stock and waste are empty or can be cleared: the rest is just moving cards home. */
export const canAutoFinish = (g: Klondike): boolean => !isWon(g) && g.stock.length === 0 && g.waste.length === 0 && g.columns.every((c) => c.down.length === 0)

/** One step of finishing: the next card that can go to a foundation (lowest rank first), or null. */
export function autoStep(g: Klondike): { from: Source; to: Dest } | null {
  const picks: { from: Source; to: Dest; rank: number }[] = []
  if (g.waste.length) { const c = g.waste[g.waste.length - 1]; const p = foundationFor(g, c); if (p >= 0) picks.push({ from: { kind: 'waste' }, to: { kind: 'foundation', pile: p }, rank: c.rank }) }
  g.columns.forEach((col, i) => {
    if (!col.up.length) return
    const c = col.up[col.up.length - 1]
    const p = foundationFor(g, c)
    if (p >= 0) picks.push({ from: { kind: 'column', col: i, index: col.up.length - 1 }, to: { kind: 'foundation', pile: p }, rank: c.rank })
  })
  picks.sort((a, b) => a.rank - b.rank)
  return picks[0] ?? null
}

/** The best place for a tapped card: a foundation first, otherwise the first column it fits (preferring one that turns up a hidden card). */
export function bestDest(g: Klondike, s: Source): Dest | null {
  const run = cardsAt(g, s)
  if (run.length === 0) return null
  if (run.length === 1) { const p = foundationFor(g, run[0]); if (p >= 0 && !(s.kind === 'foundation')) return { kind: 'foundation', pile: p } }
  const options: { d: Dest; score: number }[] = []
  for (let col = 0; col < 7; col++) {
    if (!canMove(g, s, { kind: 'column', col })) continue
    let score = 1
    if (g.columns[col].up.length === 0) score = 0 // a King into an empty column is rarely urgent
    options.push({ d: { kind: 'column', col }, score })
  }
  options.sort((a, b) => b.score - a.score)
  return options[0]?.d ?? null
}

export interface Hint { from: Source; to: Dest | 'draw' }

/** A sensible next move: to a foundation, a move that turns up a hidden card, any other useful move, then drawing. Avoids pointless back-and-forth moves of whole runs. */
export function hint(g: Klondike): Hint | null {
  const auto = autoStep(g)
  if (auto) return auto
  // Moves that uncover a face-down card.
  for (let i = 0; i < 7; i++) {
    const col = g.columns[i]
    if (col.up.length === 0 || col.down.length === 0) continue
    const s: Source = { kind: 'column', col: i, index: 0 }
    for (let d = 0; d < 7; d++) if (d !== i && canMove(g, s, { kind: 'column', col: d })) return { from: s, to: { kind: 'column', col: d } }
  }
  // Waste to a column.
  if (g.waste.length) {
    const s: Source = { kind: 'waste' }
    for (let d = 0; d < 7; d++) if (canMove(g, s, { kind: 'column', col: d })) return { from: s, to: { kind: 'column', col: d } }
  }
  // A King to an empty column from a column with hidden cards, handled above; a run that frees a column entirely.
  for (let i = 0; i < 7; i++) {
    const col = g.columns[i]
    if (col.up.length === 0 || col.down.length > 0) continue
    const s: Source = { kind: 'column', col: i, index: 0 }
    if (col.up[0].rank === 13) continue
    for (let d = 0; d < 7; d++) if (d !== i && canMove(g, s, { kind: 'column', col: d })) return { from: s, to: { kind: 'column', col: d } }
  }
  if (g.stock.length > 0 || (g.waste.length > 0 && g.redeals < 8)) return { from: { kind: 'waste' }, to: 'draw' }
  return null
}
