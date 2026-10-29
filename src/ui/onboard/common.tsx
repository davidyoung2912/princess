import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { shipZoneAt } from '../../domain/sailings'
import { useNow, useSailing } from '../../hooks/useDemo'
import type { SavedCopy } from '../../hooks/useSavedCopy'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { SyncChip } from '../SyncChip'
import { LoadError } from '../discover/parts'

/** Shows a screen's data from a saved copy: "Updated" or "Offline, showing the copy saved at" first, then the content, or the loading or error note (OB-03). */
export function Saved<T>({ copy, children }: { copy: SavedCopy<T>; children: (data: T) => ReactNode }) {
  const now = useNow()
  const sailing = useSailing()
  if (copy.data === null) return copy.status === 'error' ? <LoadError retry={copy.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>
  return (
    <>
      {copy.at !== null && <SyncChip updated={new Date(copy.at)} now={new Date(now)} state={copy.fromCopy ? 'offline' : 'live'} timeZone={shipZoneAt(sailing, now)} />}
      {copy.fromCopy && <Banner kind="offline" title={t('onb.offline')}><p>{t('onb.offlineBody')}</p></Banner>}
      {children(copy.data)}
    </>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return <p className="book-nav"><Link to={to}>{label}</Link></p>
}
