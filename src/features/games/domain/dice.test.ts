import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import * as pig from './pig'
import * as box from './shutbox'
import * as yacht from './yacht'
import { SKILL_LIST } from './search'

describe('Pig', () => {
  it('adds rolls, loses the turn on a 1, banks on hold and wins at the target', () => {
    let g = pig.start(100)
    g = pig.rollWith(g, 4); g = pig.rollWith(g, 6)
    expect(g.total).toBe(10)
    const h = pig.hold(g)
    expect(h.scores).toEqual([10, 0]); expect(h.turn).toBe(1); expect(h.total).toBe(0)
    const bust = pig.rollWith(pig.rollWith(h, 5), 1)
    expect(bust.total).toBe(0); expect(bust.turn).toBe(0); expect(bust.scores).toEqual([10, 0])
    const win = pig.hold({ ...pig.start(50), scores: [40, 0], total: 12 })
    expect(win.winner).toBe(1)
    expect(pig.hold(pig.start(50)).turn).toBe(0) // nothing to bank
  })
  it('the computer holds at sensible totals, and the Admiral adapts to the score', () => {
    const g: pig.Pig = { ...pig.start(100), total: 20 }
    expect(pig.shouldHold(g, 'captain')).toBe(true)
    expect(pig.shouldHold({ ...g, total: 19 }, 'captain')).toBe(false)
    expect(pig.shouldHold({ ...pig.start(100), scores: [90, 10], total: 10 }, 'admiral')).toBe(true) // can win
    const behind: pig.Pig = { ...pig.start(100), scores: [10, 80], total: 25, turn: 0 }
    expect(pig.shouldHold(behind, 'admiral')).toBe(false) // must race
    expect(pig.shouldHold({ ...pig.start(100), total: 0 }, 'admiral')).toBe(false)
  })
  it('stronger holding rules win more over many games', () => {
    const play = (a: 'cadet' | 'captain' | 'admiral', b: 'cadet' | 'captain' | 'admiral', seed: number) => {
      const rng = seededRng(seed)
      let g = pig.start(100)
      let guard = 0
      while (!g.winner && guard++ < 5000) { const sk = g.turn === 0 ? a : b; g = pig.shouldHold(g, sk, rng) ? pig.hold(g) : pig.rollWith(g, pig.rollDie(rng)) }
      return g.winner
    }
    let admiral = 0, cadet = 0
    for (let s = 1; s <= 300; s++) { if (play('admiral', 'cadet', s) === 1) admiral++; if (play('cadet', 'admiral', s + 1000) === 1) cadet++ }
    expect(admiral + (300 - cadet)).toBeGreaterThan(330)
  })
})

