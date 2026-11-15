import { useId, useState } from 'react'
import { Link } from 'react-router'
import { t } from '../../i18n'
import { filterCountries } from '../../domain/countryGuide'
import { useCountryList } from '../../hooks/useServedFeeds'
import { FeedWaiting } from '../FeedWaiting'
import { Flag } from '../Flag'

/** Every country and territory with a profile (H54): search by name or region and open one for its Country Details page. */
export function CountriesScreen() {
  const list = useCountryList()
  const [query, setQuery] = useState('')
  const id = useId()
  if (!list) return <div className="page"><FeedWaiting /></div>
  const shown = filterCountries(list, query)
  return (
    <div className="page">
      <div className="field">
        <label htmlFor={id}>{t('country.list.search')}</label>
        <input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      <p className="muted" role="status">{t('country.list.count', { count: shown.length })}</p>
      {shown.length === 0 ? <p>{t('country.list.none')}</p> : (
        <ul className="card-grid">
          {shown.map((c) => (
            <li key={c.id} className="card">
              <h2 className="card__title"><Flag code={c.id} /><Link to={`/home/countries/${c.id}`}>{c.name}</Link></h2>
              <p className="muted">{c.region}</p>
              {c.status && <p><span className="tag tag--alert">{c.status.split(' — ')[0]}</span></p>}
              {c.cruiseCalls && <p>{t('country.list.calls', { calls: c.cruiseCalls })}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
