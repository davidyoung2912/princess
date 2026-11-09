import { describe, expect, it } from 'vitest'
import { DECKS, ELEVATORS, PLACES } from './deck'
import { buildGraph, cabinPlace, locate, wayBetween } from './deckGraph'
import { HULL_PATH, decksOf, lineOnDeck, placeLifts, placePlaces } from './deckPlan'
import { routeBetween } from './route'

describe('deck graph', () => {
  it('has a hall for every section of every deck and a lift node for every bank on every deck', () => {
    const g = buildGraph()
    for (const d of DECKS) {
      for (const s of ['forward', 'midship', 'aft']) expect(g.has(`hall:${d}:${s}`), `${d} ${s}`).toBe(true)
      for (const e of ELEVATORS) expect(g.has(`lift:${e.bank}:${d}`)).toBe(true)
    }
  })

  it('finds a way from every place to every other place', () => {
    for (const a of PLACES) for (const b of PLACES) {
      if (a.id !== b.id) expect(wayBetween(a, b), `${a.id} to ${b.id}`).not.toBeNull()
    }
  })

  it('rides the lift bank of the starting section, then walks on the arrival deck', () => {
    const r = routeBetween('medical', 'lido-pool', { stepFree: false })
    expect(r.ok && r.way.map((w) => w.kind)).toEqual(['hall', 'lift', 'lift', 'hall', 'hall'])
    expect(r.ok && r.steps.map((s) => s.kind)).toEqual(['walk', 'lift', 'walk', 'arrive'])
  })

  it('walks forward or aft along one deck', () => {
    const r = routeBetween('soleil', 'guest-services', { stepFree: false })
    expect(r.ok && r.steps[0]).toMatchObject({ kind: 'walk', toward: 'forward', deck: 6 })
  })
})

describe('cabins', () => {
  it('reads the deck from the number and puts low numbers forward and high numbers aft', () => {
    expect(cabinPlace('8123')).toMatchObject({ deck: 8, section: 'forward' })
    expect(cabinPlace('12245')).toMatchObject({ deck: 12, section: 'midship' })
    expect(cabinPlace('9401')).toMatchObject({ deck: 9, section: 'aft' })
  })

  it('rejects numbers that are not staterooms', () => {
    for (const bad of ['', '12', 'D723', '99999', '1100', '123456']) expect(cabinPlace(bad), bad).toBeNull()
    expect(locate('cabin:xx')).toBeUndefined()
  })

  it('gives step-by-step words and the line for the way to a cabin on a deck with no listed place', () => {
    const r = routeBetween('eclipse', 'cabin:12401', { stepFree: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.steps.map((s) => s.kind)).toEqual(['walk', 'lift', 'arrive'])
    expect(r.steps[1]).toMatchObject({ kind: 'lift', from: 7, to: 12, section: 'aft' })
    expect(r.stepFree).toBe(true)
    const from = locate('eclipse')!
    const to = locate('cabin:12401')!
    expect(decksOf(r.way, from, to)).toEqual([7, 12])
    expect(lineOnDeck(r.way, from, to, 12).length).toBeGreaterThanOrEqual(2)
    expect(lineOnDeck(r.way, from, to, 3)).toEqual([])
  })

  it('goes back from a cabin to a place', () => {
    const r = routeBetween('cabin:8123', 'lido', { stepFree: false })
    expect(r.ok && r.steps.map((s) => s.kind)).toEqual(['walk', 'lift', 'walk', 'arrive'])
  })
})

describe('plan geometry', () => {
  it('gives every place on a deck its own point inside the hull', () => {
    for (const d of DECKS) {
      const placed = placePlaces(d)
      const keys = new Set(placed.map((p) => `${p.at.x},${p.at.y}`))
      expect(keys.size, `deck ${d}`).toBe(placed.length)
      for (const p of placed) { expect(p.at.x).toBeGreaterThan(20); expect(p.at.x).toBeLessThan(620) }
    }
    expect(placeLifts()).toHaveLength(6)
    expect(HULL_PATH.startsWith('M')).toBe(true)
  })

  it('marks the muster stations on their deck', () => {
    expect(placePlaces(7).filter((p) => p.muster).map((p) => p.muster).sort()).toEqual(['A', 'B', 'C/D', 'E'])
    expect(placePlaces(6).find((p) => p.muster)?.muster).toBe('F')
  })
})

describe('lift closures (QOL-10)', () => {
  it('avoids a closed bank and says it rerouted', () => {
    const usual = routeBetween('medical', 'lido-pool', { stepFree: false })
    const bank = usual.ok ? (usual.steps.find((s) => s.kind === 'lift') as { bank: string }).bank : ''
    const r = routeBetween('medical', 'lido-pool', { stepFree: false, closed: new Set([bank]) })
    expect(r.ok && r.rerouted).toBe(true)
    expect(r.ok && r.steps.some((s) => s.kind === 'lift' && s.bank === bank)).toBe(false)
  })
  it('reports no way when every bank is closed between decks', () => {
    const r = routeBetween('medical', 'lido-pool', { stepFree: false, closed: new Set(ELEVATORS.map((e) => e.bank)) })
    expect(r).toMatchObject({ ok: false, reason: 'noWay' })
  })
  it('is not rerouted when nothing is closed', () => {
    expect(routeBetween('medical', 'lido-pool', { stepFree: false })).toMatchObject({ ok: true, rerouted: false })
  })
})
