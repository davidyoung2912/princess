import type { Card } from './export'
import type { TripEntry } from './tripDiary'

/**
 * The passport stamp book (docs/look-and-feel-recommendations.md 5.6): one stamp for each stage the guest finished and each port the ship has reached.
 * It is made from the itinerary and the Trip Diary, so it needs nothing of its own to be kept. No points and no levels; a stamp is only a dated record.
 * Pure, so it is tested in node.
 */
export const STAGE_STAMPS = ['booked', 'checkedIn', 'pass', 'aboard'] as const
export type StageStamp = (typeof STAGE_STAMPS)[number]

export type Stamp =
  | { id: string; kind: 'stage'; ref: StageStamp; date: string | null }
  | { id: string; kind: 'port'; ref: string; date: string }

export interface StampDay { day: number; date: string; port: string }
export interface StampBook { earned: Stamp[]; waiting: Stamp[] }

const STAGE_KINDS: Partial<Record<StageStamp, TripEntry['kind']>> = { booked: 'booked', checkedIn: 'checkedIn', pass: 'pass' }
const isoDay = (at: number): string | null => (at > 0 ? new Date(at).toISOString().slice(0, 10) : null)

/**
 * Stamps for one sailing. A stage is earned when the diary holds its line; "aboard" is earned on the first day of the itinerary. A port is earned on the
 * first day the ship is there (a day at sea gets no stamp), and a port visited twice is stamped once. `waiting` lists the ports still ahead, in order.
 */
export function stampBook(days: readonly StampDay[], today: number, diary: readonly TripEntry[]): StampBook {
  const earned: Stamp[] = []
  const waiting: Stamp[] = []
  for (const ref of STAGE_STAMPS) {
    if (ref === 'aboard') {
      if (today >= 1 && days[0]) earned.push({ id: 'stage:aboard', kind: 'stage', ref, date: days[0].date })
      continue
    }
    const line = diary.find((e) => e.kind === STAGE_KINDS[ref])
    if (line) earned.push({ id: `stage:${ref}`, kind: 'stage', ref, date: isoDay(line.at) })
  }
  const seen = new Set<string>()
  for (const d of days) {
    if (d.port === 'sea' || seen.has(d.port)) continue
    seen.add(d.port)
    const stamp: Stamp = { id: `port:${d.port}`, kind: 'port', ref: d.port, date: d.date }
    if (d.day <= today) earned.push(stamp)
    else waiting.push(stamp)
  }
  return { earned, waiting }
}

/** The book as a card the guest can print or save as an image (the existing card tools). Words only; no logo, no link. */
export function stampBookCard(i: { title: string; dates: string; lines: readonly string[]; footer: string }): Card {
  return { id: 'stamp-book', title: i.title, subtitle: i.dates, lines: [...i.lines], footer: i.footer }
}
