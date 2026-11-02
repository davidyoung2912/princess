import { asMusterView } from '../../api/guards'
import { api } from '../../runtime'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { HubList } from '../HubList'
import { Card } from '../Card'
import { Siren } from '../icons'
import { Saved } from './common'
import { useShipTime } from './shipTime'
import { useOnboardToday } from '../../hooks/useOnboardToday'

/** The Ship tab (UX-01): the emergency card and the muster drill first, then the places and tools on board. */
export function ShipScreen() {
  const me = usePersona()
  const today = useOnboardToday()
  const muster = useSavedCopy('muster', me?.booker ?? 'none', () => api.onboard.muster(), asMusterView, [me?.id])
  const shipTime = useShipTime()
  const aboard = today.data?.aboard ?? false
  return (
    <div className="page">
      <h1>{t('route.ship')}</h1>
      <p>{t('ship.intro')}</p>

      <Card hero labelledBy="safe-h">
        <h2 id="safe-h" className="card__title"><Siren aria-hidden="true" /> {t('ship.safety')}</h2>
        <div className="button-row">
          <LinkButton to="/ship/emergency">{t('route.emergency')}</LinkButton>
          <LinkButton to="/ship/muster" variant="secondary">{t('route.muster')}</LinkButton>
          <LinkButton to="/ship/help-now" variant="danger">{t('route.helpNow')}</LinkButton>
          <LinkButton to="/ship/report" variant="secondary">{t('route.report')}</LinkButton>
        </div>
        {aboard && (
          <Saved copy={muster}>
            {(m) => m.done ? <p>{t('ship.musterDone')}</p> : <Banner kind="warning" title={t('ship.musterTodo', { station: m.station })}><p>{t('ship.musterAt', { time: shipTime(m.at), place: m.stationName })}</p></Banner>}
          </Saved>
        )}
      </Card>

      <HubList tab="ship" />
    </div>
  )
}
