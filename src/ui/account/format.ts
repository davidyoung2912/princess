import { formatDate } from '../../domain/cruise'
import { dateIn } from '../../domain/timezones'
import type { NextActionId } from '../../domain/trip'
import { t } from '../../i18n'

/** "42 days to go", "Sailing today", or "Sailed". */
export function countdown(days: number): string {
  return days > 0 ? t('trip.countdown', { count: days }) : days === 0 ? t('trip.today') : t('trip.sailed')
}

/** Where each next action leads. */
export const NEXT_LINK: Record<NextActionId, string | null> = { payOverdue: '/me/payments', documents: '/me/documents', payDue: '/me/payments', checkin: '/home/check-in', allSet: null }

/** "Sat, 6 Mar 2027" for a moment in ship home time. */
export const formatMoment = (epoch: number): string => formatDate(dateIn(epoch, 'America/New_York'))

/** "Oct 30, 2026, 4:15 PM" for a moment in ship home time. */
export const formatDateTime = (epoch: number): string => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(epoch)
