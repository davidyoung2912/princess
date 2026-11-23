import { describe, expect, it } from 'vitest'
import { SHIP_LENGTH, SIZES, SIZE_IDS, SKILLS, aiViewOf, canPlace, chooseShot, computerFires, densityMap, fire, newMatch, newWaters, playerFires, randomFleet, shipCells, sunkShips, type Match, type Skill, type SizeId } from './battleship'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

describe('Battleship fleets', () => {
  it('the classic fleet is the official 5, 4, 3, 3, 2 on 10 by 10', () => {
    expect(SIZES.classic.n).toBe(10)
    expect(SIZES.classic.fleet.map((k) => SHIP_LENGTH[k])).toEqual([5, 4, 3, 3, 2])
  })
  for (const size of SIZE_IDS) {
    it(`${size}: random fleets are whole, straight, in bounds and never overlap`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const { n, fleet } = SIZES[size]
        const ships = randomFleet(size, seeded(seed))
        expect(ships.map((s) => s.kind)).toEqual(fleet)
        const all = ships.flatMap((s) => shipCells(s, n))
        expect(new Set(all).size).toBe(all.length)
        expect(all.every((c) => c >= 0 && c < n * n)).toBe(true)
        ships.forEach((s) => expect(canPlace(n, ships, s, s.id)).toBe(true))
      }
    })
  }
  it('refuses a ship that runs off the board or onto another', () => {
    const ships = [{ id: 0, kind: 'cruiser' as const, row: 0, col: 0, dir: 'across' as const, length: 3 }]
    expect(canPlace(10, ships, { row: 0, col: 8, dir: 'across', length: 3 })).toBe(false)
    expect(canPlace(10, ships, { row: 0, col: 1, dir: 'down', length: 2 })).toBe(false)
    expect(canPlace(10, ships, { row: 1, col: 0, dir: 'down', length: 2 })).toBe(true)
  })
})

describe('firing', () => {
  it('reports hit, miss, sunk, repeat and win', () => {
    const ship = { id: 0, kind: 'destroyer' as const, row: 0, col: 0, dir: 'across' as const, length: 2 }
    let w = { ...newWaters('small', [ship]) }
    expect(fire(w, 9).hit).toBe(false)
    const a = fire(w, 0)
    expect([a.hit, a.sunk, a.won]).toEqual([true, null, false])
    w = a.waters
    expect(fire(w, 0).repeat).toBe(true)
    const b = fire(w, 1)
    expect([b.hit, b.sunk?.kind, b.won]).toEqual([true, 'destroyer', true])
  })
})

/** Plays a whole game of the computer against a fixed pattern of calls and returns how many shots it needed to sink the fleet. */
function shotsToSink(size: SizeId, skill: Skill, seed: number): number {
  const rng = seeded(seed)
  let m: Match = newMatch(size, skill, randomFleet(size, rng), rng)
  m = { ...m, turn: 'computer' }
  while (!m.winner) {
    const t = computerFires(m, rng)
    if (!t) throw new Error('computer could not fire')
    m = t.match.winner ? t.match : { ...t.match, turn: 'computer' }
  }
  return m.shotsTheirs
}

describe('the computer opponent', () => {
  it('always finishes the game and only calls new squares', () => {
    for (const size of SIZE_IDS) for (const skill of SKILLS) for (let s = 1; s <= 5; s++) expect(shotsToSink(size, skill, s)).toBeLessThanOrEqual(SIZES[size].n ** 2)
  })

  it('is stronger at each step up, on average', () => {
    const avg = (skill: Skill) => { let t = 0; for (let s = 1; s <= 60; s++) t += shotsToSink('classic', skill, s * 31); return t / 60 }
    const [cadet, captain, admiral] = [avg('cadet'), avg('captain'), avg('admiral')]
    expect(admiral).toBeLessThan(captain)
    expect(captain).toBeLessThan(cadet)
    expect(admiral).toBeLessThan(58)
  })

  it('never cheats: its choice depends only on the shots it has seen, never on where unsunk ships lie', () => {
    for (const skill of SKILLS) {
      for (let seed = 1; seed <= 20; seed++) {
        const a = newWaters('classic', randomFleet('classic', seeded(seed)))
        const b = newWaters('classic', randomFleet('classic', seeded(seed + 1000)))
        // Same shots on two different hidden layouts, as far as what they revealed: use shot patterns with no hits so the views are identical.
        const shots = a.shots.slice()
        const r = seeded(seed + 5)
        for (let k = 0; k < 20; k++) shots[Math.floor(r() * 100)] = 1
        const va = aiViewOf({ ...a, shots }, 'classic')
        const vb = aiViewOf({ ...b, shots }, 'classic')
        expect(vb).toEqual(va)
        expect(chooseShot(va, skill, seeded(7))).toBe(chooseShot(vb, skill, seeded(7)))
      }
    }
  })

  it('exposes nothing but shots and sunk ships in its view', () => {
    const w = newWaters('small', randomFleet('small', seeded(3)))
    const v = aiViewOf(w, 'small')
    expect(Object.keys(v).sort()).toEqual(['fleet', 'n', 'shots', 'sunk'])
    expect(v.sunk).toEqual([])
  })

  it('follows a hit: the admiral calls a square next to an open hit, and finishes a line', () => {
    const n = 10
    const w = newWaters('classic', [])
    const shots = w.shots.slice()
    shots[44] = 2
    const next = chooseShot({ n, shots, sunk: [], fleet: SIZES.classic.fleet }, 'admiral', seeded(1))
    expect([34, 54, 43, 45]).toContain(next)
    shots[45] = 2
    const line = chooseShot({ n, shots, sunk: [], fleet: SIZES.classic.fleet }, 'admiral', seeded(1))
    expect([43, 46]).toContain(line)
  })

  it('does not count squares of ships it has sunk, nor call a miss again', () => {
    const shots = Array(100).fill(0)
    shots[0] = 2; shots[1] = 2
    const v = { n: 10, shots, sunk: [{ kind: 'destroyer' as const, cells: [0, 1] }], fleet: SIZES.classic.fleet }
    const map = densityMap(v)
    expect(map[2]).toBeGreaterThan(0)
    expect(map[0]).toBe(0)
    for (const skill of SKILLS) for (let s = 1; s < 30; s++) expect(shots[chooseShot(v, skill, seeded(s))]).toBe(0)
  })
})

describe('a match', () => {
  it('alternates turns and ends when a fleet is sunk', () => {
    const rng = seeded(11)
    let m = newMatch('small', 'captain', randomFleet('small', rng), rng)
    const target = m.theirs.ships.flatMap((s) => shipCells(s, 8))
    expect(playerFires(m, 63 === target[0] ? 62 : 63)).not.toBeNull()
    expect(computerFires(m)).toBeNull() // not its turn
    for (const c of target) {
      const p = playerFires({ ...m, turn: 'player' }, c)
      if (!p) continue
      m = p.match
    }
    expect(m.winner).toBe('player')
    expect(sunkShips(m.theirs)).toHaveLength(4)
    expect(playerFires(m, 5)).toBeNull()
  })
})
