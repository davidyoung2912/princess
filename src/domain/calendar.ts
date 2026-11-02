import { addDays, zonedToEpoch } from './timezones'

export interface IcsEvent {
  uid: string
  summary: string
  description: string
  location: string
  /** First day, "YYYY-MM-DD". */
  start: string
  /** Last day, inclusive. */
  end: string
  /** When the file was made. */
  stamp: number
  /** A start time "HH:MM" on the first day, in the place's own clock (written without a zone, so it shows at that clock time). All-day when absent. */
  at?: string
  /** The IANA zone of `at`. When given, the time is written in UTC so every calendar shows it at the right moment wherever the phone is; without it the time is floating. */
  zone?: string
  /** Length in minutes of a timed event; an hour when absent. */
  minutes?: number
  /** A soft hold: shown as tentative and never a booking. */
  tentative?: boolean
}

const escapeText = (text: string): string => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const compact = (date: string): string => date.replace(/-/g, '')
const clock = (date: string, time: string, plus = 0): string => {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + plus
  const day = addDays(date, Math.floor(total / 1440))
  const m = ((total % 1440) + 1440) % 1440
  return `${compact(day)}T${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`
}
const utcOf = (epoch: number): string => new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const stampOf = (epoch: number): string => new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Lines are folded at 75 characters, continuing with a space, as the format requires. */
function fold(line: string): string[] {
  const out: string[] = []
  let rest = line
  while (rest.length > 75) { out.push(rest.slice(0, 75)); rest = ` ${rest.slice(75)}` }
  out.push(rest)
  return out
}

/** A calendar file (iCalendar) with all-day events, one per entry, for "add to calendar" (BOK-07, S2-05). */
export function buildIcsCalendar(events: readonly IcsEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Princess concept//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stampOf(e.stamp)}`,
      ...(e.at && e.zone ? (() => { const s = zonedToEpoch(e.start, e.at, e.zone); return [`DTSTART:${utcOf(s)}`, `DTEND:${utcOf(s + (e.minutes ?? 60) * 60_000)}`] })()
        : e.at ? [`DTSTART:${clock(e.start, e.at)}`, `DTEND:${clock(e.start, e.at, e.minutes ?? 60)}`] : [`DTSTART;VALUE=DATE:${compact(e.start)}`, `DTEND;VALUE=DATE:${compact(addDays(e.end, 1))}`]),
      ...(e.tentative ? ['STATUS:TENTATIVE', 'TRANSP:TRANSPARENT'] : []),
      `SUMMARY:${escapeText(e.summary)}`, `DESCRIPTION:${escapeText(e.description)}`, `LOCATION:${escapeText(e.location)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return `${lines.flatMap(fold).join('\r\n')}\r\n`
}

/** A calendar file with one all-day event that covers the whole cruise, for "add to calendar" (BOK-07). */
export const buildIcs = (e: IcsEvent): string => buildIcsCalendar([e])
