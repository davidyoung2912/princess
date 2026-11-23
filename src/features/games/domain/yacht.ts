import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Yacht: five dice, up to three rolls a turn (keep any you like between rolls), then score the result in one of twelve categories, each only once. Highest total after twelve turns wins.
 */
export const CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'fullHouse', 'fourKind', 'littleStraight', 'bigStraight', 'choice', 'yacht'] as const
export type Cat = (typeof CATS)[number]
export type Card = (number | null)[]
export interface Yacht { /** How many turns each side takes (twelve, or six in a quick game). */ rounds: number; dice: number[]; held: boolean[]; rollsLeft: number; rolled: boolean; cards: [Card, Card]; turn: 0 | 1 }

export const start = (rounds = 12): Yacht => ({ rounds, dice: [1, 1, 1, 1, 1], held: Array(5).fill(false), rollsLeft: 3, rolled: false, cards: [Array(12).fill(null), Array(12).fill(null)], turn: 0 })

const counts = (d: readonly number[]): number[] => { const c = Array(7).fill(0); for (const x of d) c[x]++; return c }
const sum = (d: readonly number[]) => d.reduce((a, b) => a + b, 0)

/** The score `dice` would get in `cat`. */
export function scoreOf(cat: Cat, d: readonly number[]): number {
  const c = counts(d)
  const i = CATS.indexOf(cat)
  if (i < 6) return c[i + 1] * (i + 1)
  switch (cat) {
    case 'fullHouse': return c.includes(3) && c.includes(2) ? sum(d) : c.includes(5) ? 0 : 0
    case 'fourKind': { const v = c.findIndex((x) => x >= 4); return v > 0 ? 4 * v : 0 }
    case 'littleStraight': return [1, 2, 3, 4, 5].every((v) => c[v] >= 1) ? 30 : 0
    case 'bigStraight': return [2, 3, 4, 5, 6].every((v) => c[v] >= 1) ? 30 : 0
    case 'choice': return sum(d)
    case 'yacht': return c.includes(5) ? 50 : 0
    default: return 0
  }
}
export const total = (card: Card): number => card.reduce<number>((a, b) => a + (b ?? 0), 0)
export const isOver = (g: Yacht): boolean => g.cards.every((c) => c.filter((x) => x !== null).length >= g.rounds)
export const open = (card: Card): Cat[] => CATS.filter((_, i) => card[i] === null)
export const winner = (g: Yacht): 0 | 1 | 2 => { const a = total(g.cards[0]), b = total(g.cards[1]); return a === b ? 0 : a > b ? 1 : 2 }

/** Rolls the dice that are not held, with the values supplied by `rng`. */
export function roll(g: Yacht, rng: Rng = Math.random): Yacht {
  if (g.rollsLeft === 0 || isOver(g)) return g
  const dice = g.dice.map((v, i) => (g.rolled && g.held[i] ? v : 1 + Math.floor(rng() * 6)))
  return { ...g, dice, rolled: true, rollsLeft: g.rollsLeft - 1 }
}
export const toggleHold = (g: Yacht, i: number): Yacht => (g.rolled && g.rollsLeft > 0 ? { ...g, held: g.held.map((h, k) => (k === i ? !h : h)) } : g)
export function score(g: Yacht, cat: Cat): Yacht {
  if (!g.rolled) return g
  const idx = CATS.indexOf(cat)
  if (g.cards[g.turn][idx] !== null) return g
  const cards: [Card, Card] = [g.cards[0].slice(), g.cards[1].slice()]
  cards[g.turn][idx] = scoreOf(cat, g.dice)
  return { ...g, cards, turn: (1 - g.turn) as 0 | 1, rolled: false, rollsLeft: 3, held: Array(5).fill(false) }
}

/** The usual score in each category, so a score is judged by how far it is above or below what is normal for it. */
const PAR: Record<Cat, number> = { ones: 2.1, twos: 4.2, threes: 6.3, fours: 8.4, fives: 10.5, sixes: 12.6, fullHouse: 10, fourKind: 9, littleStraight: 14, bigStraight: 14, choice: 22, yacht: 5 }
const edge = (cat: Cat, d: readonly number[]) => scoreOf(cat, d) - PAR[cat]

/** The best category for these dice, by score above par; ties go to the one with the lowest par (so the spare ones are dropped first). */
export function bestCategory(card: Card, d: readonly number[]): Cat {
  const cats = open(card)
  return cats.slice().sort((a, b) => edge(b, d) - edge(a, d) || PAR[a] - PAR[b])[0]
}

