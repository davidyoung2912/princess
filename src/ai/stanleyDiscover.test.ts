import { describe, expect, it } from 'vitest'
import {
  defaultWeights, normalizeBookingFlags, normalizeBrief, normalizeComparison, normalizeDirections, normalizeFilters, normalizeInterview, normalizeWeights, toggleShortlist, withoutChip, chipsLeft,
} from './stanleyDiscover'

describe('Stanley Dream and Discover (device side)', () => {
  it('reads an interview defensively', () => {
    const r = normalizeInterview({ filters: { months: [5, 13, 'x'], nightsMin: 6, nightsMax: 8, warm: true, extra: 1 }, chips: [{ key: 'months', label: 'May', assumed: true }, { nope: 1 }], assumptions: ['a', 5], understood: true })
    expect(r.filters).toEqual({ months: [5], nightsMin: 6, nightsMax: 8, warm: true })
    expect(r.chips).toEqual([{ key: 'months', label: 'May', assumed: true }])
    expect(r.assumptions).toEqual(['a'])
    expect(normalizeInterview(null)).toEqual({ filters: {}, chips: [], assumptions: [], understood: false })
  })

  it('takes a chip out of the filters and the list', () => {
    const f = { months: [5], nightsMin: 6, nightsMax: 8, warm: true, maxTender: 1 }
    expect(withoutChip(f, 'nights')).toEqual({ months: [5], warm: true, maxTender: 1 })
    expect(withoutChip(f, 'tender')).toEqual({ months: [5], nightsMin: 6, nightsMax: 8, warm: true })
    expect(chipsLeft([{ key: 'a', label: '', assumed: false }, { key: 'b', label: '', assumed: false }], ['a']).map((c) => c.key)).toEqual(['b'])
    expect(f.nightsMin).toBe(6)
  })

  it('reads directions and the notes about too few', () => {
    const d = normalizeDirections({ directions: [{ kind: 'bestFit', label: 'Closest', sailingId: 'S1', title: 'A', departure: '2027-05-02', nights: 7, perNightCents: 14900, met: ['x'], missed: [], noData: ['y'], tradeOffs: ['t'] }, { sailingId: '' }], considered: 4, note: 'onlyOne' })
    expect(d.directions).toHaveLength(1)
    expect(d.directions[0]).toMatchObject({ sailingId: 'S1', perNightCents: 14900, noData: ['y'] })
    expect(d.note).toBe('onlyOne')
    expect(normalizeDirections({ note: 'weird' }).note).toBeNull()
  })

  it('keeps weights between 0 and 5 and defaults the rest to 3', () => {
    expect(normalizeWeights({ price: 9, ports: -2, tender: 1.5, seaDays: 4 })).toEqual({ price: 5, ports: 0, seaDays: 4, tender: 3, fit: 3 })
    expect(normalizeWeights(null)).toEqual(defaultWeights())
  })

  it('reads a comparison and leaves an unknown cell unknown', () => {
    const c = normalizeComparison({
      rows: [{ sailingId: 'a', title: 'A', score: null, cells: [{ key: 'price', text: 'No data', known: false }], missing: ['Price'], portNotes: ['No itinerary is published for this sailing.'] }],
      weights: { price: 5 }, ifYouValue: [{ criterion: 'price', label: 'the lowest price a night', sailingIds: ['a'] }], priceBasis: 'basis', note: 'note',
    })!
    expect(c.rows[0].score).toBeNull()
    expect(c.rows[0].cells[0].known).toBe(false)
    expect(c.weights.price).toBe(5)
    expect(normalizeComparison({})).toBeNull()
  })

  it('reads a saved brief, and an empty one when there is none', () => {
    const r = normalizeBrief({ brief: { text: 'late spring', filters: { months: [5] }, shortlist: ['S1'], weights: { price: 4 }, needs: ['wheelchair'], title: 'T' }, updatedAt: '2027-01-10T12:00:00Z' })
    expect(r.brief.shortlist).toEqual(['S1'])
    expect(r.brief.weights.price).toBe(4)
    expect(r.updatedAt).toBe(Date.parse('2027-01-10T12:00:00Z'))
    expect(normalizeBrief({ brief: {}, updatedAt: null }).updatedAt).toBeNull()
  })

  it('keeps the short list to five and toggles', () => {
    expect(toggleShortlist(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleShortlist(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleShortlist(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(normalizeFilters({ regions: ['caribbean', 3] }).regions).toEqual(['caribbean'])
  })

  it('reads booking hints', () => {
    expect(normalizeBookingFlags({ flags: [{ field: 'birthDate', code: 'future', text: 'x' }, { field: 1 }], authority: 'a' })).toEqual([{ field: 'birthDate', code: 'future', text: 'x' }])
    expect(normalizeBookingFlags(null)).toEqual([])
  })
})
