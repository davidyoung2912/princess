import { useId, useState } from 'react'
import { Link } from 'react-router'
import { t } from '../../i18n'
import { filterPorts } from '../../domain/portGuide'
import { usePortList } from '../../hooks/useServedFeeds'
import { FeedWaiting } from '../FeedWaiting'

/** Every port with a guide (H52): search by name or country and open one for its Port Details page. */
export function PortsScreen() {
  const ports = usePortList()
  const [query, setQuery] = useState('')
  const id = useId()
  if (!ports) return <div className="page"><FeedWaiting /></div>
  const shown = filterPorts(ports, query)
  return (
    <div className="page">
      <div className="field">
        <label htmlFor={id}>{t('portguide.list.search')}</label>
        <input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      <p className="muted" role="status">{t('portguide.list.count', { count: shown.length })}</p>
      {shown.length === 0 ? <p>{t('portguide.list.none')}</p> : (
        <ul className="card-grid">
          {shown.map((p) => (
            <li key={p.id} className="card">
              <h2 className="card__title"><Link to={`/home/ports/${p.id}`}>{p.name}</Link></h2>
              {p.area && <p className="muted">{p.area}</p>}
              {p.shortDescription && <p>{p.shortDescription}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
