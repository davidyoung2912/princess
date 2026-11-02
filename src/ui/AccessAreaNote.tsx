import { Link } from 'react-router'
import { accessNotes, type Area } from '../domain/bookingPrep'
import { useMemory } from '../hooks/useMemory'
import { t, type StringKey } from '../i18n'

/**
 * What the guest's accessibility profile (S2-06) asks of this part of the app. Shown only when the profile asks something here;
 * it is a reminder to look for these things, not a request to the ship.
 */
export function AccessAreaNote({ area }: { area: Area }) {
  const { state } = useMemory()
  const list = accessNotes(state.access)[area]
  if (list.length === 0) return null
  return (
    <aside className="explain" aria-label={t('access.areaNote')}>
      <p><strong>{t('access.areaNote')}</strong></p>
      <ul className="plain-bullets">{list.map((k) => <li key={k}>{t(`access.note.${k}` as StringKey)}</li>)}</ul>
      <p className="muted"><Link to="/plan/access">{t('access.areaChange')}</Link></p>
    </aside>
  )
}
