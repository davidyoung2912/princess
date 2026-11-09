import { describe, expect, it } from 'vitest'
import { cabinsFor } from './cabins'
import { comfortIndicators, GUEST_REPORTS_NOTE, type Basis } from './cabinComfort'
import type { CabinScore } from './cabinScore'
import { cabinWalks } from './discoverDelights'
import { REFERENCE_SAILING as S } from './sailings'

const score = (i: number): CabinScore => ({ cabin: cabinsFor(S.id, 'balcony')[i], category: 'balcony', sleep: 4, motion: 2, noise: 3, reasons: { sleep: [], motion: [], noise: [] }, sun: null, warnings: [] })
const BASES: Basis[] = ['confirmed', 'typical', 'guestReported', 'unknown']

describe('DSC-06 comfort indicators', () => {
  it('tags every indicator and never claims confirmed or guest-reported without a source', () => {
    for (let i = 0; i < 9; i++) {
      const list = comfortIndicators(score(i))
      expect(list.map((x) => x.key)).toEqual(['noise', 'motion', 'lift', 'connecting', 'obstruction'])
      for (const x of list) { expect(BASES).toContain(x.basis); expect(x.basis === 'confirmed' || x.basis === 'guestReported').toBe(false) }
      expect(list.find((x) => x.key === 'connecting')!.basis).toBe('unknown')
    }
  })
  it('marks a fact confirmed only when a source supplies it', () => {
    const list = comfortIndicators(score(0), { connecting: true, liftDistance: 'near' })
    expect(list.find((x) => x.key === 'connecting')).toMatchObject({ basis: 'confirmed', text: 'Has a connecting door' })
    expect(list.find((x) => x.key === 'lift')!.basis).toBe('confirmed')
  })
  it('says guest reports are not a guarantee', () => { expect(GUEST_REPORTS_NOTE).toMatch(/not a guarantee/) })
})

describe('DSC-13 walks say how the way goes', () => {
  it('marks each walk as on this deck or by lift', () => {
    const w = cabinWalks({ deck: 8, position: 'forward' }).walks
    expect(w.length).toBeGreaterThan(0)
    for (const x of w) expect(['deck', 'lift']).toContain(x.by)
  })
})
