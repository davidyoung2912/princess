import { Link } from 'react-router'
import { t } from '../../i18n'
import { browseSailings, monthLabel, shipSailingSummary } from '../../domain/catalogueBrowse'
import { catalogueShips } from '../../domain/shipCatalogue'
import { useShip } from '../../hooks/useShipCatalogue'
import { useCatalogue } from '../../hooks/useCatalogue'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { regionName } from './catalogueNames'

const number = new Intl.NumberFormat('en-US')

/** Every ship of the catalogue as a card, with its size, how many sailings it has, and a way to compare (H47). */
export function ShipsScreen() {
  useCatalogue()
  const current = useShip()
  const ships = catalogueShips().length > 0 ? catalogueShips() : current.id ? [current] : []
  const sailings = browseSailings()
  return (
    <div className="page">
      <p>{t('cat.ships.intro')}</p>
      <ul className="card-grid">
        {ships.map((s) => {
          const mine = shipSailingSummary(s.id, sailings)
          return (
            <li key={s.id}>
              <Card>
                <h2 className="card__title"><Link to={`/home/ships/${s.id}`}>{s.name}</Link></h2>
                <p className="muted">{s.className}{s.entered ? ` · ${s.entered}` : ''} · {t('discover.guestsCount', { n: number.format(s.guests) })}</p>
                <p>{s.intro}</p>
                <p>
                  <span className="tag">{t(s.depth === 'aboard' ? 'cat.depth.aboard' : 'cat.depth.browse')}</span>
                </p>
                <p className="muted">
                  {mine.count > 0
                    ? t('cat.ship.sailingCount', { count: mine.count }) + (mine.first ? ` · ${t('cat.ship.firstSails', { month: monthLabel(mine.first.slice(0, 7)) })}` : '') + (mine.regions.length > 0 ? ` · ${mine.regions.map(regionName).join(', ')}` : '')
                    : t('cat.ship.noSailings')}
                </p>
                <LinkButton to={`/home/sailings?ship=${s.id}`} variant="secondary">{t('cat.ship.seeSailings', { ship: s.name })}</LinkButton>
              </Card>
            </li>
          )
        })}
      </ul>
      {ships.length > 1 && <LinkButton to={`/home/ships/compare?a=${ships[0].id}&b=${ships[1].id}`} block>{t('cat.ships.compare')}</LinkButton>}
    </div>
  )
}
