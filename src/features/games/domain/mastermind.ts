import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Mastermind (Bulls and Cows with colours). One side makes a secret code of coloured pegs (repeats allowed); the other guesses, and after each guess is told how many pegs are the right
 * colour in the right place (black) and how many are the right colour in the wrong place (white). You can break the computer's code, or make a code for the computer to break.
 */
export type MindSizeId = 'easy' | 'classic' | 'hard'
export const SIZES: Record<MindSizeId, { colours: number; length: number; tries: number }> = { easy: { colours: 5, length: 3, tries: 10 }, classic: { colours: 6, length: 4, tries: 10 }, hard: { colours: 8, length: 5, tries: 12 } }
export const SIZE_IDS: readonly MindSizeId[] = ['easy', 'classic', 'hard']
export type Code = number[]
export interface Feedback { black: number; white: number }

export function score(secret: readonly number[], guess: readonly number[]): Feedback {
  let black = 0
  const s = new Map<number, number>(), g = new Map<number, number>()
  secret.forEach((v, i) => { if (v === guess[i]) black++; else { s.set(v, (s.get(v) ?? 0) + 1); g.set(guess[i], (g.get(guess[i]) ?? 0) + 1) } })
  let white = 0
  for (const [v, n] of g) white += Math.min(n, s.get(v) ?? 0)
  return { black, white }
}
export const sameFeedback = (a: Feedback, b: Feedback): boolean => a.black === b.black && a.white === b.white

export function allCodes(colours: number, length: number): Code[] {
  const out: Code[] = []
  const go = (cur: number[]) => { if (cur.length === length) { out.push(cur); return } for (let c = 0; c < colours; c++) go([...cur, c]) }
  go([])
  return out
}
export const randomCode = (colours: number, length: number, rng: Rng = Math.random): Code => Array.from({ length }, () => Math.floor(rng() * colours))

export interface Turn { guess: Code; feedback: Feedback }
/** The codes that could still be the secret, given what the guesses so far were told. */
export const consistent = (all: readonly Code[], turns: readonly Turn[]): Code[] => all.filter((c) => turns.every((t) => sameFeedback(score(c, t.guess), t.feedback)))

/**
 * The computer's guess when it is the one guessing. It sees only the feedback it has been given. Cadet guesses any code that fits so far, sometimes ignoring a clue; Captain always guesses a code
 * that fits; Admiral picks the guess that splits the remaining possibilities most evenly (the smallest worst case), preferring one that could be right.
 */
export function chooseGuess(all: readonly Code[], turns: readonly Turn[], skill: Skill, rng: Rng = Math.random): Code {
  if (turns.length === 0) {
    const len = all[0].length
    const colours = Math.max(...all[0].map(() => 0), ...all.map((c) => Math.max(...c))) + 1
    return Array.from({ length: len }, (_, i) => (skill === 'cadet' ? Math.floor(rng() * colours) : Math.floor((i * 2) / len) % colours))
  }
  const left = skill === 'cadet' && rng() < 0.25 ? consistent(all, turns.slice(0, -1)) : consistent(all, turns)
  const pool = left.length ? left : all.slice()
  if (skill !== 'admiral' || pool.length <= 2) return pool[Math.floor(rng() * pool.length)]
  const sample = pool.length > 120 ? Array.from({ length: 120 }, () => pool[Math.floor(rng() * pool.length)]) : pool
  const probes = pool.length > 400 ? sample : all.length > 1500 ? sample : all
  let best = pool[0], worst = Infinity
  for (const p of probes) {
    const buckets = new Map<string, number>()
    for (const c of sample) { const f = score(c, p); const k = `${f.black}${f.white}`; buckets.set(k, (buckets.get(k) ?? 0) + 1) }
    const w = Math.max(...buckets.values()) - (pool.includes(p) ? 0.5 : 0)
    if (w < worst) { worst = w; best = p }
  }
  return best
}
