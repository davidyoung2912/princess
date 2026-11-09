import { t } from '../i18n'
import { usePendingCount } from '../hooks/usePendingCount'
import { ageLabel, chipKind, clockTime, type SyncState } from '../domain/syncAge'
import { Sync, WifiOff } from './icons'

interface SyncChipProps {
  updated: Date
  now: Date
  state: SyncState
  /** The time zone the time is shown in (the ship's, on board). */
  timeZone?: string
  /** Set when the last lookup failed ("unavailable") or the account has no cruise ("notLinked"). A failed lookup is never shown as no cruise. */
  lookup?: 'unavailable' | 'notLinked'
}

/** "Updated 9:14 am" on every cached view; "Offline: showing the copy saved at 9:14 am" when the connection is down. */
export function SyncChip({ updated, now, state, timeZone, lookup }: SyncChipProps) {
  const label = ageLabel(updated, now, state, timeZone)
  const text = label.kind === 'justNow' ? t('sync.justNow') : label.kind === 'updatedAt' ? t('sync.updatedAt', { time: label.time ?? '' }) : t('sync.offlineSince', { time: label.time ?? '' })
  const pending = usePendingCount()
  const kind = chipKind({ state, updated, now, pending, lookup })
  const Icon = state === 'offline' || kind === 'unavailable' ? WifiOff : Sync
  return (
    <p className={`sync-chip sync-chip--${state} sync-chip--${kind}`} role="status">
      <Icon aria-hidden="true" />
      <span>{kind === 'notLinked' ? t('sync.notLinked') : kind === 'unavailable' ? t('sync.unavailable', { time: label.time ?? clockTime(updated, timeZone) }) : text}</span>
      {kind === 'pending' && <span> · {t('sync.pending', { count: pending })}</span>}
    </p>
  )
}