/** All distinct outcomes of rolling k dice, with their probability. */
const OUTCOMES = new Map<number, { dice: number[]; p: number }[]>()
function outcomes(k: number): { dice: number[]; p: number }[] {
  const hit = OUTCOMES.get(k)
  if (hit) return hit
  const out = new Map<string, { dice: number[]; n: number }>()
  const go = (left: number, cur: number[]) => {
    if (left === 0) { const key = cur.slice().sort().join(''); const e = out.get(key); if (e) e.n++; else out.set(key, { dice: cur.slice().sort(), n: 1 }); return }
    for (let v = 1; v <= 6; v++) go(left - 1, [...cur, v])
  }
  go(k, [])
  const all = [...out.values()].map((e) => ({ dice: e.dice, p: e.n / 6 ** k }))
  OUTCOMES.set(k, all)
  return all
}

/** The dice to keep for the best chance at a good score with `rolls` rolls left: tries every way of keeping dice and averages over what could come up (the value of a finished set of dice is its best category above par). */
export function bestHold(card: Card, dice: readonly number[], rolls: number): boolean[] {
  const cats = open(card)
  const memo = new Map<string, number>()
  const final = (d: readonly number[]) => Math.max(...cats.map((c) => edge(c, d)))
  const value = (d: number[], r: number): number => {
    const key = d.join('') + r
    const m = memo.get(key)
    if (m !== undefined) return m
    let best = final(d)
    if (r > 0) best = Math.max(best, holdValue(d, r).v)
    memo.set(key, best)
    return best
  }
  const holdValue = (d: number[], r: number): { v: number; mask: number } => {
    let bestV = -Infinity, bestMask = 31
    for (let mask = 0; mask < 32; mask++) {
      const kept = d.filter((_, i) => mask & (1 << i))
      const k = 5 - kept.length
      let v = 0
      for (const o of outcomes(k)) v += o.p * value([...kept, ...o.dice].sort(), r - 1)
      if (mask === 31) v = final(d)
      if (v > bestV + 1e-9) { bestV = v; bestMask = mask }
    }
    return { v: bestV, mask: bestMask }
  }
  const sorted = dice.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const { mask } = holdValue(sorted.map((x) => x.v), rolls)
  const held = Array(5).fill(false)
  sorted.forEach((x, k) => { if (mask & (1 << k)) held[x.i] = true })
  return held
}

/** A simple rule: keep the most common value (the highest on a tie). */
function greedyHold(dice: readonly number[]): boolean[] {
  const c = counts(dice)
  let best = 6
  for (let v = 6; v >= 1; v--) if (c[v] > c[best]) best = v
  return dice.map((v) => v === best)
}

export type Action = { kind: 'roll'; held: boolean[] } | { kind: 'score'; cat: Cat }

/** The computer's next single action: roll (with the dice it keeps) or score. Cadet keeps dice loosely and scores the first decent category; Captain keeps the most common value and scores sensibly; Admiral works out the best dice to keep from the odds. */
export function choose(g: Yacht, skill: Skill, rng: Rng = Math.random): Action {
  const card = g.cards[g.turn]
  if (!g.rolled) return { kind: 'roll', held: Array(5).fill(false) }
  const cat = bestCategory(card, g.dice)
  if (g.rollsLeft === 0) return { kind: 'score', cat }
  if (skill === 'cadet') {
    if (scoreOf(cat, g.dice) >= PAR[cat] + 4 || rng() < 0.15) return { kind: 'score', cat }
    return { kind: 'roll', held: rng() < 0.4 ? g.dice.map(() => rng() < 0.5) : greedyHold(g.dice) }
  }
  if (skill === 'captain') {
    if (edge(cat, g.dice) >= 8 || scoreOf('yacht', g.dice) === 50 && card[11] === null) return { kind: 'score', cat }
    return { kind: 'roll', held: greedyHold(g.dice) }
  }
  const held = bestHold(card, g.dice, g.rollsLeft)
  if (held.every(Boolean)) return { kind: 'score', cat }
  return { kind: 'roll', held }
}
export function act(g: Yacht, a: Action, rng: Rng = Math.random): Yacht {
  if (a.kind === 'score') return score(g, a.cat)
  return roll({ ...g, held: g.rolled ? a.held : g.held }, rng)
}
