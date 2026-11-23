import type { Rng } from './cards'
import type { Skill } from './search'

/**
 * Backgammon: 24 points, 15 discs each, two dice. You (white, side 0) move from point 24 down to 1 and bear off past 1; the computer (side 1) moves the other way.
 * Points are indexed 0..23 with white's home board at 0..5 and black's at 18..23. A lone disc can be hit and sent to the bar; discs on the bar must re-enter first.
 * Once all of a side's discs are home it may bear off. A roll of doubles gives four moves. You must use as many dice as you can. Plain scoring (no doubling cube).
 */
export type Side = 0 | 1
export interface Backgammon {
  /** Positive: white discs, negative: black discs. */
  points: number[]
  bar: [number, number]
  off: [number, number]
  turn: Side
  dice: number[]
  /** Dice still to play this turn. */
  left: number[]
  winner: 0 | 1 | 2
  last: Step | null
}
export interface Step { from: number | 'bar'; to: number | 'off'; hit: boolean; die: number }

export const start = (): Backgammon => {
  const points = Array(24).fill(0)
  // White moves toward 0.
  points[23] = 2; points[12] = 5; points[7] = 3; points[5] = 5
  points[0] = -2; points[11] = -5; points[16] = -3; points[18] = -5
  return { points, bar: [0, 0], off: [0, 0], turn: 0, dice: [], left: [], winner: 0, last: null }
}

const sign = (s: Side) => (s === 0 ? 1 : -1)
const dir = (s: Side) => (s === 0 ? -1 : 1)
const mine = (g: Backgammon, i: number, s: Side) => g.points[i] * sign(s) > 0
const enemyCount = (g: Backgammon, i: number, s: Side) => Math.max(0, -g.points[i] * sign(s))
const entry = (s: Side, die: number) => (s === 0 ? 24 - die : die - 1)

export function rollDice(rng: Rng = Math.random): number[] {
  const a = 1 + Math.floor(rng() * 6), b = 1 + Math.floor(rng() * 6)
  return a === b ? [a, a, a, a] : [a, b]
}
export function withDice(g: Backgammon, dice: number[]): Backgammon { return { ...g, dice, left: dice.slice() } }

const allHome = (g: Backgammon, s: Side): boolean => {
  if (g.bar[s] > 0) return false
  for (let i = 0; i < 24; i++) if (mine(g, i, s) && (s === 0 ? i > 5 : i < 18)) return false
  return true
}
/** The farthest-from-home occupied point's distance to off for side s, used to allow bearing off with larger dice. */
const distOff = (s: Side, i: number) => (s === 0 ? i + 1 : 24 - i)

/** Every single step the side to move could make with one of the remaining dice. */
export function steps(g: Backgammon): Step[] {
  if (g.winner) return []
  const s = g.turn
  const out: Step[] = []
  for (const die of [...new Set(g.left)]) {
    if (g.bar[s] > 0) {
      const to = entry(s, die)
      if (enemyCount(g, to, s) < 2) out.push({ from: 'bar', to, hit: enemyCount(g, to, s) === 1, die })
      continue
    }
    const home = allHome(g, s)
    for (let i = 0; i < 24; i++) {
      if (!mine(g, i, s)) continue
      const to = i + dir(s) * die
      if (to >= 0 && to < 24) { if (enemyCount(g, to, s) < 2) out.push({ from: i, to, hit: enemyCount(g, to, s) === 1, die }) }
      else if (home) {
        const d = distOff(s, i)
        if (d === die) out.push({ from: i, to: 'off', hit: false, die })
        else if (d < die) {
          // Larger die than needed: allowed only if no disc is farther back.
          let farther = false
          for (let k = 0; k < 24; k++) if (mine(g, k, s) && distOff(s, k) > d) farther = true
          if (!farther) out.push({ from: i, to: 'off', hit: false, die })
        }
      }
    }
  }
  return out
}

export function applyStep(g: Backgammon, st: Step): Backgammon {
  const s = g.turn
  const points = g.points.slice()
  const bar: [number, number] = [g.bar[0], g.bar[1]]
  const off: [number, number] = [g.off[0], g.off[1]]
  if (st.from === 'bar') bar[s]--
  else points[st.from] -= sign(s)
  if (st.to === 'off') off[s]++
  else {
    if (st.hit) { points[st.to] = 0; bar[1 - s]++ }
    points[st.to] += sign(s)
  }
  const left = g.left.slice()
  left.splice(left.indexOf(st.die), 1)
  const winner: Backgammon['winner'] = off[s] === 15 ? ((s + 1) as 1 | 2) : 0
  return { ...g, points, bar, off, left, winner, last: st }
}

