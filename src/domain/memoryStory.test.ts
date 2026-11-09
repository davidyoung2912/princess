import { describe, expect, it } from 'vitest'
import { applyOmissions, buildStory, storyCount, storyText } from './memoryStory'
import { itinerary, REFERENCE_SAILING as S } from './sailings'
import type { TripEntry } from './tripDiary'

const days = itinerary(S)
const e = (day: number, text: string, o: Partial<TripEntry> = {}): TripEntry => ({ id: text, sailingId: S.id, day, at: day, kind: 'note', text, mood: null, auto: false, key: '', ...o })
const p = (id: string, day: number, time = '10:00') => ({ id, day, time, title: `Photo ${id}` })

describe('photo-to-memory story', () => {
  it('orders days in trip order and photos by time, skipping days with nothing chosen', () => {
    const s = buildStory([p('b', 3, '15:00'), p('a', 3, '09:00'), p('c', 1)], [], days)
    expect(s.map((d) => d.day)).toEqual([1, 3])
    expect(s[1].photos.map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('uses only the guest\'s own note, never an app-written line', () => {
    const s = buildStory([p('a', 2)], [e(2, 'auto', { auto: true }), e(2, 'Lovely day')], days)
    expect(s[0].note).toBe('Lovely day')
    expect(buildStory([p('a', 2)], [e(2, 'auto', { auto: true })], days)[0].note).toBeNull()
  })
  it('keeps a day the guest wrote about even with no photo, and drops photos from days not on the sailing', () => {
    const s = buildStory([p('x', 99)], [e(4, 'Quiet one')], days)
    expect(s.map((d) => d.day)).toEqual([4])
  })
  it('lets the guest leave out photos and notes, and removes emptied days', () => {
    const s = buildStory([p('a', 2), p('b', 3)], [e(2, 'Note')], days)
    const out = applyOmissions(s, new Set(['a']), new Set([2]))
    expect(out.map((d) => d.day)).toEqual([3])
    expect(storyText(out)).not.toContain('Note')
    expect(storyCount(out)).toEqual({ days: 1, photos: 1 })
  })
  it('writes text with notes only when kept', () => {
    const s = buildStory([p('a', 2)], [e(2, 'Note')], days)
    expect(storyText(s)).toContain('Note')
    expect(storyText(applyOmissions(s, new Set(), new Set([2])))).not.toContain('Note')
  })
})
