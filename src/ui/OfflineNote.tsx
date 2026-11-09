import { offlineModeOf } from '../domain/offlineContract'
import { useOnline } from '../hooks/useOnline'
import { t, type StringKey } from '../i18n'

/** Says what this screen can do with no signal before the guest commits to anything (MOB-05, OFF-01). Always shown where behaviour differs (queued, saved copy); shown on the rest once the connection drops. */
export function OfflineNote({ path }: { path: string }) {
  const online = useOnline()
  const mode = offlineModeOf(path)
  if (mode === 'offline' || (online && mode === 'needs-connection')) return null
  return <p className={`offline-note offline-note--${mode}`} role="note">{t(`offline.mode.${mode}` as StringKey)}</p>
}
