import { Link } from 'react-router'
import { asMusterView } from '../../api/guards'
import { api } from '../../runtime'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
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

      <nav aria-labelledby="ship-links-h">
        <h2 id="ship-links-h">{t('ship.places')}</h2>
        <ul className="link-list">
          <li><Link to="/ship/search">{t('route.search')}</Link></li>
          <li><Link to="/ship/info">{t('route.shipInfo')}</Link></li>
          <li><Link to="/ship/map">{t('route.deckMap')}</Link></li>
          <li><Link to="/ship/venues">{t('route.venues')}</Link></li>
          <li><Link to="/ship/port">{t('route.portDay')}</Link></li>
          <li><Link to="/plan/reservations">{t('route.reservations')}</Link></li>
          <li><Link to="/ship/order">{t('route.order')}</Link></li>
          <li><Link to="/ship/family">{t('route.family')}</Link></li>
          <li><Link to="/ship/health">{t('route.health')}</Link></li>
          <li><Link to="/ship/room">{t('route.room')}</Link></li>
          <li><Link to="/ship/photos">{t('route.photos')}</Link></li>
          <li><Link to="/ship/laundry">{t('route.laundry')}</Link></li>
          <li><Link to="/ship/wifi">{t('route.wifi')}</Link></li>
          <li><Link to="/ship/requests">{t('route.requests')}</Link></li>
          <li><Link to="/ship/drinks">{t('route.drinks')}</Link></li>
          <li><Link to="/ship/spa">{t('route.spa')}</Link></li>
          <li><Link to="/ship/shops">{t('route.shops')}</Link></li>
          <li><Link to="/ship/community">{t('route.community')}</Link></li>
          <li><Link to="/ship/access">{t('route.access')}</Link></li>
          <li><Link to="/ship/games">{t('route.games')}</Link></li>
          <li><Link to="/ship/tv">{t('route.tv')}</Link></li>
          <li><Link to="/home/disembark">{t('route.disembark')}</Link></li>
          <li><Link to="/me/cases">{t('route.cases')}</Link></li>
        </ul>
      </nav>
    </div>
  )
}
