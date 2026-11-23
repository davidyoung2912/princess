import { newDeck, shuffle, type Card, type Rng } from './cards'

/**
 * Pyramid: 28 cards in seven rows, each card (except the bottom row) resting on the two below it. Remove a King by itself, or two uncovered cards that add up to 13
 * (Ace 1, Jack 11, Queen 12). The rest of the deck is turned over one card at a time to the waste, whose top card can pair with the pyramid. Clear the pyramid to win.
 * Levels are how many times the stock may be turned through: three (Easy), two (Classic) or one (Hard).
 */
export type PyramidLevel = 'easy' | 'classic' | 'hard'
export const PYRAMID_LEVELS: readonly PyramidLevel[] = ['easy', 'classic', 'hard']
export const PASSES_OF: Record<PyramidLevel, number> = { easy: 3, classic: 2, hard: 1 }

export interface Pyramid {
  /** 28 slots, row by row from the top; null once removed. */
  tableau: (Card | null)[]
  stock: Card[] // the top is the last
  waste: Card[]
  /** Cards removed so far (for the end card). */
  removed: number
  /** How many times the stock has been turned through, counting the first. */
  pass: number
  passes: number
}

/** The index of the first slot of a row, and the row and place of a slot. */
export const rowStart = (r: number): number => (r * (r + 1)) / 2
export const rowOf = (i: number): number => { let r = 0; while (rowStart(r + 1) <= i) r++; return r }
export const placeOf = (i: number): number => i - rowStart(rowOf(i))

/** The two slots resting on slot `i`, or none on the bottom row. */
export const coveredBy = (i: number): number[] => {
  const r = rowOf(i)
  if (r === 6) return []
  const p = placeOf(i)
  return [rowStart(r + 1) + p, rowStart(r + 1) + p + 1]
}

export function deal(level: PyramidLevel, rng: Rng = Math.random): Pyramid {
  const deck = shuffle(newDeck(), rng)
  return { tableau: deck.slice(0, 28), stock: deck.slice(28), waste: [], removed: 0, pass: 1, passes: PASSES_OF[level] }
}

/** A pyramid card is free when both cards resting on it are gone. */
export const isFree = (g: Pyramid, i: number): boolean => g.tableau[i] !== null && coveredBy(i).every((c) => g.tableau[c] === null)

export type Pick = { kind: 'pyramid'; index: number } | { kind: 'waste' }

export const cardOf = (g: Pyramid, p: Pick): Card | null => (p.kind === 'waste' ? g.waste[g.waste.length - 1] ?? null : isFree(g, p.index) ? g.tableau[p.index] : null)

const samePick = (a: Pick, b: Pick): boolean => a.kind === b.kind && (a.kind === 'waste' || (b.kind === 'pyramid' && a.index === b.index))

/** Whether picking these (one for a King, two for a pair) removes them. */
export function canRemove(g: Pyramid, picks: readonly Pick[]): boolean {
  if (picks.length === 1) return cardOf(g, picks[0])?.rank === 13
  if (picks.length !== 2 || samePick(picks[0], picks[1])) return false
  const [a, b] = [cardOf(g, picks[0]), cardOf(g, picks[1])]
  return !!a && !!b && a.rank + b.rank === 13
}

export function remove(g: Pyramid, picks: readonly Pick[]): Pyramid {
  if (!canRemove(g, picks)) return g
  const tableau = g.tableau.slice()
  let waste = g.waste
  for (const p of picks) {
    if (p.kind === 'pyramid') tableau[p.index] = null
    else waste = waste.slice(0, -1)
  }
  return { ...g, tableau, waste, removed: g.removed + picks.length }
}

export const canDraw = (g: Pyramid): boolean => g.stock.length > 0 || (g.waste.length > 0 && g.pass < g.passes)

/** Turns the next stock card onto the waste; with the stock gone, turns the waste over again if a pass is left. */
export function draw(g: Pyramid): Pyramid {
  if (g.stock.length > 0) return { ...g, stock: g.stock.slice(0, -1), waste: [...g.waste, g.stock[g.stock.length - 1]] }
  if (g.waste.length > 0 && g.pass < g.passes) return { ...g, stock: g.waste.slice().reverse(), waste: [], pass: g.pass + 1 }
  return g
}

export const isWon = (g: Pyramid): boolean => g.tableau.every((c) => c === null)
/** No more cards can be drawn and nothing can be removed. */
export const isStuck = (g: Pyramid): boolean => !isWon(g) && !canDraw(g) && hint(g) === null

/** A removable King or pair, or null. Prefers moves that use pyramid cards over waste cards, and lower rows first (they unlock more). */
export function hint(g: Pyramid): Pick[] | null {
  const frees: Pick[] = []
  for (let i = 27; i >= 0; i--) if (isFree(g, i)) frees.push({ kind: 'pyramid', index: i })
  const all: Pick[] = g.waste.length ? [...frees, { kind: 'waste' }] : frees
  for (const p of all) if (canRemove(g, [p])) return [p]
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) if (canRemove(g, [all[a], all[b]])) return [all[a], all[b]]
  return null
}
