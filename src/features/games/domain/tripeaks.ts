import { newDeck, shuffle, type Card, type Rng } from './cards'

/**
 * TriPeaks: 28 cards in three overlapping peaks. Remove an uncovered card that is one rank above or below the card on the waste, whatever the suit; it becomes the new waste card.
 * When nothing fits, turn over the next card from the stock (which ends the run). Clear all three peaks to win. In the Easy level King and Ace count as next to each other.
 */
export type TriLevel = 'easy' | 'classic'
export const TRI_LEVELS: readonly TriLevel[] = ['easy', 'classic']

/** Row by row from the top: 3 peak tops, 6, 9 and a base of 10. Positions are in half card widths from the left so rows can be offset by half a card. */
export const ROW_SIZES = [3, 6, 9, 10] as const
const ROW_X: number[][] = [
  [3, 9, 15],
  [2, 4, 8, 10, 14, 16],
  [1, 3, 5, 7, 9, 11, 13, 15, 17],
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
]
export const ROW_START = [0, 3, 9, 18]
export const TOTAL = 28

export const rowOf = (i: number): number => (i < 3 ? 0 : i < 9 ? 1 : i < 18 ? 2 : 3)
/** Half-card-widths from the left edge. */
export const xOf = (i: number): number => ROW_X[rowOf(i)][i - ROW_START[rowOf(i)]]
/** The two cards that rest on card `i` (none on the base row). */
export const coveredBy = (i: number): number[] => {
  const r = rowOf(i)
  if (r === 3) return []
  const x = xOf(i)
  return [x - 1, x + 1].map((cx) => ROW_START[r + 1] + ROW_X[r + 1].indexOf(cx))
}
/** The peak (0, 1 or 2) whose apex is card `i`'s ancestor, or null for cards shared by two peaks. */
export const apexOf = (i: number): number | null => (i < 3 ? i : null)

export interface TriPeaks {
  tableau: (Card | null)[]
  stock: Card[]
  waste: Card[]
  /** Cards taken in a row since the last turn of the stock. */
  streak: number
  score: number
  wrap: boolean
  /** Peaks whose tops are cleared, for the bonus. */
  peaks: boolean[]
}

export function deal(level: TriLevel, rng: Rng = Math.random): TriPeaks {
  const deck = shuffle(newDeck(), rng)
  return { tableau: deck.slice(0, TOTAL), stock: deck.slice(TOTAL, 51), waste: [deck[51]], streak: 0, score: 0, wrap: level === 'easy', peaks: [false, false, false] }
}

export const isFree = (g: TriPeaks, i: number): boolean => g.tableau[i] !== null && coveredBy(i).every((c) => g.tableau[c] === null)

export const adjacent = (a: number, b: number, wrap: boolean): boolean => Math.abs(a - b) === 1 || (wrap && Math.abs(a - b) === 12)

export const wasteTop = (g: TriPeaks): Card => g.waste[g.waste.length - 1]

export const canPlay = (g: TriPeaks, i: number): boolean => isFree(g, i) && adjacent(g.tableau[i]!.rank, wasteTop(g).rank, g.wrap)

export function play(g: TriPeaks, i: number): TriPeaks {
  if (!canPlay(g, i)) return g
  const card = g.tableau[i]!
  const tableau = g.tableau.slice()
  tableau[i] = null
  const streak = g.streak + 1
  const peaks = g.peaks.slice()
  let score = g.score + streak * 10
  if (i < 3 && !peaks[i]) { peaks[i] = true; score += 150 }
  const next: TriPeaks = { ...g, tableau, waste: [...g.waste, card], streak, score, peaks }
  if (isWon(next)) next.score += next.stock.length * 50
  return next
}

export const canDraw = (g: TriPeaks): boolean => g.stock.length > 0

export function draw(g: TriPeaks): TriPeaks {
  if (g.stock.length === 0) return g
  return { ...g, stock: g.stock.slice(0, -1), waste: [...g.waste, g.stock[g.stock.length - 1]], streak: 0 }
}

export const isWon = (g: TriPeaks): boolean => g.tableau.every((c) => c === null)
export const playable = (g: TriPeaks): number[] => g.tableau.flatMap((_, i) => (canPlay(g, i) ? [i] : []))
export const isStuck = (g: TriPeaks): boolean => !isWon(g) && g.stock.length === 0 && playable(g).length === 0

/** The card to take now: the first card of the longest run that can be played from here without turning the stock. Null when nothing can be played. */
export function hint(g: TriPeaks): number | null {
  const first = playable(g)
  if (first.length === 0) return null
  const memo = new Map<string, number>()
  const run = (t: (Card | null)[], top: number): number => {
    const key = `${t.map((c) => (c ? 1 : 0)).join('')}${top}`
    const got = memo.get(key)
    if (got !== undefined) return got
    let best = 0
    for (let i = 0; i < TOTAL; i++) {
      const c = t[i]
      if (!c || !coveredBy(i).every((k) => t[k] === null) || !adjacent(c.rank, top, g.wrap)) continue
      const n = t.slice()
      n[i] = null
      best = Math.max(best, 1 + run(n, c.rank))
    }
    memo.set(key, best)
    return best
  }
  let pick = first[0]
  let most = -1
  for (const i of first) {
    const n = g.tableau.slice()
    n[i] = null
    const len = 1 + run(n, g.tableau[i]!.rank)
    if (len > most) { most = len; pick = i }
  }
  return pick
}
