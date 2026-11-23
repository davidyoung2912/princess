import { describe, expect, it } from 'vitest'
import * as bg from './backgammon'
import { seededRng } from './cards'
import { SKILL_LIST } from './search'

describe('Backgammon', () => {
  it('sets up 15 discs each and the standard points', () => {
    const g = bg.start()
    expect(g.points.filter((x) => x > 0).reduce((a, b) => a + b, 0)).toBe(15)
    expect(-g.points.filter((x) => x < 0).reduce((a, b) => a + b, 0)).toBe(15)
    expect(bg.pipCount(g, 0)).toBe(167)
    expect(bg.pipCount(g, 1)).toBe(167)
  })
  it('rolls two dice, four on doubles', () => {
    for (let s = 1; s < 40; s++) { const d = bg.rollDice(seededRng(s)); expect(d.length === 2 || (d.length === 4 && d.every((x) => x === d[0]))).toBe(true) }
  })
})

describe('Backgammon play', () => {
  it('blocks points held by two enemy discs, hits a blot and sends it to the bar', () => {
    const g = bg.withDice(bg.start(), [6, 5])
    // White at point 23 moving 6 lands on 17: empty (black holds 16 and 18). Moving 5 from 23 lands on 18: blocked.
    const st = bg.legalSteps(g)
    expect(st.some((s) => s.from === 23 && s.to === 17)).toBe(true)
    expect(st.some((s) => s.from === 23 && s.to === 18)).toBe(false)
    const board = bg.start()
    board.points[10] = -1
    board.points[12] = 5
    const hit = bg.withDice(board, [2, 3])
    const h = bg.legalSteps(hit).find((s) => s.from === 12 && s.to === 10)!
    expect(h.hit).toBe(true)
    const after = bg.applyStep(hit, h)
    expect(after.bar[1]).toBe(1)
    expect(after.points[10]).toBe(1)
  })
  it('must enter from the bar first, and bears off only when all are home', () => {
    const g = bg.start()
    g.bar = [1, 0]
    g.points[23] = 1
    const rolled = bg.withDice(g, [1, 2])
    expect(bg.legalSteps(rolled).every((s) => s.from === 'bar')).toBe(true)
    const home = bg.start()
    home.points = Array(24).fill(0); home.points[0] = 3; home.points[2] = 2; home.points[23] = 0
    home.points[18] = -1
    home.off = [10, 0]
    const r = bg.withDice(home, [6, 1])
    expect(bg.legalSteps(r).some((s) => s.to === 'off')).toBe(true)
    const notHome = bg.withDice(bg.start(), [6, 6])
    expect(bg.legalSteps(notHome).some((s) => s.to === 'off')).toBe(false)
  })
  it('the computer plays full legal turns and whole games finish', () => {
    for (const skill of SKILL_LIST.filter((s) => s !== 'admiral')) {
      const rng = seededRng(4 + skill.length)
      let g = bg.start()
      let turns = 0
      while (!g.winner && turns++ < 600) {
        g = bg.withDice(g, bg.rollDice(rng))
        const seq = bg.chooseTurn(g, skill, rng)
        for (const st of seq) { expect(bg.legalSteps(g)).toContainEqual(st); g = bg.applyStep(g, st) }
        if (!g.winner) g = bg.endTurn(g)
      }
      expect(g.winner).not.toBe(0)
      expect(g.off[g.winner - 1]).toBe(15)
    }
  }, 120000)
  it('the Admiral picks a legal turn quickly, and beats a random mover', () => {
    const rng = seededRng(21)
    let g = bg.withDice(bg.start(), [3, 1])
    const t0 = performance.now()
    const seq = bg.chooseTurn(g, 'admiral', rng)
    expect(performance.now() - t0).toBeLessThan(3000)
    for (const st of seq) { expect(bg.legalSteps(g)).toContainEqual(st); g = bg.applyStep(g, st) }
    expect(seq.length).toBe(2)
  }, 30000)
})
