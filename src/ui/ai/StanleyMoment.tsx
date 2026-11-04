import { useSyncExternalStore } from 'react'
import { Anchor, ClipboardCheck, Ticket } from 'lucide-react'
import stanley from '../../assets/stanley-small.png'
import { momentKey, momentOf, momentsShow, type MomentId, type StampIcon } from '../../ai/stanleyMoments'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { isSeen, markSeen, seenVersion, subscribeSeen } from '../../settings/stanleySeen'
import { stanleyLevelFor } from '../../settings/settings'
import { Button, LinkButton } from '../Button'

const STAMPS: Record<StampIcon, typeof Ticket> = { ticket: Ticket, clipboard: ClipboardCheck, anchor: Anchor }

/**
 * A small celebration (docs/experience-extension-ideas.md 4.3): an ink stamp lands, Stanley says one line, and there is one way on. It plays once for each
 * thing (a booking, say) and then stays out of the way. It is plain text in a labelled region (not a live region), the stamp is decorative, and the motion
 * stops under reduced motion and in calm mode. At "Only when asked", Off, calm and simple mode it does not show.
 */
export function StanleyMoment({ id, subject }: { id: MomentId; subject: string }) {
  const [settings] = useSettings()
  useSyncExternalStore(subscribeSeen, seenVersion, seenVersion)
  const key = momentKey(id, subject)
  if (!momentsShow(stanleyLevelFor(settings)) || isSeen(key)) return null
  const def = momentOf(id)
  const Stamp = STAMPS[def.stamp]
  return (
    <aside className="stanley-moment no-print" aria-label={t('stanley.moment.label')}>
      <span className="stanley-moment__stamp" aria-hidden="true"><Stamp size={28} /></span>
      <img className="stanley-moment__face" src={stanley} alt="" width="192" height="192" />
      <div className="stanley-moment__text">
        <h2 className="stanley-moment__title">{t(`stanley.moment.${id}.title` as StringKey)}</h2>
        <p>{t(`stanley.moment.${id}.line` as StringKey)}</p>
        <div className="stanley-moment__actions">
          <LinkButton to={def.to} variant="secondary" onClick={() => markSeen(key)}>{t(`stanley.moment.${id}.go` as StringKey)}</LinkButton>
          <Button variant="secondary" onClick={() => markSeen(key)}>{t('stanley.moment.done')}</Button>
        </div>
      </div>
    </aside>
  )
}
