import { Link } from 'react-router'
import { t } from '../../i18n'
import { CRUISE } from '../../domain/cruise'
import { lowestFromPrice } from '../../domain/pricing'
import { PORT_GUIDES } from '../../domain/ports'
import { SHIP } from '../../domain/ship'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { Card } from '../Card'
import { ConceptNotice } from '../ConceptNotice'
import { LinkButton } from '../Button'
import { FromPriceBlock, PriceState } from './parts'

/** Home before booking (DIS-01): what the cruise is, what it costs, where it goes, with no account needed. */
export function Landing() {
  const offers = useAsync(() => api.discover.offers(), [])
  const lowest = offers.data ? offers.data.map((o) => o.from).reduce((a, b) => (b.fare < a.fare ? b : a)) : lowestFromPrice()
  return (
    <div className="page">
      <Card hero labelledBy="cruise-h">
        <p className="eyebrow">{t('discover.eyebrow', { ship: SHIP.name })}</p>
        <h1 id="cruise-h">{CRUISE.name}</h1>
        <p>{CRUISE.intro}</p>
        <PriceState state={offers}><FromPriceBlock price={lowest} /></PriceState>
        <div className="button-row">
          <LinkButton to="/book">{t('discover.book')}</LinkButton>
          <LinkButton to="/home/sailings" variant="secondary">{t('discover.seeDates')}</LinkButton>
          <LinkButton to="/home/cruise" variant="secondary">{t('discover.seePlan')}</LinkButton>
        </div>
      </Card>

      <section aria-labelledby="ports-h">
        <h2 id="ports-h">{t('discover.whereYouGo')}</h2>
        <ul className="card-grid">
          {Object.values(PORT_GUIDES).filter((g) => g.id !== 'fll').map((g) => (
            <li key={g.id} className="card">
              <h3><Link to={`/home/ports/${g.id}`}>{g.short}</Link></h3>
              <p>{g.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ship-h">
        <h2 id="ship-h">{t('discover.yourShip')}</h2>
        <Card>
          <h3><Link to="/home/ship">{SHIP.name}</Link></h3>
          <p>{SHIP.intro}</p>
        </Card>
      </section>

      <p><Link to="/home/saved">{t('discover.savedLink')}</Link></p>
      <ConceptNotice />
    </div>
  )
}
