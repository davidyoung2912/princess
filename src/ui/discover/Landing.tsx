import { Link } from 'react-router'
import { t, th } from '../../i18n'
import { portGuideById } from '../../domain/ports'
import { portById } from '../../domain/sailings'
import { useCruise, useItinerary, useShip } from '../../hooks/useShipCatalogue'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { FromPriceBlock, PriceState } from './parts'

/** The cruise, its price, where it goes and the ship (DIS-01): what a guest browses from Home, with no account needed. */
export function Explore() {
  const cruise = useCruise()
  const ship = useShip()
  const days = useItinerary()
  const calls = [...new Set(days.map((d) => d.port))].filter((p) => p !== 'sea' && p !== days[0]?.port)
  const offers = useAsync(() => api.discover.offers(), [])
  const lowest = offers.data ? offers.data.map((o) => o.from).reduce((a, b) => (b.fare < a.fare ? b : a)) : null
  return (
    <>
      <Card hero labelledBy="cruise-h">
        <p className="eyebrow">{t('discover.eyebrow', { ship: ship.name })}</p>
        <h2 id="cruise-h">{cruise.name}</h2>
        <p>{cruise.intro}</p>
        <PriceState state={offers}>{lowest && <FromPriceBlock price={lowest} />}</PriceState>
        <div className="button-row">
          <LinkButton to="/book">{t('discover.book')}</LinkButton>
          <LinkButton to="/home/sailings" variant="secondary">{t('discover.seeDates')}</LinkButton>
          <LinkButton to="/home/cruise" variant="secondary">{t('discover.seePlan')}</LinkButton>
        </div>
      </Card>

      <section aria-labelledby="ports-h">
        <h2 id="ports-h">{th('discover.whereYouGo')}</h2>
        <ul className="card-grid">
          {calls.map((id) => { const g = portGuideById(id); return (
            <li key={id} className="card">
              <h3>{g ? <Link to={`/home/ports/${id}`}>{g.short}</Link> : portById(id)?.name ?? id}</h3>
              {g && <p>{g.blurb}</p>}
            </li>
          ) })}
        </ul>
      </section>

      <section aria-labelledby="ship-h">
        <h2 id="ship-h">{th('discover.yourShip')}</h2>
        <Card>
          <h3><Link to="/home/ship">{ship.name}</Link></h3>
          <p>{ship.intro}</p>
        </Card>
      </section>

      <p><Link to="/home/saved">{t('discover.savedLink')}</Link></p>
    </>
  )
}
