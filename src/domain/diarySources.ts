import { venueById } from './dining'
import { excursionById } from './excursions'
import type { DiaryKind } from './tripDiary'
import type { ItineraryDay } from './sailings'
import { t } from '../i18n'

/**
 * Diary lines made from things the guest booked or kept (X7c): dinners, tours ashore and photos. Pure, so it is tested in node.
 * A line is only made once its day has begun, and each has a stable key so it is written once (see `addAuto`).
 */
export interface DiarySources {
  days: readonly ItineraryDay[]
  /** The trip day it is now (0 before the ship). */
  today: number
  /** Excursion ids the party booked (not cancelled). */
  tours: readonly string[]
  /** Dinners reserved: the venue, the trip day and the time "HH:MM". */
  meals: readonly { venueId: string; day: number; time: string }[]
  /** The trip day of each photo in the gallery. */
  photoDays: readonly number[]
}

export interface DiaryLineSpec { day: number; at: number; kind: DiaryKind; key: string; text: string }

const dayStart = (d: ItineraryDay, hour: number, minute = 0): number => (Date.parse(`${d.date}T00:00:00Z`) || 0) + (hour * 60 + minute) * 60_000

/** The lines to write now, in day order. */
export function sourceLines(s: DiarySources): DiaryLineSpec[] {
  const out: DiaryLineSpec[] = []
  const byDay = new Map(s.days.map((d) => [d.day, d]))
  for (const m of s.meals) {
    const d = byDay.get(m.day)
    const venue = venueById(m.venueId)
    if (!d || !venue || m.day > s.today) continue
    const [h, min] = m.time.split(':').map(Number)
    out.push({ day: m.day, at: dayStart(d, Number.isFinite(h) ? h : 18, Number.isFinite(min) ? min : 0), kind: 'meal', key: `meal:${m.day}:${m.venueId}`, text: t('diary.auto.meal', { venue: venue.name, time: m.time }) })
  }
  for (const id of s.tours) {
    const tour = excursionById(id)
    // A tour belongs to the first day the ship is in its port.
    const d = tour ? s.days.find((x) => x.port === tour.port) : undefined
    if (!tour || !d || d.day > s.today) continue
    out.push({ day: d.day, at: dayStart(d, 10), kind: 'tour', key: `tour:${id}`, text: t('diary.auto.tour', { tour: tour.name }) })
  }
  const counts = new Map<number, number>()
  for (const day of s.photoDays) if (byDay.has(day) && day >= 1 && day <= s.today) counts.set(day, (counts.get(day) ?? 0) + 1)
  for (const [day, count] of counts) {
    const d = byDay.get(day)!
    // The key carries no count, so the line is written once; it says how many there were when the day's photos were first seen.
    out.push({ day, at: dayStart(d, 20), kind: 'photo', key: `photo:${day}`, text: count === 1 ? t('diary.auto.photo.one') : t('diary.auto.photo.many', { count }) })
  }
  return out.sort((a, b) => a.day - b.day || a.at - b.at)
}
