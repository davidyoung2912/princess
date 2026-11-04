import { describe, expect, it } from 'vitest'
import { addAuto, addNote, dayFor, editEntry, ENTRY_MAX, ENTRIES_MAX, EMPTY_DIARY, entriesFor, groupByDay, normalizeDiary, removeEntry, searchEntries, syncAuto } from './tripDiary'

const auto = (id: string, key: string, day = 0, text = 'Booked.') => ({ id, sailingId: 's1', day, at: day * 1000, kind: 'booked' as const, text, key })

describe('trip diary', () => {
  it('adds a note, trims it and ignores an empty one', () => {
    const d = addNote(EMPTY_DIARY, { id: 'a', sailingId: 's1', day: 2, at: 5, text: '  Lovely   sunset \n ', mood: 'great' })
    expect(d.entries[0]).toMatchObject({ text: 'Lovely sunset', mood: 'great', auto: false, day: 2 })
    expect(addNote(d, { id: 'b', sailingId: 's1', day: 2, at: 6, text: '   ' })).toBe(d)
    expect(addNote(d, { id: 'a', sailingId: 's1', day: 2, at: 6, text: 'again' })).toBe(d)
  })
  it('caps a line and the diary', () => {
    const d = addNote(EMPTY_DIARY, { id: 'a', sailingId: 's1', day: 1, at: 1, text: 'x'.repeat(ENTRY_MAX + 50) })
    expect(d.entries[0].text).toHaveLength(ENTRY_MAX)
    const full = { ...EMPTY_DIARY, entries: Array.from({ length: ENTRIES_MAX }, (_, i) => ({ ...d.entries[0], id: `n${i}` })) }
    expect(addNote(full, { id: 'z', sailingId: 's1', day: 1, at: 1, text: 'more' })).toBe(full)
  })
  it('writes an app line once per sailing and key', () => {
    const d = addAuto(EMPTY_DIARY, auto('a', 'booked'))
    expect(addAuto(d, auto('b', 'booked'))).toBe(d)
    expect(addAuto(d, { ...auto('c', 'booked'), sailingId: 's2' }).entries).toHaveLength(2)
  })
  it('keeps a removed app line removed, but a removed note is simply gone', () => {
    const d = addAuto(EMPTY_DIARY, auto('a', 'booked'))
    const gone = removeEntry(d, 'a')
    expect(gone.entries).toHaveLength(0)
    expect(addAuto(gone, auto('b', 'booked'))).toBe(gone)
    const n = addNote(EMPTY_DIARY, { id: 'n', sailingId: 's1', day: 1, at: 1, text: 'hi' })
    expect(removeEntry(n, 'n').skipped).toEqual([])
  })
  it('editing makes an app line the guest\'s own', () => {
    const d = editEntry(addAuto(EMPTY_DIARY, auto('a', 'booked')), 'a', 'We booked it!')
    expect(d.entries[0]).toMatchObject({ text: 'We booked it!', auto: false })
    expect(editEntry(d, 'a', '  ')).toBe(d)
  })
  it('groups by day with before-the-ship first, and sorts by time', () => {
    let d = addNote(EMPTY_DIARY, { id: 'a', sailingId: 's1', day: 2, at: 9, text: 'late' })
    d = addNote(d, { id: 'b', sailingId: 's1', day: 2, at: 3, text: 'early' })
    d = addAuto(d, auto('c', 'booked'))
    const g = groupByDay(entriesFor(d, 's1'))
    expect(g.map((x) => x.day)).toEqual([0, 2])
    expect(g[1].entries.map((e) => e.text)).toEqual(['early', 'late'])
  })
  it('searches by every word, ignoring case and accents', () => {
    const d = addNote(addNote(EMPTY_DIARY, { id: 'a', sailingId: 's1', day: 1, at: 1, text: 'Crème brûlée at dinner' }), { id: 'b', sailingId: 's1', day: 1, at: 2, text: 'Sunset on deck' })
    expect(searchEntries(d.entries, 'creme DINNER')).toHaveLength(1)
    expect(searchEntries(d.entries, 'creme sunset')).toHaveLength(0)
    expect(searchEntries(d.entries, '  ')).toHaveLength(2)
  })
  it('finds the trip day from the itinerary dates', () => {
    const dates = ['2027-03-07', '2027-03-08', '2027-03-09']
    expect(dayFor(dates, Date.parse('2027-03-01T10:00:00Z'))).toBe(0)
    expect(dayFor(dates, Date.parse('2027-03-08T10:00:00Z'))).toBe(2)
    expect(dayFor(dates, Date.parse('2027-03-20T10:00:00Z'))).toBe(3)
    expect(dayFor([], 0)).toBe(0)
  })
  it('normalizes anything it is given', () => {
    expect(normalizeDiary(null)).toEqual(EMPTY_DIARY)
    expect(normalizeDiary({ entries: 'x' })).toEqual(EMPTY_DIARY)
    const d = normalizeDiary({ entries: [{ id: 'a', kind: 'note', text: 'ok', day: 99, mood: 'bad' }, { id: 'a', kind: 'note', text: 'dup' }, { id: 'b', kind: 'nope', text: 'x' }, { id: 'c', kind: 'note', text: '' }], skipped: ['s1:booked', 5] })
    expect(d.entries).toHaveLength(1)
    expect(d.entries[0]).toMatchObject({ day: 60, mood: null })
    expect(d.skipped).toEqual(['s1:booked'])
  })
  it('brings an app line up to date, but leaves the guest\'s edit and a removed line alone', () => {
    const e = (id: string, text: string) => ({ ...auto(id, 'booked'), kind: 'steps' as const, key: 'steps:1', text })
    const d = syncAuto(EMPTY_DIARY, e('a', 'Walked 100 steps.'))
    const up = syncAuto(d, e('b', 'Walked 900 steps.'))
    expect(up.entries).toHaveLength(1)
    expect(up.entries[0]).toMatchObject({ id: 'a', text: 'Walked 900 steps.', auto: true })
    expect(syncAuto(up, e('c', 'Walked 900 steps.'))).toBe(up)
    const mine = editEntry(up, 'a', 'Long walk!')
    expect(syncAuto(mine, e('d', 'Walked 2000 steps.'))).toBe(mine)
    const gone = removeEntry(up, 'a')
    expect(syncAuto(gone, e('e', 'Walked 2000 steps.'))).toBe(gone)
  })
})
