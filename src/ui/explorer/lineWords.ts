import { formatDate, formatTime } from '../../domain/cruise'
import type { TileLine } from '../../domain/explorer/lens'
import { t } from '../../i18n'

/** A line's words; a date or a time in its parameters is shown the way the rest of the app shows it. */
export function lineWords({ key, params }: TileLine): string {
  if (!params) return t(key)
  const p = { ...params }
  if (typeof p.date === 'string') p.date = p.date ? formatDate(p.date) : ''
  if (typeof p.time === 'string' && /^\d{2}:\d{2}$/.test(p.time)) p.time = formatTime(p.time)
  return t(key, p)
}
