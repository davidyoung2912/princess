import { asMusterView } from '../../../shared/api/guards'
import { api } from '../../../app/runtime'
import { usePersona } from '../../../shared/hooks/useDemo'
import { useSavedCopy } from '../../../shared/hooks/useSavedCopy'
import { t, th } from '../../../shared/i18n'
import { Banner } from '../../../shared/ui/Banner'
import { LinkButton } from '../../../shared/ui/Button'
import { TabScreens } from '../../../shared/ui/TabScreens'
import { Card } from '../../../shared/ui/Card'
import { Siren } from '../../../shared/ui/icons'
import { Saved } from './common'
import { StanleyChanges } from '../../stanley/ui/StanleyChanges'
import { useShipTime } from './shipTime'
import { useOnboardToday } from '../../../shared/hooks/useOnboardToday'

/** The Ship tab (UX-01): the emergency card and the muster drill first, then the places and tools on board. */
export function ShipScreen() {
  const me = usePersona()
  const today = useOnboardToday()
  const muster = useSavedCopy('muster', me?.booker ?? 'none', () => api.onboard.muster(), asMusterView, [me?.id])
  const shipTime = useShipTime()
  const aboard = today.data?.aboard ?? false
  return (
    <div className="page">
      <p>{t('ship.intro')}</p>
      <StanleyChanges screen="ship" />

      <Card hero labelledBy="safe-h" tour="ship-safety">
        <h2 id="safe-h" className="card__title"><Siren aria-hidden="true" /> {th('ship.safety')}</h2>
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

      <TabScreens tabKey="ship" />
    </div>
  )
}
