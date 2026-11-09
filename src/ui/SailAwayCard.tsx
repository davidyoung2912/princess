import type { OnboardToday } from '../api/types'
import { relativeIn } from '../domain/homeLook'
import { sailAwayPhase } from '../domain/shipLook'
import { timeIn } from '../domain/timezones'
import { useNow } from '../hooks/useDemo'
import { t } from '../i18n'
import { LinkButton } from './Button'
import { Card } from './Card'
import { relativeText } from './relativeText'

/** The sail-away moment (L4, F7): from an hour before the ship leaves until two hours after, a card with the wake, "We are underway", and one tap to the diary or the photos. No sound, no pop-up. */
export function SailAwayCard({ today }: { today: OnboardToday }) {
  const now = useNow()
  const phase = sailAwayPhase(now, today.sailAwayAt)
  if (!phase || today.sailAwayAt === null) return null
  const rel = phase === 'soon' ? relativeIn(today.sailAwayAt - now) : null
  return (
    <Card hero labelledBy="sail-h">
      <div className="sailaway">
        <svg className="sailaway__wake calm-hide" width="64" height="24" viewBox="0 0 64 24" aria-hidden="true" focusable="false">
          <path d="M2 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M2 17 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h2 id="sail-h" className="card__title">{phase === 'soon' ? t('look.sail.soon', { time: timeIn(today.sailAwayAt, today.shipZone) }) : t('look.sail.underway')}</h2>
        <p>{phase === 'soon' ? t('look.sail.soon.body') : t('look.sail.underway.body')}</p>
        {rel && <p><strong>{relativeText(rel)}</strong></p>}
        <div className="button-row">
          <LinkButton to="/me/diary">{t('look.sail.diary')}</LinkButton>
          <LinkButton to="/ship/photos" variant="secondary">{t('look.sail.photo')}</LinkButton>
        </div>
      </div>
    </Card>
  )
}