/** Plays the dice rules: the longest sequences must be played, and if only one die can be used it must be the larger. Returns the legal first steps. */
export function legalSteps(g: Backgammon): Step[] {
  const first = steps(g)
  if (first.length === 0) return []
  const best = maxDepth(g)
  const ok = first.filter((st) => maxDepth(applyStep(g, st)) === best - 1)
  if (best === 1 && g.left.length === 2 && g.left[0] !== g.left[1]) {
    const hi = Math.max(...g.left)
    const usesHi = ok.filter((s) => s.die === hi)
    if (usesHi.length) return usesHi
  }
  return ok
}
const depthMemo = new WeakMap<Backgammon, number>()
function maxDepth(g: Backgammon): number {
  const c = depthMemo.get(g)
  if (c !== undefined) return c
  let best = 0
  if (!g.winner && g.left.length) for (const st of steps(g)) { best = Math.max(best, 1 + maxDepth(applyStep(g, st))); if (best === g.left.length) break }
  depthMemo.set(g, best)
  return best
}
export const canPlay = (g: Backgammon): boolean => legalSteps(g).length > 0

/** Ends the turn: hands the dice to the other side (clearing them until they roll). */
export const endTurn = (g: Backgammon): Backgammon => ({ ...g, turn: (1 - g.turn) as Side, dice: [], left: [] })

export const pipCount = (g: Backgammon, s: Side): number => {
  let n = g.bar[s] * 25
  for (let i = 0; i < 24; i++) if (mine(g, i, s)) n += Math.abs(g.points[i]) * distOff(s, i)
  return n
}

/** A position's worth to side s: race lead, discs on the bar, blots exposed to a hit, made points and home-board points. */
function evaluate(g: Backgammon, s: Side): number {
  if (g.winner) return g.winner === s + 1 ? 1e5 : -1e5
  const o = (1 - s) as Side
  let v = (pipCount(g, o) - pipCount(g, s)) * 1.0
  v += (g.off[s] - g.off[o]) * 8
  v += (g.bar[o] - g.bar[s]) * 14
  for (let i = 0; i < 24; i++) {
    const c = g.points[i] * sign(s)
    if (c === 1) {
      // A blot is exposed to enemy discs behind it (nearer their start).
      let attackers = 0
      for (let k = 0; k < 24; k++) if (enemyCount(g, k, s) > 0 && (s === 0 ? k < i : k > i)) attackers += 1
      v -= (g.bar[o] > 0 ? 12 : 5) + Math.min(attackers, 4) * 1.5 + distOff(s, i) * 0.12
    } else if (c >= 2) {
      v += 3 + (s === 0 ? (i <= 5 ? 3 : 0) : (i >= 18 ? 3 : 0))
    }
  }
  return v
}

/** Every complete way to play the remaining dice (each a list of steps), for the computer to choose from and for the screen to validate. */
export function sequences(g: Backgammon, cap = 600): Step[][] {
  const out: Step[][] = []
  const seen = new Set<string>()
  const go = (cur: Backgammon, path: Step[]) => {
    if (out.length >= cap) return
    const next = legalSteps(cur)
    if (next.length === 0 || cur.winner) {
      const key = cur.points.join(',') + cur.bar.join() + cur.off.join()
      if (!seen.has(key)) { seen.add(key); out.push(path) }
      return
    }
    for (const st of next) go(applyStep(cur, st), [...path, st])
  }
  go(g, [])
  return out
}

/** The computer's whole turn for the dice it has been given, chosen from the position only. Cadet picks among its better-looking plays at random, Captain takes the best-looking play, Admiral also weighs the opponent's best reply over every roll. */
export function chooseTurn(g: Backgammon, skill: Skill, rng: Rng = Math.random): Step[] {
  const seqs = sequences(g)
  if (seqs.length === 0) return []
  const s = g.turn
  const after = (seq: Step[]) => seq.reduce(applyStep, g)
  const scored = seqs.map((seq) => ({ seq, v: evaluate(after(seq), s) + rng() * 0.01 })).sort((a, b) => b.v - a.v)
  if (skill === 'cadet') {
    if (rng() < 0.3) return seqs[Math.floor(rng() * seqs.length)]
    const top = scored.slice(0, 4)
    return top[Math.floor(rng() * top.length)].seq
  }
  if (skill === 'captain') return scored[0].seq
  // Admiral: for the best candidates, average the worst the opponent can do to us over every roll.
  let best = scored[0].seq
  let bestV = -Infinity
  for (const c of scored.slice(0, 8)) {
    const pos = endTurn(after(c.seq))
    if (pos.winner) return c.seq
    let total = 0
    for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) {
      const w = a === b ? 1 : 2
      const reply = withDice(pos, a === b ? [a, a, a, a] : [a, b])
      const replies = sequences(reply, 40)
      let worst = Infinity
      if (replies.length === 0) worst = evaluate(pos, s)
      for (const r of replies) worst = Math.min(worst, evaluate(r.reduce(applyStep, reply), s))
      total += w * worst
    }
    const v = total / 36
    if (v > bestV) { bestV = v; best = c.seq }
  }
  return best
}
