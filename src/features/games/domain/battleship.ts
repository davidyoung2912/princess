/**
 * Battleship against the app. Rules follow the Milton Bradley / Hasbro classic: two fleets on a square grid, ships lie straight (across or down) and never overlap, players take turns
 * calling one square, the answer is hit or miss (and "you sank my ...") and the first to sink the whole opposing fleet wins.
 *
 * Fairness: the computer opponent only ever works from `AiView`, which holds what a human opponent would know (its own earlier shots, which were hits, which ships it has sunk). It is never
 * handed the player's ship positions, so it cannot cheat. Framework-free, so it is unit tested in node.
 */

export type Rng = () => number
export type Orientation = 'across' | 'down'
export type Skill = 'cadet' | 'captain' | 'admiral'
export type SizeId = 'small' | 'classic' | 'large'

export const SKILLS: readonly Skill[] = ['cadet', 'captain', 'admiral']

/** Ship kinds. `name` is a key used for text; `length` is the number of squares. */
export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer' | 'patrol' | 'frigate'
export const SHIP_LENGTH: Record<ShipKind, number> = { carrier: 5, battleship: 4, cruiser: 3, submarine: 3, destroyer: 2, patrol: 1, frigate: 3 }

export interface SizeSpec { id: SizeId; n: number; fleet: readonly ShipKind[] }
export const SIZES: Record<SizeId, SizeSpec> = {
  small: { id: 'small', n: 8, fleet: ['battleship', 'cruiser', 'submarine', 'destroyer'] },
  /** The official fleet: 5, 4, 3, 3, 2 on 10 by 10. */
  classic: { id: 'classic', n: 10, fleet: ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'] },
  large: { id: 'large', n: 12, fleet: ['carrier', 'battleship', 'cruiser', 'submarine', 'frigate', 'destroyer', 'patrol'] },
}
export const SIZE_IDS: readonly SizeId[] = ['small', 'classic', 'large']

export interface Ship { id: number; kind: ShipKind; row: number; col: number; dir: Orientation; length: number }
export type Shot = 0 | 1 | 2 // not fired at, miss, hit

/** One side's waters: the ships, and the shots the other side has fired at them. */
export interface Waters { n: number; ships: Ship[]; shots: Shot[] }

/** Cell indexes of a ship on an n-wide board. */
export const shipCells = (s: Pick<Ship, 'row' | 'col' | 'dir' | 'length'>, n: number): number[] =>
  Array.from({ length: s.length }, (_, k) => (s.dir === 'across' ? s.row * n + s.col + k : (s.row + k) * n + s.col))

export const fits = (n: number, s: Pick<Ship, 'row' | 'col' | 'dir' | 'length'>): boolean =>
  s.row >= 0 && s.col >= 0 && (s.dir === 'across' ? s.col + s.length <= n && s.row < n : s.row + s.length <= n && s.col < n)

/** Whether `ship` can be added to `ships` (inside the board, not on another ship). `ignore` is a ship id being moved. */
export function canPlace(n: number, ships: readonly Ship[], ship: Pick<Ship, 'row' | 'col' | 'dir' | 'length'>, ignore?: number): boolean {
  if (!fits(n, ship)) return false
  const taken = new Set(ships.filter((s) => s.id !== ignore).flatMap((s) => shipCells(s, n)))
  return shipCells(ship, n).every((c) => !taken.has(c))
}

/** A random legal layout of the whole fleet. */
export function randomFleet(size: SizeId, rng: Rng = Math.random): Ship[] {
  const { n, fleet } = SIZES[size]
  for (;;) {
    const ships: Ship[] = []
    let ok = true
    // Longest first so the big ships always find room.
    const order = fleet.map((kind, id) => ({ kind, id })).sort((a, b) => SHIP_LENGTH[b.kind] - SHIP_LENGTH[a.kind])
    for (const { kind, id } of order) {
      const length = SHIP_LENGTH[kind]
      let placed = false
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const dir: Orientation = rng() < 0.5 ? 'across' : 'down'
        const cand = { id, kind, length, dir, row: Math.floor(rng() * n), col: Math.floor(rng() * n) }
        if (canPlace(n, ships, cand)) { ships.push(cand); placed = true }
      }
      if (!placed) { ok = false; break }
    }
    if (ok) return ships.sort((a, b) => a.id - b.id)
  }
}

