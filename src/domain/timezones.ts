/** Time-zone arithmetic over the platform's tz database, so daylight-saving rules are never hand-coded (POR-11). */

const formats = new Map<string, Intl.DateTimeFormat>()

function parts(epoch: number, zone: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number> {
  let f = formats.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    formats.set(zone, f)
  }
  const out: Record<string, number> = {}
  for (const p of f.formatToParts(epoch)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

/** Minutes the zone is ahead of UTC at that moment (negative in the Americas). */
export function offsetMinutes(epoch: number, zone: string): number {
  const p = parts(epoch, zone)
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(epoch / 1000) * 1000) / 60_000)
}

/** The moment a wall clock in `zone` shows the given date and time. Times skipped by a clock change land just after it. */
export function zonedToEpoch(date: string, time: string, zone: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const first = guess - offsetMinutes(guess, zone) * 60_000
  return guess - offsetMinutes(first, zone) * 60_000
}

/** The calendar date ("2027-03-21") on a wall clock in `zone`. */
export function dateIn(epoch: number, zone: string): string {
  const p = parts(epoch, zone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** A calendar date moved by whole days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "Wed 24 Mar" for the date on a wall clock in `zone`. */
export function dayLabel(epoch: number, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone }).format(epoch)
}

/** Whether `zone` is a zone the platform knows. */
export function isZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}
