import { Link } from 'react-router'
import { t } from '../../i18n'
import { browseSailings, monthLabel, monthsOf, regionMonthGrid } from '../../domain/catalogueBrowse'
import { catalogueRegions } from '../../domain/shipCatalogue'
import { useCatalogue } from '../../hooks/useCatalogue'
import { Card } from '../Card'
import { regionName } from './catalogueNames'

/** Explore by region and month (H50): how many sailings leave in each month for each region, every count a link to those sailings. */
export function ExploreScreen() {
  useCatalogue()
  const sailings = browseSailings()
  const months = monthsOf(sailings)
  const grid = regionMonthGrid(sailings, catalogueRegions().map((r) => r.id))
  return (
    <div className="page">
      <p>{t('cat.explore.intro')}</p>
      {grid.length === 0 ? <Card info><p>{t('cat.explore.empty')}</p></Card> : (
        <div className="table-scroll">
          <table className="compare-table">
            <caption>{t('cat.explore.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('cat.region')}</th>
                {months.map((m) => <th key={m} scope="col">{monthLabel(m)}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((r) => (
                <tr key={r.region}>
                  <th scope="row"><Link to={`/home/sailings?region=${r.region}`}>{regionName(r.region)}<span className="visually-hidden">, {t('cat.explore.total', { count: r.total })}</span></Link></th>
                  {months.map((m) => (
                    <td key={m}>
                      {r.months[m]
                        ? <Link to={`/home/sailings?region=${r.region}&month=${m}`}>{r.months[m]}<span className="visually-hidden"> {t('cat.explore.sailingsIn', { region: regionName(r.region), month: monthLabel(m), count: r.months[m] })}</span></Link>
                        : <span aria-label={t('cat.explore.none')}>–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p><Link to="/home/sailings">{t('discover.allDates')}</Link> · <Link to="/home/ships">{t('cat.shipsLink')}</Link> · <Link to="/home/quiz">{t('route.quiz')}</Link></p>
    </div>
  )
}
