import type { DayShape } from '../dayKinds'

/** What kind of day a day of the authored 7-day schedule in the research docs is. Day 1 is `embark`, the final night is `last`, the rest are `sea` or `port`. */
export type TemplateDayKind = 'embark' | 'sea' | 'port' | 'last'

/**
 * Which day of an authored schedule a day of a real sailing uses, so a 3-night or a 14-night sailing still gets a sensible programme.
 * Day 1 uses the embarkation day, the last night uses the final template day, the morning of disembarkation (the last day) has none (null),
 * and every other day takes the next template day of its own kind, wrapping round when the sailing has more sea or port days than the template.
 * A sailing with no template day of that kind borrows the other kind. Returns an index into `template`, or null.
 */
export function templateIndexFor(days: readonly DayShape[], day: number, template: readonly TemplateDayKind[]): number | null {
  const total = days.length
  if (total === 0 || template.length === 0 || day < 1 || day > total) return null
  if (day === 1) return template.indexOf('embark') >= 0 ? template.indexOf('embark') : 0
  if (day === total) return null
  const nights = total - 1
  if (day === nights) return template.lastIndexOf('last') >= 0 ? template.lastIndexOf('last') : template.length - 1

  const kind: 'sea' | 'port' = days[day - 1].port === 'sea' ? 'sea' : 'port'
  let pool = template.flatMap((k, i) => (k === kind ? [i] : []))
  if (pool.length === 0) pool = template.flatMap((k, i) => (k === 'sea' || k === 'port' ? [i] : []))
  if (pool.length === 0) return null

  let nth = 0
  for (let d = 2; d < day; d++) if (d !== nights && (days[d - 1].port === 'sea') === (kind === 'sea')) nth++
  return pool[nth % pool.length]
}
