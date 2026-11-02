import { describe, expect, it } from 'vitest'
import { colourFor, dayWalks, EMPTY_POLISH, inRest, normalizePolish, occasionNote, occasionsAtSea, placeForEntry, reslice, setNote, setRest, TRAVELLER_COLOURS, watchSpot } from './planPolish'

describe('rest block (D4-1)', () => {
  it('sets, changes and clears one block per day, in day order', () => {
    expect(setRest([], 4, 'all')).toEqual([{ day: 4, part: 'all' }])
    expect(setRest([{ day: 4, part: 'all' }], 2, 'evening')).toEqual([{ day: 2, part: 'evening' }, { day: 4, part: 'all' }])
    expect(setRest([{ day: 4, part: 'all' }], 4, 'morning')).toEqual([{ day: 4, part: 'morning' }])
    expect(setRest([{ day: 4, part: 'all' }], 4, null)).toEqual([])
  })
  it('knows which times are inside the block', () => {
    const rest = [{ day: 3, part: 'afternoon' as const }, { day: 5, part: 'all' as const }]
    expect(inRest(rest, 3, '11:59')).toBe(false)
    expect(inRest(rest, 3, '12:00')).toBe(true)
    expect(inRest(rest, 3, '18:00')).toBe(false)
    expect(inRest(rest, 5, '07:30')).toBe(true)
    expect(inRest(rest, 4, '13:00')).toBe(false)
    expect(inRest(rest, 3, 'noon')).toBe(false)
  })
})

describe('walks (D4-2)', () => {
  const tour = { kind: 'tour' as const, name: 'Reef', time: '09:00' }
  const dinner = { kind: 'dinner' as const, name: 'Crown Grill', time: '19:00' }
  it('walks from the gangway to a dining room', () => {
    const w = dayWalks([tour, dinner])
    expect(w).toHaveLength(1)
    expect(w[0].toName).toMatch(/Crown/)
    expect(w[0].decks).toBe(3)
    expect(w[0].minutes).toBeGreaterThan(0)
  })
  it('adds the walk from the cabin to the first room and back from the last', () => {
    const w = dayWalks([dinner], '12045')
    expect(w.map((x) => [x.fromName, x.toName])).toEqual([['Cabin 12045', 'Crown Grill'], ['Crown Grill', 'Cabin 12045']])
    expect(dayWalks([tour], '12045')).toEqual([])
  })
  it('gives nothing for the same place, unknown rooms, a bad cabin or no entries', () => {
    expect(dayWalks([tour, { kind: 'allAboard', name: '', time: '16:00' }])).toEqual([])
    expect(dayWalks([{ kind: 'allAboard', name: '', time: '16:00' }, { kind: 'dinner', name: 'Nowhere Room', time: '19:00' }])).toEqual([])
    expect(dayWalks([dinner], 'x')).toEqual([])
    expect(dayWalks([])).toEqual([])
    expect(placeForEntry({ kind: 'sail', name: '' })?.id).toBe('landing')
  })
})

describe('sun places (D4-4)', () => {
  it('puts sunset on the side the sun sets and sunrise on the other', () => {
    expect(watchSpot('sunset', 'port').side).toBe('port')
    expect(watchSpot('sunrise', 'port').side).toBe('starboard')
    expect(watchSpot('sunrise', 'starboard').side).toBe('port')
  })
  it('uses an open deck with either side when the sun is ahead or behind', () => {
    for (const k of ['sunrise', 'sunset'] as const) { const w = watchSpot(k, 'neither'); expect(w.side).toBeNull(); expect(w.place.stepFree).toBe(true) }
  })
  it('is step-free everywhere', () => {
    for (const s of ['port', 'starboard', 'neither'] as const) for (const k of ['sunrise', 'sunset'] as const) expect(watchSpot(k, s).place.stepFree).toBe(true)
  })
})

describe('notes (D4-5)', () => {
  it('sets, trims, clears and caps a note', () => {
    expect(setNote({}, 'a', '  window   table ')).toEqual({ a: 'window table' })
    expect(setNote({ a: 'x', b: 'y' }, 'a', '   ')).toEqual({ b: 'y' })
    expect(setNote({}, 'a', 'z'.repeat(500)).a).toHaveLength(120)
  })
})

describe('traveller colours (D4-6)', () => {
  it('gives each traveller a different colour by default', () => {
    const ids = ['a', 'b', 'c']
    const cs = ids.map((i) => colourFor(i, ids, {}))
    expect(new Set(cs).size).toBe(3)
  })
  it('keeps a choice and does not hand it to anyone else', () => {
    const ids = ['a', 'b']
    expect(colourFor('a', ids, { a: 3 })).toBe(3)
    expect(colourFor('b', ids, { a: 0 })).not.toBe(0)
  })
  it('has a name for every colour', () => { expect(TRAVELLER_COLOURS.every((c) => c.name && /^#[0-9a-f]{6}$/.test(c.hex))).toBe(true) })
})

describe('occasions at sea (D2-5)', () => {
  const dates = ['2027-03-21', '2027-03-22', '2027-03-23']
  const o = { id: '1', label: 'Maya’s birthday', date: '2015-03-22', surprise: true }
  it('finds a birthday on a trip day whatever the year', () => { expect(occasionsAtSea([o], dates)).toEqual([{ occasion: o, day: 2 }]) })
  it('finds nothing outside the trip', () => { expect(occasionsAtSea([{ ...o, date: '2015-07-01' }], dates)).toEqual([]) })
  it('says surprise in the note only when asked', () => {
    expect(occasionNote(o, 'Sun Princess')).toMatch(/surprise/)
    expect(occasionNote({ ...o, surprise: false }, 'Sun Princess')).not.toMatch(/surprise/)
  })
})

describe('reslice (D2-7)', () => {
  it('always adds up to the total', () => {
    for (const [a, i, c] of [[[3000, 3000, 3000], 0, 5000], [[1, 1, 1], 1, 2], [[0, 0, 100], 2, 40], [[500, 500], 0, 123], [[10], 0, 3]] as [number[], number, number][]) {
      const r = reslice(a, i, c)
      expect(r.reduce((x, y) => x + y, 0)).toBe(a.reduce((x, y) => x + y, 0))
      expect(r.every((x) => x >= 0)).toBe(true)
    }
  })
  it('spreads the rest in proportion', () => { expect(reslice([5000, 3000, 1000], 0, 7000)).toEqual([7000, 1500, 500]) })
  it('clamps to the total and spreads equally when the others hold nothing', () => {
    expect(reslice([100, 0, 0], 0, 999)).toEqual([100, 0, 0])
    expect(reslice([100, 0, 0], 0, 50)).toEqual([50, 25, 25])
  })
})

describe('normalizePolish', () => {
  it('survives junk', () => {
    expect(normalizePolish(null)).toEqual(EMPTY_POLISH)
    expect(normalizePolish({ rest: [3, 3, 99, 'x', 1, { day: 4, part: 'evening' }, { day: 5, part: 'bogus' }], notes: { a: ' hi ', b: 5 }, colours: { a: 2, b: 99 }, occasions: [{ id: 'x', label: 'L', date: '2020-01-02' }, { id: 'y', label: '', date: '2020-01-02' }] }))
      .toEqual({ rest: [{ day: 1, part: 'all' }, { day: 3, part: 'all' }, { day: 4, part: 'evening' }], notes: { a: 'hi' }, colours: { a: 2 }, occasions: [{ id: 'x', label: 'L', date: '2020-01-02', surprise: false }] })
  })
})
