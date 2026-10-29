/** A small seeded random-number generator (mulberry32): the same seed always gives the same sequence, so a scenario replays identically. */
export interface Rng {
  /** A number in [0, 1). */
  next(): number
  /** A whole number in [min, max]. */
  between(min: number, max: number): number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, between: (min, max) => min + Math.floor(next() * (max - min + 1)) }
}
