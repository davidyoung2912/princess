import { shipZoneAt } from '../../domain/sailings'
import { clockTime } from '../../domain/syncAge'
import { useSailing } from '../../hooks/useDemo'
import { t } from '../../i18n'

/** A moment as ship time ("9:14 am"), whichever zone the ship's clock is in then. */
export function useShipTime(): (at: number) => string {
  const sailing = useSailing()
  return (at) => clockTime(new Date(at), shipZoneAt(sailing, at))
}

/** "1 hour 20 minutes", "45 minutes", "less than a minute". */
export function duration(minutes: number): string {
  if (minutes < 1) return t('onb.lessThanMinute')
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  const parts: string[] = []
  if (h > 0) parts.push(t('onb.hours', { count: h }))
  if (m > 0) parts.push(t('onb.minutes', { count: m }))
  return parts.join(' ')
}
