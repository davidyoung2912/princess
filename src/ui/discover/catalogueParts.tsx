import { Link } from 'react-router'
import { t } from '../../i18n'
import { formatMoney } from '../../domain/money'
import { pricePerNight, rangeOf, type BrowseSailing } from '../../domain/catalogueBrowse'
import { regionName, shipName } from './catalogueNames'

/** Says plainly when a sailing's dates and ports are a sample from the catalogue and not yet confirmed. */
export function DataStatusNote({ sailing }: { sailing: BrowseSailing }) {
  if (sailing.dataStatus !== 'sample') return null
  return <p className="muted">{t('cat.sample')}</p>
}

/** "From $1,539 a person, about $220 a night" before taxes, or a plain "price not yet available". */
export function CataloguePrice({ sailing }: { sailing: BrowseSailing }) {
  if (sailing.fromCents === undefined) return <p className="muted">{t('cat.noPrice')}</p>
  const night = pricePerNight(sailing)
  return (
    <p>
      {t('discover.from')} <strong>{formatMoney(sailing.fromCents)}</strong> {t('discover.perPerson')}
      {night !== null && <span className="muted"> · {t('cat.perNight', { price: formatMoney(night) })}</span>}
      <span className="muted"> · {t('cat.beforeTaxes')}</span>
    </p>
  )
}

/** The facts of one sailing as a list: ship, region, dates, nights. */
export function SailingFactsList({ sailing }: { sailing: BrowseSailing }) {
  return (
    <dl className="facts">
      <div><dt>{t('discover.fact.ship')}</dt><dd><Link to={`/home/ships/${sailing.ship}`}>{shipName(sailing.ship)}</Link></dd></div>
      {sailing.region && <div><dt>{t('cat.region')}</dt><dd>{regionName(sailing.region)}</dd></div>}
      <div><dt>{t('cat.dates')}</dt><dd>{rangeOf(sailing)}</dd></div>
      <div><dt>{t('discover.fact.nights')}</dt><dd>{sailing.nights}</dd></div>
    </dl>
  )
}
