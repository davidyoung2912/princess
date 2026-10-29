import { t } from '../i18n'
import { ageLabel, type SyncState } from '../domain/syncAge'
import { Sync, WifiOff } from './icons'

interface SyncChipProps {
  updated: Date
  now: Date
  state: SyncState
  /** The time zone the time is shown in (the ship's, on board). */
  timeZone?: string
}

/** "Updated 9:14 am" on every cached view; "Offline: showing the copy saved at 9:14 am" when the connection is down. */
export function SyncChip({ updated, now, state, timeZone }: SyncChipProps) {
  const label = ageLabel(updated, now, state, timeZone)
  const text = label.kind === 'justNow' ? t('sync.justNow') : label.kind === 'updatedAt' ? t('sync.updatedAt', { time: label.time ?? '' }) : t('sync.offlineSince', { time: label.time ?? '' })
  const Icon = state === 'offline' ? WifiOff : Sync
  return (
    <p className={`sync-chip sync-chip--${state}`} role="status">
      <Icon aria-hidden="true" />
      <span>{text}</span>
    </p>
  )
}
