import { newDeck, shuffle, type Card, type Rng } from './cards'

/**
 * Gaps (also called Montana): four rows of thirteen. The Aces are taken out, leaving four gaps. A gap is filled by the card of the same suit one rank above the card to its left, which
 * moves the gap to where that card was; a gap in the first column takes a 2. Cards in order from a 2 in the first column are locked. A gap to the right of a King is dead. When all
 * four gaps are dead the round is over: the cards that are not locked are shuffled (with the four gaps) back into the unlocked places, for up to three rounds. The score is the sum of
 * the locked cards' values at the end. Pure functions on an immutable state, so Undo is a stack of states.
 */
export const ROWS = 4
export const COLS = 13
export const MAX_ROUNDS = 3
/** The most a game can score: 2 + 3 + ... + 13, for each of the four suits. */
export const MAX_SCORE = 4 * 90

export type Slot = Card | null
export interface Gaps { board: Slot[]; round: number; moves: number }

export const rowOf = (i: number): number => Math.floor(i / COLS)
export const colOf = (i: number): number => i % COLS

/** Which squares hold a locked card: in each row, the run that starts with a 2 in the first column and climbs in that suit. */
export function lockedMask(board: readonly Slot[]): boolean[] {
  const out = Array<boolean>(board.length).fill(false)
  for (let r = 0; r < ROWS; r++) {
    const first = board[r * COLS]
    if (!first || first.rank !== 2) continue
    for (let c = 0; c < COLS - 1; c++) {
      const card = board[r * COLS + c]
      if (card && card.suit === first.suit && card.rank === c + 2) out[r * COLS + c] = true
      else break
    }
  }
  return out
}

export type GapState = 'ready' | 'waiting' | 'dead'
export interface GapInfo { index: number; state: GapState; /** Squares of the cards that could fill it. */ options: number[] }

/** What a gap can do now. A gap right of a King (or of gaps right of a King) is dead; a gap right of another gap waits for it. */
export function gapInfo(board: readonly Slot[], index: number, locked: readonly boolean[] = lockedMask(board)): GapInfo {
  const c = colOf(index)
  if (c === 0) {
    const options = board.flatMap((card, i) => (card && card.rank === 2 && !locked[i] ? [i] : []))
    return { index, state: options.length ? 'ready' : 'dead', options }
  }
  const rowStart = index - c
  let j = index - 1
  while (j >= rowStart && board[j] === null) j--
  if (j >= rowStart && board[j]!.rank === 13) return { index, state: 'dead', options: [] }
  if (j !== index - 1) return { index, state: 'waiting', options: [] }
  const left = board[index - 1]!
  const at = board.findIndex((card) => !!card && card.suit === left.suit && card.rank === left.rank + 1)
  if (at < 0 || locked[at]) return { index, state: 'dead', options: [] }
  return { index, state: 'ready', options: [at] }
}

export const gapIndexes = (board: readonly Slot[]): number[] => board.flatMap((c, i) => (c === null ? [i] : []))
export const allGaps = (board: readonly Slot[]): GapInfo[] => { const locked = lockedMask(board); return gapIndexes(board).map((i) => gapInfo(board, i, locked)) }
export const roundOver = (board: readonly Slot[]): boolean => allGaps(board).every((g) => g.state !== 'ready')
export const won = (board: readonly Slot[]): boolean => lockedMask(board).filter(Boolean).length === ROWS * (COLS - 1)
/** The game is over when every row is built, or the third round has run out of moves. */
export const finished = (g: Gaps): boolean => won(g.board) || (g.round >= MAX_ROUNDS && roundOver(g.board))
export const score = (board: readonly Slot[]): number => { const l = lockedMask(board); return board.reduce((a, c, i) => a + (c && l[i] ? c.rank : 0), 0) }
export const lockedCount = (board: readonly Slot[]): number => lockedMask(board).filter(Boolean).length

/** A fresh deal with the Aces taken out. Redealt if no gap could move, so a round never opens with nothing to do. */
export function newGame(rng: Rng = Math.random): Gaps {
  for (let tries = 0; ; tries++) {
    const board: Slot[] = shuffle(newDeck(), rng).map((c) => (c.rank === 1 ? null : c))
    if (tries > 200 || !roundOver(board)) return { board, round: 1, moves: 0 }
  }
}

export function fill(g: Gaps, gap: number, from: number): Gaps {
  const info = gapInfo(g.board, gap)
  if (info.state !== 'ready' || !info.options.includes(from)) return g
  const board = g.board.slice()
  board[gap] = board[from]
  board[from] = null
  return { ...g, board, moves: g.moves + 1 }
}

/** Gathers every card that is not locked, shuffles them with the four gaps, and deals them back into the unlocked places. */
export function nextRound(g: Gaps, rng: Rng = Math.random): Gaps {
  if (g.round >= MAX_ROUNDS) return g
  const locked = lockedMask(g.board)
  const slots = g.board.flatMap((_, i) => (locked[i] ? [] : [i]))
  const pool: Slot[] = [...g.board.filter((c, i) => c !== null && !locked[i]), ...Array<Slot>(ROWS).fill(null)]
  for (let tries = 0; ; tries++) {
    const mixed = shuffle(pool, rng)
    const board = g.board.slice()
    slots.forEach((s, k) => { board[s] = mixed[k] })
    if (tries > 200 || !roundOver(board)) return { board, round: g.round + 1, moves: g.moves }
  }
}

/** The best move to make now, found by looking ahead for the most locked value this round, or null when no gap can move. */
export function hint(g: Gaps, limit = 60000): { gap: number; from: number } | null {
  const memo = new Map<string, number>()
  let nodes = 0
  const key = (b: readonly Slot[]) => b.map((c) => (c ? c.id : -1)).join(',')
  const value = (b: readonly Slot[]): number => {
    const k = key(b)
    const got = memo.get(k)
    if (got !== undefined) return got
    const ready = allGaps(b).filter((x) => x.state === 'ready')
    let best = score(b)
    if (nodes++ < limit) {
      for (const x of ready) {
        for (const from of x.options) {
          const n = b.slice()
          n[x.index] = n[from]
          n[from] = null
          best = Math.max(best, value(n))
        }
      }
    }
    memo.set(k, best)
    return best
  }
  let pick: { gap: number; from: number } | null = null
  let most = -1
  for (const x of allGaps(g.board).filter((y) => y.state === 'ready')) {
    for (const from of x.options) {
      const n = g.board.slice()
      n[x.index] = n[from]
      n[from] = null
      const v = value(n)
      if (v > most) { most = v; pick = { gap: x.index, from } }
    }
  }
  return pick
}
