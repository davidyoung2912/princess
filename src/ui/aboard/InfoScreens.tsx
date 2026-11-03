import { useState } from 'react'
import { formatTemp } from '../../domain/readiness'
import { useSettings } from '../../hooks/useSettings'
import { Link } from 'react-router'
import { PORTS } from '../../domain/sailings'
import type { Recent } from '../../domain/recentSearches'
import { clearRecent, loadRecent, rememberSearch } from '../../settings/recentSearches'
import { MIN_QUERY, searchContent } from '../../domain/searchIndex'
import { captainAnnouncement } from '../../domain/shipInfo'
import { distanceParts } from '../../domain/navigation'
import type { ShipPosition } from '../../domain/navigation'
import type { Units } from '../../domain/readiness'
import { positionFeed } from '../../feeds/navigation'
import { useFeed } from '../../hooks/useServedFeeds'
import { FeedWaiting } from '../FeedWaiting'
import { coordinates, positionLine } from '../onboard/navigationText'
import { isFromEarlier, screenHits, visibleAt } from '../../routes/screenWords'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useOnboardToday } from '../../hooks/useOnboardToday'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { Field } from '../Field'
import { Saved } from '../onboard/common'
import { Back } from './common'

/** Ship news (OB-06): the captain's announcement, today's weather and the ship at a glance, with links to the fuller navigation screens. */
export function ShipInfoScreen() {
  const [settings] = useSettings()
  const today = useOnboardToday()
  const sailing = useSailing()
  const p = useFeed(positionFeed, sailing.departure, Math.floor(useNow() / 60_000) * 60_000)
  return (
    <div className="page">
      <Saved copy={today}>
        {(v) => {
          if (!v.aboard || v.day === null) return <Banner kind="info" title={t('info.notYet')}><p>{t('info.notYetBody')}</p></Banner>
          return (
            <>
              <Card hero labelledBy="capt-h">
                <h2 id="capt-h" className="card__title">{th('info.captain')}</h2>
                <blockquote>{captainAnnouncement(v.day)}</blockquote>
                <p className="muted">{t('info.captainNote')}</p>
              </Card>
              {v.weather && (
                <Card labelledBy="wx-h">
                  <h2 id="wx-h" className="card__title">{th('info.weather')}</h2>
                  <p>{t('onb.weather', { summary: v.weather.summary, high: formatTemp(v.weather.highF, settings.units), low: formatTemp(v.weather.lowF, settings.units) })} {v.weather.sea}</p>
                </Card>
              )}
              <Card labelledBy="glance-h">
                <h2 id="glance-h" className="card__title">{th('info.glance')}</h2>
                {p ? <GlanceBody p={p} units={settings.units} /> : <FeedWaiting />}
                <p><Link to="/ship/where">{t('route.where')}</Link> · <Link to="/ship/sea">{t('route.sea')}</Link> · <Link to="/ship/along">{t('route.along')}</Link></p>
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

/** The short form of the ship's position: the one-line status, where it is bound and the ship's clock. */
function GlanceBody({ p, units }: { p: ShipPosition; units: Units }) {
  const remaining = distanceParts(p.nmRemaining, units)
  return (
    <>
      <p>{positionLine(p, units)}</p>
      <dl className="facts">
        <div><dt>{t('nav.pos')}</dt><dd>{coordinates(p.lat, p.lon)}</dd></div>
        {p.nextPort && <div><dt>{t('nav.remaining', { port: PORTS[p.nextPort].name })}</dt><dd>{t('nav.distance', { nm: remaining.nm, other: remaining.other })}</dd></div>}
        <div><dt>{t('nav.time.ship', { zone: t(`nav.zone.${p.clock.shipZone}` as StringKey) })}</dt><dd>{p.clock.shipTime}</dd></div>
      </dl>
    </>
  )
}


/** Search across all content (OB-07): venues, dishes, shows, services, tours, ports and screens. */
export function SearchScreen() {
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<Recent[]>(loadRecent)
  const remember = (item: Recent) => setRecent(rememberSearch(recent, item))
  const forget = () => { clearRecent(); setRecent([]) }
  const { stage } = useJourneyPosition()
  const now = searchContent(query, screenHits(t, stage), (to) => visibleAt(stage, to))
  // Screens of an earlier stage come after, labelled, and open from the result.
  const earlier = searchContent(query, screenHits(t, stage, true), (to) => isFromEarlier(stage, to)).filter((h) => !now.some((n) => n.to === h.to))
  const hits = [...now, ...earlier]
  const enough = query.trim().length >= MIN_QUERY
  return (
    <div className="page">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <Field label={t('search.label')} hint={t('search.hint')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search" />
      </form>
      <p role="status" className="muted">{enough ? t('search.count', { count: hits.length }) : ''}</p>
      {enough && hits.length === 0 && <Banner kind="info" title={t('search.none')}><p>{t('search.noneBody')} <Link to="/me/help">{t('route.helpCentre')}</Link></p></Banner>}
      {!enough && recent.length > 0 && (
        <section aria-labelledby="recent-h">
          <h2 id="recent-h">{th('search.recent')}</h2>
          <ul className="link-list">{recent.map((r) => <li key={r.to}><Link to={r.to}>{r.title}</Link></li>)}</ul>
          <p><button type="button" className="link-button" onClick={forget}>{t('search.clearRecent')}</button></p>
        </section>
      )}
      <ul className="link-list">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}`}>
            <Link to={h.to} state={isFromEarlier(stage, h.to) ? { earlier: true } : undefined} onClick={() => remember({ to: h.to, title: h.title })}>{h.title}</Link> <span className="muted">· {isFromEarlier(stage, h.to) ? t('search.fromTrip') : t(`search.kind.${h.kind}` as StringKey)}</span>
            {h.detail && <small className="muted"> {h.detail}</small>}
          </li>
        ))}
      </ul>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}
