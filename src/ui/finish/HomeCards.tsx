import { Link } from 'react-router'
import { asNightView } from '../../api/guards'
import { nextNightItem } from '../../domain/disembark'
import { api } from '../../runtime'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { useReached, useSailed } from '../../hooks/useStage'

/** On the last day aboard: the next thing to do before the morning, and the way to the disembarkation plan (DEB-01, DEB-07). */
export function DisembarkCard() {
  return useReached('farewell') ? <DisembarkNext /> : null
}

function DisembarkNext() {
  const me = usePersona()
  const night = useSavedCopy('night', me?.booker ?? 'none', () => api.disembark.night(), asNightView, [me?.id])
  const shipTime = useShipTime()
  return (
    <Card hero labelledBy="home-dis-h">
      <h2 id="home-dis-h" className="card__title">{t('route.disembark')}</h2>
      <Saved copy={night}>
        {(v) => {
          const next = nextNightItem(v.entries)
          return <p>{next ? t('night.next', { what: t(`night.item.${next.id}` as StringKey), time: shipTime(next.dueAt) }) : t('night.allDone')}</p>
        }}
      </Saved>
      <div className="button-row">
        <LinkButton to="/home/disembark">{t('route.disembark')}</LinkButton>
        <LinkButton to="/home/disembark/final-night" variant="secondary">{t('route.finalNight')}</LinkButton>
      </div>
    </Card>
  )
}

/** After you have left the ship: rate the cruise, see rewards, and book the next one. Not offered on the last evening (UX-02). */
export function AfterCruiseCard() {
  const sailed = useSailed()
  if (!sailed) return null
  return (
    <Card hero labelledBy="home-after-h">
      <h2 id="home-after-h" className="card__title">{t('home.after')}</h2>
      <p>{t('home.afterBody')}</p>
      <ul className="link-list">
        <li><Link to="/me/feedback">{t('route.feedback')}</Link></li>
        <li><Link to="/me/bill/final">{t('route.finalBill')}</Link></li>
        <li><Link to="/me/cases">{t('route.cases')}</Link></li>
        <li><Link to="/me/loyalty">{t('route.loyalty')}</Link></li>
        <li><Link to="/me/rebook">{t('route.rebook')}</Link></li>
        <li><Link to="/me/recap">{t('route.recap')}</Link></li>
        <li><Link to="/me/history">{t('route.history')}</Link></li>
      </ul>
    </Card>
  )
}
