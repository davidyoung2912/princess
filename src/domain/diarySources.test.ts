import { describe, expect, it } from 'vitest'
import { EXCURSIONS } from './excursions'
import { VENUES } from './dining'
import { clockMomentTimes, photoDiaryKey, photoDiaryLine, sourceLines, type DiarySources } from './diarySources'
import type { ItineraryDay } from './sailings'

const day = (n: number, port: string): ItineraryDay => ({ day: n, date: `2027-03-0${6 + n}`, port } as ItineraryDay)
const days = [day(1, 'fll'), day(2, 'sea'), day(3, 'cozumel')]
const venue = VENUES[0]

describe('diary lines from meals, tours and photos', () => {
  it('writes a dinner line only once its day has begun', () => {
    const meals = [{ venueId: venue.id, day: 2, time: '18:30' }]
    expect(sourceLines({ days, today: 1, now: 0, steps: {}, docsReady: false, tours: [], meals, photoDays: [] })).toEqual([])
    const [l] = sourceLines({ days, today: 2, now: 0, steps: {}, docsReady: false, tours: [], meals, photoDays: [] })
    expect(l).toMatchObject({ day: 2, kind: 'meal', key: `meal:2:${venue.id}` })
    expect(l.text).toContain(venue.name)
    expect(l.text).toContain('18:30')
  })
  it('puts a tour on the first day in its port, and skips unknown ones', () => {
    const tour = EXCURSIONS.find((x) => days.some((d) => d.port === x.port))
    if (tour) {
      const first = days.find((d) => d.port === tour.port)!.day
      const lines = sourceLines({ days, today: 3, now: 0, steps: {}, docsReady: false, tours: [tour.id, 'nope'], meals: [], photoDays: [] })
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatchObject({ day: first, kind: 'tour', key: `tour:${tour.id}` })
    }
    expect(sourceLines({ days, today: 3, now: 0, steps: {}, docsReady: false, tours: ['nope'], meals: [], photoDays: [] })).toEqual([])
  })
  it('counts photos per day and ignores days that have not begun', () => {
    const lines = sourceLines({ days, today: 2, now: 0, steps: {}, docsReady: false, tours: [], meals: [], photoDays: [1, 1, 1, 2, 3, 9] })
    expect(lines.map((l) => [l.day, l.key])).toEqual([[1, 'photo:1'], [2, 'photo:2']])
    expect(lines[0].text).toContain('3 photos')
    expect(lines[1].text).toContain('One photo')
  })
})

describe('steps and moments', () => {
  const base: DiarySources = { days, today: 3, now: 0, steps: {}, docsReady: false, tours: [], meals: [], photoDays: [] }
  const keys = (x: Partial<DiarySources>) => sourceLines({ ...base, ...x }).map((l) => l.key)
  it('writes a steps line for each day with steps, once the day has begun', () => {
    const lines = sourceLines({ ...base, today: 2, steps: { '1': 8400, '2': 0, '3': 5000 } })
    expect(lines.map((l) => l.key)).toEqual(['steps:1'])
    expect(lines[0].text).toContain('8,400')
  })
  it('writes the clock moments only after their time, and the documents moment before the ship', () => {
    const at = (iso: string) => Date.parse(iso)
    expect(keys({ now: at('2027-03-07T09:00:00Z') })).toEqual([])
    expect(keys({ now: at('2027-03-07T20:00:00Z') })).toEqual(['moment:sail'])
    expect(keys({ now: at('2027-03-08T19:00:00Z') })).toContain('moment:lastNight')
    expect(keys({ now: at('2027-03-09T09:00:00Z') })).toContain('moment:off')
    expect(keys({ now: at('2027-03-09T19:00:00Z') })).toContain('moment:home')
    const docs = sourceLines({ ...base, today: 0, now: 5, docsReady: true })
    expect(docs).toEqual([expect.objectContaining({ day: 0, kind: 'docs', key: 'moment:docs' })])
    expect(sourceLines({ ...base, docsReady: true }).find((l) => l.key === 'moment:docs')!.day).toBe(0)
  })
})

describe('muster line', () => {
  const base: DiarySources = { days, today: 1, now: 0, steps: {}, docsReady: false, tours: [], meals: [], photoDays: [] }
  it('is written on day 1 once the drill is done, and not before', () => {
    expect(sourceLines({ ...base, musterDoneAt: null }).map((l) => l.key)).not.toContain('moment:muster')
    const l = sourceLines({ ...base, musterDoneAt: 123 }).find((x) => x.key === 'moment:muster')
    expect(l).toMatchObject({ day: days[0].day, at: 123, kind: 'moment' })
    expect(sourceLines({ ...base, today: 0, musterDoneAt: 123 }).map((x) => x.key)).not.toContain('moment:muster')
  })
})

describe('clockMomentTimes', () => {
  it('orders sail-away, the last night, leaving the ship and home', () => {
    const times = clockMomentTimes(days)
    expect(times).not.toBeNull()
    expect(times!.sail).toBeLessThan(times!.lastNight!)
    expect(times!.lastNight!).toBeLessThan(times!.off)
    expect(times!.off).toBeLessThan(times!.home)
    expect(clockMomentTimes([])).toBeNull()
  })
})

describe('photoDiaryLine', () => {
  it('writes one line on the day and time the photo was taken', () => {
    const l = photoDiaryLine({ id: 'pool-2', day: 2, time: '11:30', title: 'Lido pool, sea day' }, days)!
    expect(l).toMatchObject({ day: 2, kind: 'photo', key: 'pic:pool-2' })
    expect(l.at).toBe(Date.parse('2027-03-08T11:30:00Z'))
    expect(l.text).toContain('Lido pool')
  })
  it('keeps the key within the diary limit and skips a day that is not on the sailing', () => {
    expect(photoDiaryKey('x'.repeat(80)).length).toBeLessThanOrEqual(40)
    expect(photoDiaryLine({ id: 'a', day: 9, time: '10:00', title: 'x' }, days)).toBeNull()
  })
})
