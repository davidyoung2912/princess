import { useState, type ReactNode } from 'react'
import { Anchor, CircleDot, Compass, Drama, MapPin, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { SCREEN_ICONS } from '../screenIcons'
import { formatTemp } from '../../domain/readiness'
import { useSettings } from '../../hooks/useSettings'
import { Link, useSearchParams } from 'react-router'
import { PORTS } from '../../domain/sailings'
import type { Recent } from '../../domain/recentSearches'
import { clearRecent, loadRecent, rememberSearch } from '../../settings/recentSearches'
import { answerCards } from '../../domain/answerCards'
import { PLANS } from '../../domain/wifi'
import { formatMoney } from '../../domain/money'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { localDate, tonightsDinner } from '../../domain/tileLive'
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

/** Ship news (OB-06): the captain's announcement, today's weather and the ship at a glance, with links to the fuller navigation screens. */
export function ShipInfoScreen() {
  const [settings] = useSettings()
  const today = useOnboardToday()
  const sailing = useSailing()
  const p = useFeed(positionFeed, sailing.id, Math.floor(useNow() / 60_000) * 60_000)
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
/** An icon for each kind of result, so a list of mixed results can be scanned at a glance. */
const HIT_ICONS: Partial<Record<string, LucideIcon>> = { venue: UtensilsCrossed, event: Drama, place: MapPin, service: ShoppingBag, tour: Compass, port: Anchor }

/** The first place `bold` appears in `text` made bold (the count at the start of the line), the rest as it was. */
function boldFirst(text: string, bold: string): ReactNode {
  const at = text.indexOf(bold)
  return at < 0 ? text : <>{text.slice(0, at)}<strong>{bold}</strong>{text.slice(at + bold.length)}</>
}

export function SearchScreen() {
  // A pill can open the search with the guest's words already in the box; they can change or clear them.
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => (params.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80))
  const [recent, setRecent] = useState<Recent[]>(loadRecent)
  const remember = (item: Recent) => setRecent(rememberSearch(recent, item))
  const forget = () => { clearRecent(); setRecent([]) }
  const { stage } = useJourneyPosition()
  const now = searchContent(query, screenHits(t, stage), (to) => visibleAt(stage, to))
  // Screens of an earlier stage come after, labelled, and open from the result.
  const earlier = searchContent(query, screenHits(t, stage, true), (to) => isFromEarlier(stage, to)).filter((h) => !now.some((n) => n.to === h.to))
  const hits = [...now, ...earlier]
  const enough = query.trim().length >= MIN_QUERY
  const wantDinner = enough && answerCards(query, { wifiFrom: null, dinnerTonight: null }).some((c) => c.id === 'dinner')
  const plan = useMine(() => (wantDinner ? api.plan.overview() : Promise.resolve(null)), [wantDinner])
  const nowMs = useNow()
  const today = localDate(nowMs)
  const asOf = new Date(nowMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const cards = answerCards(query, { wifiFrom: formatMoney(Math.min(...PLANS.map((p) => p.perDay))), dinnerTonight: plan.data ? tonightsDinner(plan.data.days, today) : null }, (to) => visibleAt(stage, to))
  return (
    <div className="page">
      {!enough && (
        <section className="search-guide" aria-labelledby="search-guide-h">
          <h2 id="search-guide-h">{th('search.guide.title')}</h2>
          <p>{t('search.guide.intro')}</p>
          <p>{t('search.guide.ideas')}</p>
          <ul>{(['places', 'services', 'health', 'timing'] as const).map((k) => <li key={k}>{t(`search.guide.${k}` as StringKey)}</li>)}</ul>
        </section>
      )}
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <Field label={t('search.label')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search" />
      </form>
      <p role="status" className="search-count">{enough ? boldFirst(t('search.found', { count: hits.length, query: query.trim() }), String(hits.length)) : ''}</p>
      {enough && hits.length === 0 && <Banner kind="info" title={t('search.none')}><p>{t('search.noneBody')} <Link to="/me/help">{t('route.helpCentre')}</Link></p></Banner>}
      {!enough && recent.length > 0 && (
        <section aria-labelledby="recent-h">
          <h2 id="recent-h">{th('search.recent')}</h2>
          <ul className="link-list">{recent.map((r) => <li key={r.to}><Link to={r.to}>{r.title}</Link></li>)}</ul>
          <p><button type="button" className="link-button" onClick={forget}>{t('search.clearRecent')}</button></p>
        </section>
      )}
      {cards.map((c) => (
        <Card key={c.id} labelledBy={`answer-${c.id}`}>
          <p id={`answer-${c.id}`}><strong>{c.id === 'wifi' ? (c.value ? t('search.answer.wifi', { value: c.value }) : t('search.answer.wifiNoPrice')) : c.id === 'dinner' ? (c.value ? t('search.answer.dinner', { value: c.value }) : t('search.answer.dinnerNone')) : t('search.answer.late')}</strong></p>
          <p className="muted">{t(`search.scope.${c.scope}` as StringKey)} · {t(`search.source.${c.source}` as StringKey, { time: asOf })}</p>
          <Link to={c.to} onClick={() => remember({ to: c.to, title: t(`search.answer.${c.id}Go` as StringKey) })}>{t(`search.answer.${c.id}Go` as StringKey)}</Link>
        </Card>
      ))}
      <ul className="link-list screen-list search-results">
        {hits.map((h) => {
          const Icon = h.kind === 'screen' ? (SCREEN_ICONS[h.id] ?? CircleDot) : HIT_ICONS[h.kind] ?? CircleDot
          const earlier = isFromEarlier(stage, h.to)
          return (
            <li key={`${h.kind}-${h.id}`}>
              <Link to={h.to} state={earlier ? { earlier: true } : undefined} onClick={() => remember({ to: h.to, title: h.title })}><Icon className="screen-list__icon" size={20} aria-hidden="true" />{h.title}</Link>
              <span className="screen-list__subtext"><strong>{earlier ? t('search.fromTrip') : t(`search.kind.${h.kind}` as StringKey)}</strong>{h.detail ? <> · {h.detail}</> : null}</span>
            </li>
          )
        })}
      </ul>
      {enough && hits.length > 0 && <p className="muted">{t('search.source.ship', { time: asOf })}</p>}
    </div>
  )
}
