import { useId, useState } from 'react'
import { Link } from 'react-router'
import { t } from '../../i18n'
import { filterPorts, groupByCountry } from '../../domain/portGuide'
import { usePortList } from '../../hooks/useServedFeeds'
import { FeedWaiting } from '../FeedWaiting'
import { Flag } from '../Flag'

/** Every port with a guide (H52), one section per country: search by port, country or area and open a port for its Port Details page, or the country for its page. */
export function PortsScreen() {
  const ports = usePortList()
  const [query, setQuery] = useState('')
  const id = useId()
  if (!ports) return <div className="page"><FeedWaiting /></div>
  const shown = filterPorts(ports, query)
  const groups = groupByCountry(shown)
  return (
    <div className="page">
      <div className="field">
        <label htmlFor={id}>{t('portguide.list.search')}</label>
        <input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      <p><Link to="/home/countries">{t('country.list.all')}</Link></p>
      <p className="muted" role="status">{t('portguide.list.count', { count: shown.length })}</p>
      {shown.length === 0 && <p>{t('portguide.list.none')}</p>}
      {groups.map((g) => (
        <section key={g.countryId} aria-labelledby={`pl-${g.countryId || 'other'}`}>
          <h2 id={`pl-${g.countryId || 'other'}`}>
            {g.countryId ? <><Flag code={g.countryId} large /><Link to={`/home/countries/${g.countryId}`}>{g.countryName}</Link></> : t('portguide.list.other')}
          </h2>
          <ul className="card-grid">
            {g.ports.map((p) => (
              <li key={p.id} className="card">
                <h3 className="card__title"><Link to={`/home/ports/${p.id}`}>{p.name}</Link></h3>
                {p.area && <p className="muted">{p.area}</p>}
                {p.shortDescription && <p>{p.shortDescription}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
