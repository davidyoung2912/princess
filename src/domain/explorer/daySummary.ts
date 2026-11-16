import type { ExplorerDay } from '../../api/explorerTypes'
import { hasKidsMenu } from './diningDiscovery'
import { openState } from './presentation'
import { dayPhase, type DayPhase } from './upcoming'
import type { ExplorerKind } from './types'

/** What an Explorer's summary card says about the chosen day, worked out from the day's data. No wording here: the card chooses the words for each Explorer. */
export interface DaySummary {
  phase: DayPhase
  total: number
  /** Venues open right now (all day counts), on the ship's own day; on a later day, the venues that open at all that day. */
  open: number
  /** The venue that opens soonest after now, on the ship's own day. */
  nextOpen: { title: string; at: string } | null
  /** Venues shut only because the ship is alongside. */
  alongside: number
  /** When the ship sails, if it does that day. */
  sailawayAt: number | null
  /** Events still to come (not started, not cancelled) on the ship's own day; the whole day's events on a later day; none on a past day. */
  eventsLeft: number
  nextEvent: { title: string; start: string; venue: string } | null
  /** Of those, how many the guest has on their plan, are for children or teens, or cost nothing extra. */
  onPlan: number
  family: number
  included: number
  /** Restaurants: places with a children's menu, and places with a cover charge. */
  kidsMenus: number
  coverCharge: number
}

export interface SummaryClock { currentDay: number; now: string; nowAt: number }

export function summariseDay(data: ExplorerDay, clock: SummaryClock): DaySummary {
  const phase = dayPhase(data.day, clock.currentDay)
  const states = data.venues.map((v) => ({ v, s: openState(v.hours, data.day, clock.currentDay, clock.now) }))
  const open = states.filter(({ s }) => s.kind === 'openNow' || s.kind === 'openAllDay' || (phase === 'future' && s.kind === 'opensAt')).length
  const soonest = phase === 'current'
    ? states.flatMap(({ v, s }) => (s.kind === 'opensAt' ? [{ title: v.venue.title, at: s.at }] : [])).sort((a, b) => a.at.localeCompare(b.at))[0] ?? null
    : null
  const events = phase === 'past' ? [] : data.venues.flatMap((v) => v.events.filter((e) => e.status !== 'cancelled' && (phase === 'future' || e.startAt > clock.nowAt)).map((e) => ({ e, venue: v.venue.title })))
  events.sort((a, b) => a.e.startAt - b.e.startAt || a.e.id.localeCompare(b.e.id))
  const first = events[0]
  return {
    phase,
    total: data.venues.length,
    open,
    nextOpen: soonest,
    alongside: states.filter(({ s }) => s.kind === 'alongside').length,
    sailawayAt: data.sailawayAt ?? null,
    eventsLeft: events.length,
    nextEvent: first ? { title: first.e.title, start: first.e.start, venue: first.venue } : null,
    onPlan: events.filter(({ e }) => data.mine.includes(e.id)).length,
    family: events.filter(({ e }) => e.age === 'kids' || e.age === 'teens').length,
    included: events.filter(({ e }) => e.extra === 0).length,
    kidsMenus: data.venues.filter((v) => hasKidsMenu(v.venue)).length,
    coverCharge: data.venues.filter((v) => (v.venue.cover ?? 0) > 0).length,
  }
}

/** One line of the card: the end of its `exp.sum.` string key, and what goes into it. */
export interface SummaryLine { key: string; params: Record<string, string | number> }

/**
 * The lines an Explorer's card shows, most useful first and at most four. Each Explorer has its own wording for hours and for what is on; the dining
 * Explorer has no events, so it speaks of children's menus and cover charges instead.
 */
export function summaryLines(kind: ExplorerKind, s: DaySummary, day: number, formatTime: (hhmm: string) => string): SummaryLine[] {
  if (s.phase === 'past') return [{ key: 'past', params: { day } }]
  const lines: SummaryLine[] = []
  const later = s.phase === 'future'
  if (later) lines.push({ key: `${kind}.openDay`, params: { open: s.open, total: s.total, day } })
  else if (s.open > 0) lines.push({ key: `${kind}.open`, params: { open: s.open, total: s.total } })
  else if (kind === 'shopping' && s.alongside > 0 && s.nextOpen === null) lines.push({ key: 'shopping.alongside', params: {} })
  else if (s.nextOpen) lines.push({ key: `${kind}.nothingOpen`, params: { title: s.nextOpen.title, time: formatTime(s.nextOpen.at) } })
  else lines.push({ key: `${kind}.closed`, params: {} })
  if (s.open > 0 && s.nextOpen && !later && kind === 'dining') lines.push({ key: 'dining.nextOpen', params: { title: s.nextOpen.title, time: formatTime(s.nextOpen.at) } })
  if (kind === 'dining') {
    if (s.kidsMenus > 0) lines.push({ key: 'dining.kids', params: { count: s.kidsMenus } })
    if (s.coverCharge > 0) lines.push({ key: 'dining.cover', params: { count: s.coverCharge } })
    return lines.slice(0, 4)
  }
  if (s.nextEvent) lines.push({ key: `${kind}.${later ? 'firstDay' : 'next'}`, params: { title: s.nextEvent.title, time: formatTime(s.nextEvent.start), venue: s.nextEvent.venue, day } })
  if (s.eventsLeft > 0) lines.push({ key: `${kind}.${later ? 'onDay' : 'left'}`, params: { count: s.eventsLeft, day } })
  if (s.onPlan > 0) lines.push({ key: 'plan', params: { count: s.onPlan } })
  else if (kind === 'activities' && s.family > 0) lines.push({ key: 'activities.family', params: { count: s.family } })
  else if (s.included > 0 && s.included < s.eventsLeft) lines.push({ key: 'included', params: { count: s.included } })
  return lines.slice(0, 4)
}
