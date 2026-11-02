import type { SimWeather } from './autopilot'
import { minutesOf, type PlanRow } from './planChange'
import type { SkyNight } from './sky'

/**
 * Morning briefing and evening preview (XA-04): one short digest, never more than `MAX_LINES` lines, each with the screen it came from.
 * A line with nothing to say is left out. It is built when the guest opens it; it is never sent by itself. Pure.
 */
export type BriefingKind = 'morning' | 'evening'
export interface BriefingLine { id: 'weather' | 'changed' | 'next' | 'deadline' | 'aboard' | 'sunset' | 'tomorrow'; text: string; path?: string }
export interface Briefing { kind: BriefingKind; title: string; lines: BriefingLine[] }

export const MAX_LINES = 5
export const EVENING_FROM = '16:00'

export interface BriefingFacts {
  /** Ship time now, "HH:MM". */
  nowHhmm: string
  plan: readonly PlanRow[]
  weather: SimWeather
  sky: SkyNight
  /** Deadlines still to meet, soonest first; null when the list has not loaded. */
  deadlines: readonly { label: string; path: string }[] | null
  /** "HH:MM" local, on a port day. */
  allAboard: string | null
  /** Tomorrow's first thing, if any. */
  tomorrowFirst: { start: string; title: string; path: string } | null
}

export const kindAt = (nowHhmm: string): BriefingKind => (minutesOf(nowHhmm) >= minutesOf(EVENING_FROM) ? 'evening' : 'morning')

const live = (rows: readonly PlanRow[]): PlanRow[] => rows.filter((r) => r.state !== 'dropped').sort((a, b) => minutesOf(a.entry.start) - minutesOf(b.entry.start))

function weatherLine(w: SimWeather): string {
  const rain = w.rainFrom ? ` Rain is likely from ${w.rainFrom} to ${w.rainTo}.` : ' No rain is expected.'
  const sun = w.uv >= 8 ? ' The sun is strong, so wear sunscreen.' : ''
  return `About ${w.tempF}°F.${rain}${sun} (A simulated forecast.)`
}

export function buildBriefing(kind: BriefingKind, f: BriefingFacts): Briefing {
  const rows = live(f.plan)
  const now = minutesOf(f.nowHhmm)
  const lines: BriefingLine[] = []
  const add = (l: BriefingLine | null) => { if (l && lines.length < MAX_LINES) lines.push(l) }

  const changed = f.plan.filter((r) => r.state === 'moved' || r.state === 'dropped' || r.state === 'added')
  const next = rows.find((r) => minutesOf(r.entry.start) >= now)

  if (kind === 'morning') {
    add({ id: 'weather', text: weatherLine(f.weather) })
    add(changed.length ? { id: 'changed', text: `${changed.length === 1 ? 'One thing has' : `${changed.length} things have`} changed in your day: ${changed.slice(0, 2).map((r) => r.entry.title).join(', ')}.`, path: '/plan/day' } : null)
    add(f.allAboard ? { id: 'aboard', text: `Be back on the ship by ${f.allAboard} (port time).`, path: '/ship/port' } : null)
    add(next ? { id: 'next', text: `First on your plan: ${next.entry.title} at ${next.entry.start}.`, path: next.entry.path } : null)
    add(f.deadlines === null ? null : f.deadlines[0] ? { id: 'deadline', text: `Still to do: ${f.deadlines[0].label}.`, path: f.deadlines[0].path } : null)
  } else {
    add(next ? { id: 'next', text: `Still to come tonight: ${next.entry.title} at ${next.entry.start}.`, path: next.entry.path } : null)
    add({ id: 'sunset', text: `Sunset is at ${f.sky.sunset}. ${f.sky.moon.name}, ${f.sky.moon.lit}% lit.` })
    add(f.tomorrowFirst ? { id: 'tomorrow', text: `Tomorrow starts with ${f.tomorrowFirst.title} at ${f.tomorrowFirst.start}.`, path: f.tomorrowFirst.path } : null)
    add(f.deadlines === null ? null : f.deadlines[0] ? { id: 'deadline', text: `Still to do: ${f.deadlines[0].label}.`, path: f.deadlines[0].path } : null)
  }
  return { kind, title: kind === 'morning' ? 'Your morning' : 'Your evening', lines }
}

/** The briefing as one block of plain text for read-aloud or copy. */
export const spoken = (b: Briefing): string => [b.title + '.', ...b.lines.map((l) => l.text)].join(' ')
