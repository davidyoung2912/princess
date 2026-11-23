import type { Rng } from './cards'

/**
 * A small alpha-beta search for the board games with a computer opponent. It works from the position and the legal moves only (these are all open-information games, so there is
 * nothing hidden to peek at). `value` is from player 0's point of view; the player to move at each position maximises (player 0) or minimises (player 1), so extra turns and
 * pass moves need no special handling.
 */
export interface SearchCtx<S, M> {
  moves(s: S): M[]
  apply(s: S, m: M): S
  player(s: S): 0 | 1
  over(s: S): boolean
  value(s: S): number
}

export function search<S, M>(root: S, depth: number, ctx: SearchCtx<S, M>, opts: { rng?: Rng; limit?: number } = {}): M | null {
  const rng = opts.rng ?? Math.random
  const limit = opts.limit ?? 150000
  let nodes = 0
  const go = (s: S, d: number, alpha: number, beta: number): number => {
    if (d === 0 || ctx.over(s) || nodes++ > limit) return ctx.value(s)
    const ms = ctx.moves(s)
    if (ms.length === 0) return ctx.value(s)
    const max = ctx.player(s) === 0
    let best = max ? -Infinity : Infinity
    for (const m of ms) {
      const v = go(ctx.apply(s, m), d - 1, alpha, beta)
      if (max) { if (v > best) best = v; if (best > alpha) alpha = best } else { if (v < best) best = v; if (best < beta) beta = best }
      if (beta <= alpha) break
    }
    return best
  }
  const ms = ctx.moves(root)
  if (ms.length === 0) return null
  const order = ms.map((m) => ({ m, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.m)
  const max = ctx.player(root) === 0
  let best = max ? -Infinity : Infinity
  let pick = order[0]
  let alpha = -Infinity, beta = Infinity
  for (const m of order) {
    const v = go(ctx.apply(root, m), depth - 1, alpha, beta)
    if (max ? v > best : v < best) { best = v; pick = m }
    if (max) alpha = Math.max(alpha, best); else beta = Math.min(beta, best)
  }
  return pick
}

export type Skill = 'cadet' | 'captain' | 'admiral'
export const SKILL_LIST: readonly Skill[] = ['cadet', 'captain', 'admiral']
