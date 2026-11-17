import { WORDLE_WORDS } from './wordleWords'

/** Framework-free rules for Cruise Wordle: guess the five-letter word in six tries. */
export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

/** How one letter of a guess scored: right letter in the right place, right letter in the wrong place, or not in the word. */
export type LetterState = 'correct' | 'present' | 'absent'

export type GameStatus = 'playing' | 'won' | 'lost'

export interface WordleGame {
  target: string
  /** The submitted guesses, in order. */
  guesses: readonly string[]
  /** The letters typed on the row being filled. */
  current: string
  status: GameStatus
}

export type SubmitProblem = 'short' | 'letters' | 'over'

/** Scores a guess against the target. Repeated letters are counted properly: a letter is only marked as many times as it appears in the target. */
export function scoreGuess(guess: string, target: string): LetterState[] {
  const result: LetterState[] = Array.from({ length: guess.length }, () => 'absent')
  const spare = new Map<string, number>()
  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) result[i] = 'correct'
    else spare.set(target[i], (spare.get(target[i]) ?? 0) + 1)
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue
    const left = spare.get(guess[i]) ?? 0
    if (left > 0) { result[i] = 'present'; spare.set(guess[i], left - 1) }
  }
  return result
}

const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }

/** The best result seen so far for each letter, for colouring the on-screen keyboard. A letter never goes back to a worse state. */
export function keyStates(guesses: readonly string[], target: string): Record<string, LetterState> {
  const out: Record<string, LetterState> = {}
  for (const g of guesses) {
    scoreGuess(g, target).forEach((s, i) => {
      const prev = out[g[i]]
      if (prev === undefined || RANK[s] > RANK[prev]) out[g[i]] = s
    })
  }
  return out
}

/** Picks the answer. `random` is injectable for tests; the word just played is not picked again straight away. */
export function pickTarget(random: () => number = Math.random, avoid?: string, words: readonly string[] = WORDLE_WORDS): string {
  const pool = words.length > 1 ? words.filter((w) => w !== avoid) : words
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

export const newGame = (target: string): WordleGame => ({ target: target.toUpperCase(), guesses: [], current: '', status: 'playing' })

/** Adds a typed letter to the row being filled; anything that is not A to Z, or a full row, is ignored. */
export function typeLetter(game: WordleGame, key: string): WordleGame {
  const letter = key.toUpperCase()
  if (game.status !== 'playing' || !/^[A-Z]$/.test(letter) || game.current.length >= WORD_LENGTH) return game
  return { ...game, current: game.current + letter }
}

export function backspace(game: WordleGame): WordleGame {
  return game.status !== 'playing' || game.current === '' ? game : { ...game, current: game.current.slice(0, -1) }
}

/** Submits the row. A short row is refused (nothing is used up) and the game comes back unchanged with the reason. */
export function submitGuess(game: WordleGame): { game: WordleGame; problem?: SubmitProblem } {
  if (game.status !== 'playing') return { game, problem: 'over' }
  if (game.current.length < WORD_LENGTH) return { game, problem: 'short' }
  if (!/^[A-Z]{5}$/.test(game.current)) return { game, problem: 'letters' }
  const guesses = [...game.guesses, game.current]
  const status: GameStatus = game.current === game.target ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing'
  return { game: { ...game, guesses, current: '', status } }
}

const EMOJI: Record<LetterState, string> = { correct: '🟩', present: '🟨', absent: '⬛' }

/** The result as text to share or paste: a title line and a grid of squares, without giving away the word. */
export function shareText(game: WordleGame, title: string): string {
  const score = game.status === 'won' ? `${game.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`
  const rows = game.guesses.map((g) => scoreGuess(g, game.target).map((s) => EMOJI[s]).join(''))
  return [`${title} ${score}`, '', ...rows].join('\n')
}