export const newWaters = (size: SizeId, ships: Ship[]): Waters => ({ n: SIZES[size].n, ships, shots: Array<Shot>(SIZES[size].n ** 2).fill(0) })

/** The ship on a square, if any. */
export const shipAt = (w: Waters, index: number): Ship | undefined => w.ships.find((s) => shipCells(s, w.n).includes(index))

export const isSunk = (w: Waters, s: Ship): boolean => shipCells(s, w.n).every((c) => w.shots[c] === 2)
export const sunkShips = (w: Waters): Ship[] => w.ships.filter((s) => isSunk(w, s))
export const fleetSunk = (w: Waters): boolean => w.ships.every((s) => isSunk(w, s))

export interface FireResult { waters: Waters; hit: boolean; sunk: Ship | null; won: boolean }

/** Fires at a square. Firing at a square already called changes nothing (hit is false and the waters are returned as they were). */
export function fire(w: Waters, index: number): FireResult & { repeat: boolean } {
  if (index < 0 || index >= w.shots.length || w.shots[index] !== 0) return { waters: w, hit: false, sunk: null, won: false, repeat: true }
  const ship = shipAt(w, index)
  const shots = w.shots.slice()
  shots[index] = ship ? 2 : 1
  const next = { ...w, shots }
  const sunk = ship && isSunk(next, ship) ? ship : null
  return { waters: next, hit: !!ship, sunk, won: fleetSunk(next), repeat: false }
}

/* ---------------------------------------------------------------------------------------------- the computer opponent */

/** Everything the computer knows about the player's waters: nothing about unfired squares. Hits that belong to a ship it has sunk are listed in `sunk`. */
export interface AiView { n: number; shots: Shot[]; sunk: { kind: ShipKind; cells: number[] }[]; fleet: readonly ShipKind[] }

/** Builds the view from the player's waters, exposing only what the shots have revealed. */
export function aiViewOf(w: Waters, size: SizeId): AiView {
  return { n: w.n, shots: w.shots.slice(), sunk: sunkShips(w).map((s) => ({ kind: s.kind, cells: shipCells(s, w.n) })), fleet: SIZES[size].fleet }
}

/** Fleet lengths still afloat, by what the view shows. */
const remainingLengths = (v: AiView): number[] => {
  const left = v.fleet.map((k) => SHIP_LENGTH[k])
  for (const s of v.sunk) { const at = left.indexOf(SHIP_LENGTH[s.kind]); if (at >= 0) left.splice(at, 1) }
  return left
}

/** Hits not yet explained by a sunk ship: the live trail to follow. */
const openHits = (v: AiView): number[] => {
  const done = new Set(v.sunk.flatMap((s) => s.cells))
  return v.shots.flatMap((s, i) => (s === 2 && !done.has(i) ? [i] : []))
}

const unfired = (v: AiView): number[] => v.shots.flatMap((s, i) => (s === 0 ? [i] : []))

const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]

const neighbours = (i: number, n: number): number[] => {
  const r = Math.floor(i / n), c = i % n
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((x) => x >= 0)
}

/**
 * How many ways the ships still afloat could lie across each square, given what is known: a placement may not cover a miss or a square of a sunk ship. Placements that cover an open hit count
 * much more (the unexplained hits must belong to some ship), which is what makes the hunt follow a trail and finish it along the right line.
 */
export function densityMap(v: AiView): number[] {
  const { n } = v
  const dead = new Set(v.sunk.flatMap((s) => s.cells))
  const hits = new Set(openHits(v))
  const score = Array<number>(n * n).fill(0)
  for (const length of remainingLengths(v)) {
    for (const dir of ['across', 'down'] as const) {
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const ship = { row, col, dir, length }
          if (!fits(n, ship)) continue
          const cells = shipCells(ship, n)
          if (cells.some((c) => v.shots[c] === 1 || dead.has(c))) continue
          const covered = cells.filter((c) => hits.has(c)).length
          const weight = covered === 0 ? 1 : 40 ** covered
          for (const c of cells) if (v.shots[c] === 0) score[c] += weight
        }
      }
    }
  }
  return score
}