describe('Yacht', () => {
  it('scores each category', () => {
    expect(yacht.scoreOf('threes', [3, 3, 1, 3, 5])).toBe(9)
    expect(yacht.scoreOf('fullHouse', [2, 2, 5, 5, 5])).toBe(19)
    expect(yacht.scoreOf('fullHouse', [5, 5, 5, 5, 5])).toBe(0)
    expect(yacht.scoreOf('fourKind', [4, 4, 4, 4, 1])).toBe(16)
    expect(yacht.scoreOf('littleStraight', [1, 2, 3, 4, 5])).toBe(30)
    expect(yacht.scoreOf('bigStraight', [2, 3, 4, 5, 6])).toBe(30)
    expect(yacht.scoreOf('bigStraight', [1, 2, 3, 4, 6])).toBe(0)
    expect(yacht.scoreOf('yacht', [6, 6, 6, 6, 6])).toBe(50)
    expect(yacht.scoreOf('choice', [1, 2, 3, 4, 6])).toBe(16)
  })
  it('lets you hold dice between rolls, three rolls a turn, and each category once', () => {
    let g = yacht.roll(yacht.start(), seededRng(1))
    expect(g.rollsLeft).toBe(2)
    const keep = g.dice[0]
    g = yacht.toggleHold(g, 0)
    g = yacht.roll(g, seededRng(2))
    expect(g.dice[0]).toBe(keep)
    g = yacht.roll(g, seededRng(3))
    expect(g.rollsLeft).toBe(0)
    expect(yacht.roll(g, seededRng(4))).toBe(g)
    const scored = yacht.score(g, 'choice')
    expect(scored.cards[0][10]).not.toBeNull(); expect(scored.turn).toBe(1)
    expect(yacht.score({ ...scored, turn: 0, rolled: true }, 'choice').turn).toBe(0) // already used
  })
  it('the Admiral keeps the matching dice and plays complete games; stronger beats weaker', () => {
    const hold = yacht.bestHold(Array(12).fill(null), [6, 6, 6, 2, 3], 2)
    expect(hold.slice(0, 3)).toEqual([true, true, true])
    const playGame = (a: 'cadet' | 'captain' | 'admiral', b: 'cadet' | 'captain' | 'admiral', seed: number) => {
      const rng = seededRng(seed)
      let g = yacht.start()
      let guard = 0
      while (!yacht.isOver(g) && guard++ < 200) g = yacht.act(g, yacht.choose(g, g.turn === 0 ? a : b, rng), rng)
      expect(yacht.isOver(g)).toBe(true)
      return [yacht.total(g.cards[0]), yacht.total(g.cards[1])]
    }
    let strong = 0, weak = 0
    for (let s = 1; s <= 5; s++) { const [x, y] = playGame('admiral', 'cadet', s); strong += x; weak += y }
    expect(strong).toBeGreaterThan(weak)
    for (const sk of SKILL_LIST) expect(playGame(sk, sk, 99)).toHaveLength(2)
  }, 120000)
})

describe('Shut the Box', () => {
  it('finds the tile combinations and closes only matching tiles', () => {
    expect(box.combos([1, 2, 3, 4, 5, 6, 7, 8, 9], 6).map((c) => c.join('+')).sort()).toEqual(['1+2+3', '1+5', '2+4', '6'])
    const g = box.rollFor(box.start(9), [3, 4])
    expect(box.close(g, [1, 2, 4])?.open).toEqual([3, 5, 6, 7, 8, 9])
    expect(box.close(g, [3, 5])).toBeNull()
    expect(box.close(g, [7])?.open).toHaveLength(8)
    expect(box.oneDie([1, 2, 3])).toBe(true)
    expect(box.oneDie([4, 5])).toBe(false)
  })
  it('scores the open tiles, passes the box to the other side, and the lowest wins', () => {
    const g = box.endTurn({ ...box.start(9), open: [2, 5] })
    expect(g.scores[0]).toBe(7); expect(g.turn).toBe(1); expect(g.open).toHaveLength(9)
    const done = box.endTurn({ ...g, open: [1] })
    expect(box.isOver(done)).toBe(true); expect(box.winner(done)).toBe(2)
    const second = box.endTurn({ ...box.start(9), open: [3], turn: 1 })
    expect(second.scores).toEqual([null, 3]); expect(second.turn).toBe(0)
    const shut = box.close(box.rollFor({ ...box.start(9), open: [4] }, [4]), [4])!
    expect(shut.scores[0]).toBe(0)
  })
  it('the Admiral does better than random play over many boxes', () => {
    const avg = (skill: 'cadet' | 'captain' | 'admiral') => {
      const rng = seededRng(5)
      let t = 0
      for (let i = 0; i < 400; i++) {
        let g = box.start(9)
        for (let guard = 0; guard < 60; guard++) {
          g = box.rollFor(g, box.rollDice(g.open, rng))
          const m = box.choose(g, skill, rng)
          if (!m) break
          g = box.close(g, m)!
          if (g.open.length === 9) break
        }
        t += g.open.length === 9 ? 0 : g.open.reduce((a, b) => a + b, 0)
      }
      return t / 400
    }
    expect(avg('admiral')).toBeLessThan(avg('cadet') - 2)
    expect(avg('admiral')).toBeLessThanOrEqual(avg('captain') + 0.5)
  }, 60000)
})
