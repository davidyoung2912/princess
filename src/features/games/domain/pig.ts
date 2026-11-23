import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Pig: on your turn keep rolling one die and add the rolls to your turn total, or hold to bank it. Roll a 1 and you lose the turn total and the turn passes. First to the target wins.
 * Three targets give a quick, a classic and a long game.
 */
export type PigTargetId = 'quick' | 'classic' | 'long'
export const TARGETS: Record<PigTargetId, number> = { quick: 50, classic: 100, long: 150 }
export const TARGET_IDS: readonly PigTargetId[] = ['quick', 'classic', 'long']
export interface Pig { target: number; scores: [number, number]; turn: 0 | 1; total: number; roll: number | null; winner: 0 | 1 | 2 }

export const start = (target: number): Pig => ({ target, scores: [0, 0], turn: 0, total: 0, roll: null, winner: 0 })
export const rollDie = (rng: Rng = Math.random): number => 1 + Math.floor(rng() * 6)

/** Applies a rolled value (so tests and the screen can supply it). */
export function rollWith(g: Pig, value: number): Pig {
  if (g.winner) return g
  if (value === 1) return { ...g, total: 0, roll: 1, turn: (1 - g.turn) as 0 | 1 }
  const total = g.total + value
  return { ...g, total, roll: value }
}
export function hold(g: Pig): Pig {
  if (g.winner || g.total === 0) return g
  const scores: [number, number] = [g.scores[0], g.scores[1]]
  scores[g.turn] += g.total
  if (scores[g.turn] >= g.target) return { ...g, scores, total: 0, winner: (g.turn + 1) as 1 | 2 }
  return { ...g, scores, total: 0, roll: null, turn: (1 - g.turn) as 0 | 1 }
}

/**
 * Whether the computer holds now. Cadet holds at a loose, jumpy amount; Captain holds at 20, the well-known simple rule; Admiral adjusts that to the score: it keeps rolling when behind, banks
 * sooner when well ahead, goes for the win when it is in reach, and races when the other side is about to win. It only looks at the scores and its own turn total.
 */
export function shouldHold(g: Pig, skill: Skill, rng: Rng = Math.random): boolean {
  if (g.total === 0) return false
  const me = g.scores[g.turn], them = g.scores[1 - g.turn]
  if (me + g.total >= g.target) return true
  if (skill === 'cadet') return g.total >= 8 + Math.floor(rng() * 16)
  if (skill === 'captain') return g.total >= 20
  let goal = 21 + (them - me) / 8
  if (them >= g.target - 25) goal = Math.max(goal, Math.min(g.target - me, 40))
  if (me >= g.target - 25 && them < me) goal = Math.min(goal, g.target - me)
  return g.total >= Math.max(10, Math.min(goal, 40))
}
