import { describe, expect, it } from 'vitest'
import { EXCURSIONS } from './excursions'
import { VENUES } from './dining'
import { sourceLines } from './diarySources'
import type { ItineraryDay } from './sailings'

const day = (n: number, port: string): ItineraryDay => ({ day: n, date: `2027-03-0${6 + n}`, port } as ItineraryDay)
const days = [day(1, 'fll'), day(2, 'sea'), day(3, 'cozumel')]
const venue = VENUES[0]

describe('diary lines from meals, tours and photos', () => {
  it('writes a dinner line only once its day has begun', () => {
    const meals = [{ venueId: venue.id, day: 2, time: '18:30' }]
    expect(sourceLines({ days, today: 1, tours: [], meals, photoDays: [] })).toEqual([])
    const [l] = sourceLines({ days, today: 2, tours: [], meals, photoDays: [] })
    expect(l).toMatchObject({ day: 2, kind: 'meal', key: `meal:2:${venue.id}` })
    expect(l.text).toContain(venue.name)
    expect(l.text).toContain('18:30')
  })
  it('puts a tour on the first day in its port, and skips unknown ones', () => {
    const tour = EXCURSIONS.find((x) => days.some((d) => d.port === x.port))
    if (tour) {
      const first = days.find((d) => d.port === tour.port)!.day
      const lines = sourceLines({ days, today: 3, tours: [tour.id, 'nope'], meals: [], photoDays: [] })
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatchObject({ day: first, kind: 'tour', key: `tour:${tour.id}` })
    }
    expect(sourceLines({ days, today: 3, tours: ['nope'], meals: [], photoDays: [] })).toEqual([])
  })
  it('counts photos per day and ignores days that have not begun', () => {
    const lines = sourceLines({ days, today: 2, tours: [], meals: [], photoDays: [1, 1, 1, 2, 3, 9] })
    expect(lines.map((l) => [l.day, l.key])).toEqual([[1, 'photo:1'], [2, 'photo:2']])
    expect(lines[0].text).toContain('3 photos')
    expect(lines[1].text).toContain('One photo')
  })
})
