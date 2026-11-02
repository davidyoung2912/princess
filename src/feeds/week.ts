import type { RestBlock } from '../domain/planPolish'
import { isPace, type Week, type WeekDay, type WeekItem, type WeekPrefs } from '../domain/autopilot'
import { EVENT_INTERESTS } from '../domain/program'
import { INTERESTS } from '../domain/excursions'
import type { PortId } from '../domain/sailings'
import { normalizeEntries, entriesOf } from './dayPlan'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const PORT_IDS: readonly PortId[] = ['fll', 'sea', 'cozumel', 'belize', 'roatan']
const KINDS = ['tour', 'event', 'dinner'] as const
const MOBILITY = ['any', 'easy', 'wheelchair'] as const
const HHMM = /^\d{2}:\d{2}$/
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** The preferences (and the parts of days set aside for rest, when there are any) as the server reads them, in one fixed order, so the same wishes make the same key. */
export const weekKey = (p: WeekPrefs, rest: readonly RestBlock[] = []): string =>
  JSON.stringify({ pace: p.pace, mobility: p.mobility, withKids: p.withKids, tours: [...p.tours].sort(), events: [...p.events].sort(), maxTour: p.maxTour, noEarly: p.noEarly, ...(rest.length > 0 ? { rest: [...rest].sort((a, b) => a.day - b.day).map((r) => ({ day: r.day, part: r.part })) } : {}) })

function prefsOf(raw: unknown): WeekPrefs | null {
  if (!isRecord(raw) || !isPace(raw.pace) || !oneOf(raw.mobility, MOBILITY) || typeof raw.withKids !== 'boolean' || typeof raw.noEarly !== 'boolean') return null
  if (!Array.isArray(raw.tours) || !raw.tours.every((t) => oneOf(t, INTERESTS)) || !Array.isArray(raw.events) || !raw.events.every((e) => oneOf(e, EVENT_INTERESTS))) return null
  if (raw.maxTour !== null && !isInt(raw.maxTour, 0, 99_999_900)) return null
  return { pace: raw.pace, mobility: raw.mobility, withKids: raw.withKids, tours: raw.tours, events: raw.events, maxTour: raw.maxTour, noEarly: raw.noEarly }
}

/** Reads the server's week: eight days, each with its items in time order. Anything wrong gives null. */
export function normalizeWeek(raw: unknown): Week | null {
  if (!isRecord(raw) || !Array.isArray(raw.days) || raw.days.length !== 8 || !isInt(raw.totalTours, 0, 99_999_900_00)) return null
  const prefs = prefsOf(raw.prefs)
  if (!prefs) return null
  const days: WeekDay[] = []
  for (let n = 0; n < raw.days.length; n++) {
    const d = raw.days[n]
    if (!isRecord(d) || d.day !== n + 1 || !oneOf(d.port, PORT_IDS) || !Array.isArray(d.items) || d.items.length > 12 || typeof d.restDay !== 'boolean' || !isInt(d.tourCost, 0, 99_999_900)) return null
    if (d.alternative !== null && !text(d.alternative, 200)) return null
    const items: WeekItem[] = []
    for (const i of d.items) {
      if (!isRecord(i) || !oneOf(i.kind, KINDS) || !text(i.id, 60) || !text(i.title, 120) || typeof i.start !== 'string' || !HHMM.test(i.start) || !text(i.why, 200)) return null
      items.push({ kind: i.kind, id: i.id, title: i.title, start: i.start, why: i.why })
    }
    const base = normalizeEntries(d.base, 12)
    const target = normalizeEntries(d.target, 12)
    if (!base || !target) return null
    days.push({ day: d.day, port: d.port, items, restDay: d.restDay, alternative: d.alternative, tourCost: d.tourCost, base: entriesOf(base), target: entriesOf(target) })
  }
  return { days, totalTours: raw.totalTours, prefs }
}

/** The week the server builds for a sailing and a set of wishes (see `weekKey`). Nothing is booked. */
export const weekFeed = createFeed<[sailingId: string, prefs: string], Week>((s, p) => `${s}|${p}`, normalizeWeek)
