/**
 * Which days of a sailing an authored event, show, activity or desk runs on, by kind of day instead of by day number, so the same programme fits a
 * 3-night or a 31-night sailing. The server has the same rule in `DayKinds.cs`; both are tested against the sample week.
 *
 * `embark` day 1 · `night` every day with a night aboard (day 1 to the last night) · `last` the last night · `sea` every sea day ·
 * `seaMid` every sea day except the last night · `firstSea` the first sea day · `port` every port of call · `portOdd` and `portEven` the first, third...
 * and the second, fourth... port of call · `friday` a calendar Friday (the Shabbat service).
 */
export type DayKind = 'embark' | 'night' | 'last' | 'sea' | 'seaMid' | 'firstSea' | 'port' | 'portOdd' | 'portEven' | 'friday'

export const DAY_KINDS: readonly DayKind[] = ['embark', 'night', 'last', 'sea', 'seaMid', 'firstSea', 'port', 'portOdd', 'portEven', 'friday']

export const isDayKind = (v: unknown): v is DayKind => (DAY_KINDS as readonly unknown[]).includes(v)

/** One day of the sailing: its port id ("sea" for a sea day; the first and last days are the home port) and its calendar date, "YYYY-MM-DD". */
export interface DayShape { port: string; date: string }

const isCall = (days: readonly DayShape[], day: number): boolean => days[day - 1].port !== 'sea' && day !== 1 && day !== days.length

const callNumber = (days: readonly DayShape[], day: number): number => {
  let n = 0
  for (let d = 1; d <= day; d++) if (isCall(days, d)) n++
  return n
}

export function isDayKindOn(days: readonly DayShape[], day: number, kind: DayKind): boolean {
  if (day < 1 || day > days.length) return false
  const nights = days.length - 1
  const at = days[day - 1]
  switch (kind) {
    case 'embark': return day === 1
    case 'night': return day <= nights
    case 'last': return day === nights
    case 'sea': return at.port === 'sea'
    case 'seaMid': return at.port === 'sea' && day < nights
    case 'firstSea': return at.port === 'sea' && days.findIndex((d) => d.port === 'sea') === day - 1
    case 'port': return isCall(days, day)
    case 'portOdd': return isCall(days, day) && callNumber(days, day) % 2 === 1
    case 'portEven': return isCall(days, day) && callNumber(days, day) % 2 === 0
    case 'friday': return new Date(`${at.date}T00:00:00Z`).getUTCDay() === 5
  }
}

/** Whether something that says when it runs (any one kind is enough) runs on the day. */
export const runsOn = (days: readonly DayShape[], day: number, when: readonly DayKind[]): boolean => when.some((k) => isDayKindOn(days, day, k))

/** The days of the sailing on which any of the kinds holds. */
export const daysOf = (days: readonly DayShape[], ...when: DayKind[]): number[] => days.map((_, i) => i + 1).filter((d) => runsOn(days, d, when))
