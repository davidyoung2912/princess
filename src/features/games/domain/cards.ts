/** Shared playing-card basics for the card games (Klondike, Spider, FreeCell, Pyramid). Framework-free. */

export type Suit = 0 | 1 | 2 | 3 // spades, hearts, diamonds, clubs
export const SUIT_NAMES = ['spade', 'heart', 'diamond', 'club'] as const
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

/** One card. `id` is unique within a game (Spider uses two decks), so two cards of the same face can be told apart. */
export interface Card { id: number; suit: Suit; rank: Rank }

export type Rng = () => number

export const isRed = (c: Pick<Card, 'suit'>): boolean => c.suit === 1 || c.suit === 2
export const isBlack = (c: Pick<Card, 'suit'>): boolean => !isRed(c)
export const sameColour = (a: Card, b: Card): boolean => isRed(a) === isRed(b)

/** The name of the card in the artwork sprite: `spade_1` ... `spade_10`, `spade_jack`, `spade_queen`, `spade_king`. */
export const spriteId = (c: Pick<Card, 'suit' | 'rank'>): string => `${SUIT_NAMES[c.suit]}_${c.rank === 11 ? 'jack' : c.rank === 12 ? 'queen' : c.rank === 13 ? 'king' : c.rank}`

/** A small seeded random generator, so a deal can be repeated. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A fresh 52-card deck in order. `firstId` lets a second deck follow the first. */
export function newDeck(firstId = 0): Card[] {
  const out: Card[] = []
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) out.push({ id: firstId + s * 13 + (r - 1), suit: s as Suit, rank: r as Rank })
  return out
}

export const RANK_LETTERS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUIT_LETTERS = ['S', 'H', 'D', 'C']
/** A short name like `7H` for tests and logs. */
export const shortName = (c: Pick<Card, 'suit' | 'rank'>): string => `${RANK_LETTERS[c.rank]}${SUIT_LETTERS[c.suit]}`
