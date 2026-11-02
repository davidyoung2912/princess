import { describe, expect, it } from 'vitest'
import type { CabinScore } from './cabinScore'
import { cabinsFor } from './cabins'
import { cabinRegrets, itineraryRegrets, MAX_CABIN_REGRETS } from './regret'
import { REFERENCE_SAILING, SAILINGS } from './sailings'

const score = (patch: Partial<CabinScore> = {}, cabinPatch: Partial<CabinScore['cabin']> = {}): CabinScore => ({
  cabin: { ...cabinsFor('x', 'balcony')[0], obstructed: false, ...cabinPatch },
  category: 'balcony', sleep: 4, motion: 4, noise: 4,
  reasons: { sleep: ['Dark and quiet'], motion: ['Low and central'], noise: ['Next to the pool deck'] },
  sun: null, warnings: [], ...patch,
})

describe('regret cards (N6.2)', () => {
  it('has no card for a good stateroom', () => {
    expect(cabinRegrets(score())).toEqual([])
  })

  it('quotes the evidence for each card, never a bare opinion', () => {
    const cards = cabinRegrets(score({ noise: 1, motion: 2 }, { obstructed: true }))
    expect(cards.map((c) => c.id)).toEqual(['view', 'noise', 'motion'])
    for (const c of cards) { expect(c.evidence.length).toBeGreaterThan(10); expect(c.line).toMatch(/^You may regret/) }
    expect(cards[1].evidence).toContain('Next to the pool deck')
  })

  it('shows at most three cards, and an inside room carries the no-window fact', () => {
    expect(cabinRegrets(score({ noise: 1, motion: 1, sleep: 1 }, { obstructed: true }))).toHaveLength(MAX_CABIN_REGRETS)
    expect(cabinRegrets(score({ category: 'interior' })).map((c) => c.id)).toEqual(['window'])
  })

  it('reads the itinerary: tender ports, short stays, sea days and the clock change', () => {
    const cards = itineraryRegrets(SAILINGS[0] ?? REFERENCE_SAILING)
    const ids = cards.map((c) => c.id)
    expect(ids).toContain('clock')
    expect(ids.some((i) => i.startsWith('tender-'))).toBe(true)
    for (const c of cards) expect(c.evidence).not.toBe('')
  })

  it('does not shame or push a sale', () => {
    const all = [...itineraryRegrets(SAILINGS[0] ?? REFERENCE_SAILING), ...cabinRegrets(score({ noise: 1 }, { obstructed: true }))]
    for (const c of all) expect(`${c.line} ${c.evidence}`).not.toMatch(/\b(only|hurry|last chance|book now|upgrade|selling out|miss out|foolish)\b/i)
  })
})

describe('crew thank-you and quick requests (N6.3, N6.6)', () => {
  it('shows a thanked crew member the note and nothing else', async () => {
    const { blankFeedback, crewNotes } = await import('./postcruise')
    const f = { ...blankFeedback(), overall: 5, comment: ' Thank you for the towel swans. ', crew: ['Marisol', 'Rafael'], shareName: false, areas: { dining: 1 } }
    const notes = crewNotes(f, 'Gerald')
    expect(notes).toEqual([{ crew: 'Marisol', note: 'Thank you for the towel swans.', from: null }, { crew: 'Rafael', note: 'Thank you for the towel swans.', from: null }])
    const wire = JSON.stringify(notes)
    expect(wire).not.toMatch(/tip|gratuity|amount|overall|dining|Gerald/i)
    expect(crewNotes({ ...f, shareName: true }, 'Gerald')[0].from).toBe('Gerald')
    expect(crewNotes({ ...f, crew: [] }, 'Gerald')).toEqual([])
  })

  it('offers only real request items as the one-tap row', async () => {
    const { QUICK_REQUESTS, requestItem } = await import('./services')
    for (const id of QUICK_REQUESTS) expect(requestItem(id)).toBeDefined()
    expect(QUICK_REQUESTS).toContain('towels')
    expect(QUICK_REQUESTS).toContain('turndown')
  })
})
