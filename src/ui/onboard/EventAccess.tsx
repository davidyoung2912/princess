import { Link } from 'react-router'
import { eventAccess } from '../../domain/eventAccess'
import { t, type StringKey } from '../../i18n'

/** Verified access notes for an event (SEA-18), and where to ask for help. Nothing is shown for an event with nothing verified. */
export function EventAccess({ eventId }: { eventId: string }) {
  const features = eventAccess(eventId)
  if (features.length === 0) return null
  return (
    <p className="muted">
      <span className="visually-hidden">{t('evAccess.label')}: </span>
      {features.map((f) => t(`evAccess.${f}` as StringKey)).join(' · ')} · <Link to="/plan/assistance">{t('evAccess.ask')}</Link>
    </p>
  )
}