/** The square the computer calls next. Uses nothing but `v`. */
export function chooseShot(v: AiView, skill: Skill, rng: Rng = Math.random): number {
  const open = unfired(v)
  if (open.length === 0) return -1
  const trail = openHits(v)

  if (skill === 'cadet') {
    // Calls at random; when it has a hit it usually tries next to it, but it forgets lines and gives up now and then.
    const near = trail.flatMap((h) => neighbours(h, v.n)).filter((c) => v.shots[c] === 0)
    if (near.length > 0 && rng() < 0.7) return pick(near, rng)
    return pick(open, rng)
  }

  if (skill === 'captain') {
    // A sound ordinary player: follows a trail, continues along a line of two hits, hunts on a checkerboard.
    if (trail.length > 0) {
      const lined: number[] = []
      for (const h of trail) {
        for (const nb of trail) {
          const d = nb - h
          if (nb > h && (d === 1 || d === v.n) && (d !== 1 || Math.floor(h / v.n) === Math.floor(nb / v.n))) {
            for (const end of [h - d, nb + d]) {
              if (end >= 0 && end < v.n * v.n && v.shots[end] === 0 && (d !== 1 || Math.floor(end / v.n) === Math.floor(h / v.n))) lined.push(end)
            }
          }
        }
      }
      if (lined.length > 0) return pick(lined, rng)
      const near = trail.flatMap((h) => neighbours(h, v.n)).filter((c) => v.shots[c] === 0)
      if (near.length > 0) return pick(near, rng)
    }
    const smallest = Math.min(...remainingLengths(v))
    const parity = open.filter((i) => (Math.floor(i / v.n) + (i % v.n)) % smallest === 0)
    return pick(parity.length > 0 ? parity : open, rng)
  }

  // Admiral: always the square the most possible ship placements run through, with a small centre bias among ties.
  const map = densityMap(v)
  let best = -1
  let pool: number[] = []
  for (const i of open) {
    if (map[i] > best) { best = map[i]; pool = [i] } else if (map[i] === best) pool.push(i)
  }
  return pick(pool, rng)
}

/* ---------------------------------------------------------------------------------------------- the match */

export interface Match {
  size: SizeId
  skill: Skill
  /** The player's waters (their own ships, shots the computer has fired). */
  mine: Waters
  /** The computer's waters (its hidden ships, the player's shots). */
  theirs: Waters
  turn: 'player' | 'computer'
  winner: 'player' | 'computer' | null
  shotsMine: number
  shotsTheirs: number
}

export function newMatch(size: SizeId, skill: Skill, myShips: Ship[], rng: Rng = Math.random): Match {
  return { size, skill, mine: newWaters(size, myShips), theirs: newWaters(size, randomFleet(size, rng)), turn: 'player', winner: null, shotsMine: 0, shotsTheirs: 0 }
}

export interface Turn { match: Match; index: number; hit: boolean; sunk: Ship | null }

/** The player calls a square. Does nothing unless it is the player's turn and the square is new. */
export function playerFires(m: Match, index: number): Turn | null {
  if (m.winner || m.turn !== 'player') return null
  const r = fire(m.theirs, index)
  if (r.repeat) return null
  return { match: { ...m, theirs: r.waters, shotsMine: m.shotsMine + 1, turn: r.won ? 'player' : 'computer', winner: r.won ? 'player' : null }, index, hit: r.hit, sunk: r.sunk }
}

/** The computer calls a square, chosen from what it can see. */
export function computerFires(m: Match, rng: Rng = Math.random): Turn | null {
  if (m.winner || m.turn !== 'computer') return null
  const index = chooseShot(aiViewOf(m.mine, m.size), m.skill, rng)
  if (index < 0) return null
  const r = fire(m.mine, index)
  return { match: { ...m, mine: r.waters, shotsTheirs: m.shotsTheirs + 1, turn: r.won ? 'computer' : 'player', winner: r.won ? 'computer' : null }, index, hit: r.hit, sunk: r.sunk }
}

/** A short accuracy figure for the end card. */
export const accuracy = (hits: number, shots: number): number => (shots === 0 ? 0 : Math.round((hits / shots) * 100))
export const hitsOn = (w: Waters): number => w.shots.filter((s) => s === 2).length
