import { Link } from 'react-router'
import type { SharingFacet } from '../domain/partyShare'
import { useSharing } from '../hooks/useSharing'
import { t, type StringKey } from '../i18n'

/**
 * Says what the guest chose to share with their party (XG-02) for the thing a group screen shows, and lets them change it there.
 * Nothing is shared until it is ticked; the medical card is never shared and has no tick. The server enforces the choice for everyone else on the booking.
 */
export function SharingNote({ field }: { field: SharingFacet }) {
  const { sharing, set } = useSharing()
  const on = sharing[field]
  return (
    <div className="explain">
      <label className="choice">
        <input type="checkbox" checked={on} onChange={(e) => set(field, e.target.checked)} />
        <span>{t(`org.field.${field}` as StringKey)}: {t(on ? 'share.on' : 'share.off')}</span>
      </label>
      <p className="muted">{t('share.note')} <Link to="/plan/organiser">{t('route.organiser')}</Link></p>
    </div>
  )
}
