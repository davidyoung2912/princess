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
  /** The moment now, ms (for the moments that come with the clock: sail-away, the last night, leaving the ship, home). */
  now: number
  /** Steps the guest has noted for each trip day ("1" to "8"). */
  steps: Readonly<Record<string, number>>
  /** True when every guest on the booking has the documents they need. */
  docsReady: boolean
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
    // The key carries no count; `syncAuto` keeps the count current until the guest edits the line.
    out.push({ day, at: dayStart(d, 20), kind: 'photo', key: `photo:${day}`, text: count === 1 ? t('diary.auto.photo.one') : t('diary.auto.photo.many', { count }) })
  }
  for (const [k, n] of Object.entries(s.steps)) {
    const day = Number(k)
    const d = byDay.get(day)
    if (d && n > 0 && day >= 1 && day <= s.today) out.push({ day, at: dayStart(d, 21), kind: 'steps', key: `steps:${day}`, text: t('diary.auto.steps', { n: n.toLocaleString('en-US') }) })
  }
  out.push(...momentLines(s))
  return out.sort((a, b) => a.day - b.day || a.at - b.at)
}

const hhmm = (v: string | undefined, fallback: [number, number]): [number, number] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? '')
  return m ? [Number(m[1]), Number(m[2])] : fallback
}

/**
 * The moments (docs/experience-extension-ideas.md 4.3) that write a line: documents ready, sail-away, the last night, leaving the ship and home.
 * Documents come from what the guest holds; the rest come with the itinerary and the clock. Muster and the medallion are not recorded anywhere, so they write nothing.
 */
function momentLines(s: DiarySources): DiaryLineSpec[] {
  const out: DiaryLineSpec[] = []
  const first = s.days[0]
  const last = s.days[s.days.length - 1]
  if (!first || !last) return out
  const add = (day: number, at: number, id: string, text: string): void => { if (s.now >= at) out.push({ day, at, kind: 'moment', key: `moment:${id}`, text }) }
  // Documents are an event with no date of its own: the line is written the first time the diary sees them all ready, and it sits before the ship.
  if (s.docsReady && s.today === 0) out.push({ day: 0, at: s.now, kind: 'docs', key: 'moment:docs', text: t('diary.auto.docs') })
  if (s.docsReady && s.today > 0) out.push({ day: 0, at: (Date.parse(`${first.date}T00:00:00Z`) || 0) - 1, kind: 'docs', key: 'moment:docs', text: t('diary.auto.docs') })
  const [h, m] = hhmm(first.depart, [17, 0])
  add(first.day, dayStart(first, h, m), 'sail', t('diary.auto.sail'))
  const eve = s.days.length >= 3 ? s.days[s.days.length - 2] : undefined
  if (eve) add(eve.day, dayStart(eve, 18), 'lastNight', t('diary.auto.lastNight'))
  add(last.day, dayStart(last, 8), 'off', t('diary.auto.off'))
  add(last.day, dayStart(last, 18), 'home', t('diary.auto.home'))
  return out
}
