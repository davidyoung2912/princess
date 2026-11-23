import { describe, expect, it } from 'vitest'
import { seededRng } from './cards'
import { ROW_START, TOTAL, adjacent, canPlay, coveredBy, deal, draw, hint, isFree, isStuck, isWon, play, playable, rowOf, xOf, type TriPeaks } from './tripeaks'

const c = (id: number, rank: number) => ({ id, suit: 0 as const, rank: rank as 1 })

describe('TriPeaks', () => {
  it('lays out three peaks: 3, 6, 9 and a base of 10, each card resting on two below', () => {
    expect([rowOf(0), rowOf(3), rowOf(9), rowOf(18), rowOf(27)]).toEqual([0, 1, 2, 3, 3])
    for (let i = 0; i < 18; i++) {
      const under = coveredBy(i)
      expect(under).toHaveLength(2)
      under.forEach((u) => expect(Math.abs(xOf(u) - xOf(i))).toBe(1))
    }
    expect(coveredBy(27)).toEqual([])
    expect(ROW_START).toEqual([0, 3, 9, 18])
    const g = deal('classic', seededRng(1))
    expect(g.tableau).toHaveLength(TOTAL)
    expect(g.stock).toHaveLength(23)
    expect(g.waste).toHaveLength(1)
    expect(new Set([...g.tableau.map((x) => x!.id), ...g.stock.map((x) => x.id), ...g.waste.map((x) => x.id)]).size).toBe(52)
    expect(Array.from({ length: TOTAL }, (_, i) => isFree(g, i)).filter(Boolean)).toHaveLength(10)
  })

  it('takes a card one rank above or below the waste card, and wraps King and Ace only on Easy', () => {
    expect(adjacent(5, 6, false)).toBe(true)
    expect(adjacent(5, 7, false)).toBe(false)
    expect(adjacent(13, 1, false)).toBe(false)
    expect(adjacent(13, 1, true)).toBe(true)
    const g = deal('classic', seededRng(2))
    const t = g.tableau.slice()
    t[18] = c(100, 6); t[19] = c(101, 9)
    const p: TriPeaks = { ...g, tableau: t, waste: [c(102, 7)] }
    expect(canPlay(p, 18)).toBe(true)
    expect(canPlay(p, 19)).toBe(false)
    expect(canPlay(p, 0)).toBe(false) // covered
    const m = play(p, 18)
    expect(m.waste[m.waste.length - 1].id).toBe(100)
    expect(m.streak).toBe(1)
    expect(m.score).toBe(10)
    expect(draw(m).streak).toBe(0)
  })

  it('uncovers a card once both cards on it are gone, and scores a cleared peak', () => {
    const g = deal('classic', seededRng(3))
    const t = g.tableau.slice()
    const under = coveredBy(0)
    expect(isFree(g, 0)).toBe(false)
    under.forEach((u) => { t[u] = null })
    const open: TriPeaks = { ...g, tableau: t, waste: [{ id: 200, suit: 1, rank: ((t[0]!.rank % 13) + 1) as 1 }] }
    expect(isFree(open, 0)).toBe(true)
    expect(play({ ...open, wrap: true }, 0).peaks[0]).toBe(true)
  })

  it('wins when all peaks are cleared, and is stuck with no stock and no play', () => {
    const g = deal('classic', seededRng(4))
    expect(isWon({ ...g, tableau: Array(TOTAL).fill(null) })).toBe(true)
    const stuck: TriPeaks = { ...g, stock: [], waste: [c(300, 7)], tableau: g.tableau.map((x) => (x ? { ...x, rank: 12 as const } : x)) }
    expect(isStuck(stuck)).toBe(true)
  })

  it('suggests a playable card, or none when nothing fits', () => {
    for (let s = 1; s <= 30; s++) {
      const g = deal('easy', seededRng(s))
      const h = hint(g)
      if (h === null) expect(playable(g)).toHaveLength(0)
      else expect(canPlay(g, h)).toBe(true)
    }
  })
})
