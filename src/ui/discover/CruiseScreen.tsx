import { Link } from 'react-router'
import { t, th, headingCase } from '../../i18n'
import { PORT_GUIDES } from '../../domain/ports'
import { REFERENCE_SAILING } from '../../domain/sailings'
import { useCruise, useShip } from '../../hooks/useShipCatalogue'
import { itineraryRegrets } from '../../domain/regret'
import { Card } from '../Card'
import { RegretCards } from './RegretCards'
import { LinkButton } from '../Button'
import { ItineraryList, RouteMap } from './parts'

/** Itinerary detail (DIS-05) and the seasonality note (DIS-02) for the one cruise. */
export function CruiseScreen() {
  const cruise = useCruise()
  const ship = useShip()
  return (
    <div className="page">
      <h2>{headingCase(cruise.name)}</h2>
      <p>{cruise.intro}</p>
      <dl className="facts">
        <div><dt>{t('discover.fact.ship')}</dt><dd><Link to="/home/ship">{ship.name}</Link></dd></div>
        <div><dt>{t('discover.fact.nights')}</dt><dd>{cruise.nights}</dd></div>
        <div><dt>{t('discover.fact.from')}</dt><dd>{cruise.homePort}</dd></div>
      </dl>

      <section aria-labelledby="route-h">
        <h2 id="route-h">{th('discover.route')}</h2>
        <RouteMap />
      </section>

      <section aria-labelledby="days-h">
        <h2 id="days-h">{th('discover.dayByDay')}</h2>
        <p className="muted">{t('discover.timesNote')}</p>
        <ItineraryList sailing={REFERENCE_SAILING} />
      </section>

      <RegretCards cards={itineraryRegrets(REFERENCE_SAILING)} heading={t('regret.route')} headingId="regret-route" />
      <p className="muted">{t('regret.note')}</p>

      <section aria-labelledby="when-h">
        <h2 id="when-h">{th('discover.whenToGo')}</h2>
        {cruise.bestTime && <Card info><p>{cruise.bestTime}</p></Card>}
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
