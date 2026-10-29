import { useState } from 'react'
import { formatTemp } from '../../domain/readiness'
import { useSettings } from '../../hooks/useSettings'
import { Link } from 'react-router'
import { PORTS } from '../../domain/sailings'
import { MIN_QUERY, searchContent, type Hit } from '../../domain/searchIndex'
import { noonReport } from '../../domain/shipInfo'
import { ROUTES } from '../../routes/routes'
import { useSailing } from '../../hooks/useDemo'
import { useOnboardToday } from '../../hooks/useOnboardToday'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { Field } from '../Field'
import { Saved } from '../onboard/common'
import { Back } from './common'

/** Ship news (OB-06): the captain's announcement, where the ship is and how fast, the weather and the sea, as the noon report. */
export function ShipInfoScreen() {
  const [settings] = useSettings()
  const today = useOnboardToday()
  const sailing = useSailing()
  return (
    <div className="page">
      <h1>{t('route.shipInfo')}</h1>
      <Saved copy={today}>
        {(v) => {
          if (!v.aboard || v.day === null) return <Banner kind="info" title={t('info.notYet')}><p>{t('info.notYetBody')}</p></Banner>
          const r = noonReport(sailing, v.day)
          const target = r.at === 'sea' ? r.next : r.at
          const near = target && target !== 'sea' ? PORTS[target].name : ''
          return (
            <>
              <Card hero labelledBy="capt-h">
                <h2 id="capt-h" className="card__title">{t('info.captain')}</h2>
                <blockquote>{r.announcement}</blockquote>
                <p className="muted">{t('info.captainNote')}</p>
              </Card>
              <Card labelledBy="noon-h">
                <h2 id="noon-h" className="card__title">{t('info.noon', { day: r.day })}</h2>
                <dl className="facts">
                  <div><dt>{t('info.position')}</dt><dd>{r.at === 'sea' ? t('info.atSea', { miles: r.milesToNext, port: near }) : t('info.inPort', { port: near })}</dd></div>
                  <div><dt>{t('info.speed')}</dt><dd>{r.knots === 0 ? t('info.alongside') : t('info.knots', { knots: r.knots })}</dd></div>
                  <div><dt>{t('info.sky')}</dt><dd>{t(`info.sky.${r.sky}` as StringKey)}</dd></div>
                  <div><dt>{t('info.air')}</dt><dd>{formatTemp(r.airF, settings.units)}</dd></div>
                  <div><dt>{t('info.water')}</dt><dd>{formatTemp(r.waterF, settings.units)}</dd></div>
                  <div><dt>{t('info.sea')}</dt><dd>{t('info.seaBody', { wind: r.windKnots, wave: r.waveFt })}</dd></div>
                </dl>
                <p className="muted">{t('info.concept')}</p>
              </Card>
            </>
          )
        }}
      </Saved>
      <p><Link to="/ship/search">{t('route.search')}</Link></p>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}

const screenHits = (): Hit[] =>
  ROUTES.filter((r) => r.tab !== null && !r.path.includes(':') && r.path !== '/kit').map((r) => ({ kind: 'screen', id: r.path, title: t(r.titleKey), detail: '', to: r.path }))

/** Search across all content (OB-07): venues, dishes, shows, services, tours, ports and screens. */
export function SearchScreen() {
  const [query, setQuery] = useState('')
  const hits = searchContent(query, screenHits())
  const enough = query.trim().length >= MIN_QUERY
  return (
    <div className="page">
      <h1>{t('route.search')}</h1>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <Field label={t('search.label')} hint={t('search.hint')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search" />
      </form>
      <p role="status" className="muted">{enough ? t('search.count', { count: hits.length }) : ''}</p>
      {enough && hits.length === 0 && <Banner kind="info" title={t('search.none')}><p>{t('search.noneBody')} <Link to="/me/help">{t('route.helpCentre')}</Link></p></Banner>}
      <ul className="link-list">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}`}>
            <Link to={h.to}>{h.title}</Link> <span className="muted">· {t(`search.kind.${h.kind}` as StringKey)}</span>
            {h.detail && <small className="muted"> {h.detail}</small>}
          </li>
        ))}
      </ul>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}
