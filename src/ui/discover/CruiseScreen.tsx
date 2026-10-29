import { Link } from 'react-router'
import { t } from '../../i18n'
import { CRUISE } from '../../domain/cruise'
import { PORT_GUIDES } from '../../domain/ports'
import { REFERENCE_SAILING } from '../../domain/sailings'
import { SHIP } from '../../domain/ship'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { ItineraryList, RouteMap } from './parts'

/** Itinerary detail (DIS-05) and the seasonality note (DIS-02) for the one cruise. */
export function CruiseScreen() {
  return (
    <div className="page">
      <h1>{CRUISE.name}</h1>
      <p>{CRUISE.intro}</p>
      <dl className="facts">
        <div><dt>{t('discover.fact.ship')}</dt><dd><Link to="/home/ship">{SHIP.name}</Link></dd></div>
        <div><dt>{t('discover.fact.nights')}</dt><dd>{CRUISE.nights}</dd></div>
        <div><dt>{t('discover.fact.from')}</dt><dd>{CRUISE.homePort}</dd></div>
      </dl>

      <section aria-labelledby="route-h">
        <h2 id="route-h">{t('discover.route')}</h2>
        <RouteMap />
      </section>

      <section aria-labelledby="days-h">
        <h2 id="days-h">{t('discover.dayByDay')}</h2>
        <p className="muted">{t('discover.timesNote')}</p>
        <ItineraryList sailing={REFERENCE_SAILING} />
      </section>

      <section aria-labelledby="when-h">
        <h2 id="when-h">{t('discover.whenToGo')}</h2>
        <Card info><p>{CRUISE.bestTime}</p></Card>
        <ul className="plain-list">
          {Object.values(PORT_GUIDES).filter((g) => g.id !== 'fll').map((g) => (
            <li key={g.id}><Link to={`/home/ports/${g.id}`}>{g.short}</Link> <span className="muted">{g.bestTime}</span></li>
          ))}
        </ul>
      </section>

      <LinkButton to="/home/sailings" block>{t('discover.seeDates')}</LinkButton>
    </div>
  )
}
