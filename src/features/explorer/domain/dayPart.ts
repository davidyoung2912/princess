/** The part of the day a clock time falls in, for the icon beside a start time. Ship time "HH:MM" (an hour of 24 or more counts as the small hours). */
export type DayPart = 'smallHours' | 'morning' | 'day' | 'evening' | 'night'

/** Small hours 00:00 to 04:59, morning 05:00 to 08:59, daytime 09:00 to 16:59, evening 17:00 to 19:59, night 20:00 to 23:59. Null for something that is not a time. */
export function dayPartOf(time: string): DayPart | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!m) return null
  const h = Number(m[1]) % 24
  return h < 5 ? 'smallHours' : h < 9 ? 'morning' : h < 17 ? 'day' : h < 20 ? 'evening' : 'night'
}
