import { Link } from 'react-router'
import type { PrivacyField } from '../domain/planning'
import { useMemory } from '../hooks/useMemory'
import { t, type StringKey } from '../i18n'

/**
 * Says what the guest's privacy default (XG-02) is for the thing a group screen shows, and lets them change it there.
 * Nothing is shared until it is ticked; the medical card is never shared and has no tick.
 */
export function SharingNote({ field }: { field: Exclude<PrivacyField, 'medical'> }) {
  const { state, update } = useMemory()
  const on = state.planning.privacy[field]
  const set = (v: boolean) => update((s) => ({ ...s, planning: { ...s.planning, privacy: { ...s.planning.privacy, [field]: v } } }))
  return (
    <div className="explain">
      <label className="choice">
        <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
        <span>{t(`org.field.${field}` as StringKey)}: {t(on ? 'share.on' : 'share.off')}</span>
      </label>
      <p className="muted">{t('share.note')} <Link to="/plan/organiser">{t('route.organiser')}</Link></p>
    </div>
  )
}
