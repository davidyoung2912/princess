import { offlineModeOf } from '../../domain/offlineContract'
import { useOnline } from '../hooks/useOnline'
import { t, type StringKey } from '../i18n'

/** Says what this screen can do with no signal before the guest commits to anything (MOB-05, OFF-01). Shown once the connection drops. While online nothing is said about queued sending, and a screen that shows its saved copy says nothing here (the copy carries its own age). */
export function OfflineNote({ path }: { path: string }) {
  const online = useOnline()
  const mode = offlineModeOf(path)
  if (mode === 'offline' || mode === 'view-only' || (online && (mode === 'needs-connection' || mode === 'queued'))) return null
  return <p className={`offline-note offline-note--${mode}`} role="note">{t(`offline.mode.${mode}` as StringKey)}</p>
}
