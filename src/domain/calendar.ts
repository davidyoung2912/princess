import { addDays } from './timezones'

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
}

const escapeText = (text: string): string => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const compact = (date: string): string => date.replace(/-/g, '')
const stampOf = (epoch: number): string => new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Lines are folded at 75 characters, continuing with a space, as the format requires. */
function fold(line: string): string[] {
  const out: string[] = []
  let rest = line
  while (rest.length > 75) { out.push(rest.slice(0, 75)); rest = ` ${rest.slice(75)}` }
  out.push(rest)
  return out
}

/** A calendar file (iCalendar) with one all-day event that covers the whole cruise, for "add to calendar" (BOK-07). */
export function buildIcs(e: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Princess concept//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stampOf(e.stamp)}`,
    `DTSTART;VALUE=DATE:${compact(e.start)}`, `DTEND;VALUE=DATE:${compact(addDays(e.end, 1))}`,
    `SUMMARY:${escapeText(e.summary)}`, `DESCRIPTION:${escapeText(e.description)}`, `LOCATION:${escapeText(e.location)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return `${lines.flatMap(fold).join('\r\n')}\r\n`
}
