import { Link, useSearchParams } from 'react-router'
import { useEffect } from 'react'
import { t, th, headingCase } from '../../i18n'
import { PORT_GUIDES, portGuideById } from '../../domain/ports'
import { hasSailingDays, itinerary, portById, type Sailing } from '../../domain/sailings'
import { browseSailingById, portsOf, portName, seaDaysOf, rangeOf } from '../../domain/catalogueBrowse'
import { cruiseOf, loadItinerary, shipOf } from '../../domain/shipCatalogue'
import { useSailing } from '../../hooks/useDemo'
import { useCatalogue } from '../../hooks/useCatalogue'
import { itineraryRegrets } from '../../domain/regret'
import { Card } from '../Card'
import { RegretCards } from './RegretCards'
import { LinkButton } from '../Button'
import { ItineraryList, RouteMap } from './parts'
import { regionName } from './catalogueNames'

/**
 * The itinerary page for a sailing (H06): its route, day by day, regrets and when to go. It is reached from a sailing (`?sailing=<id>`); with none it shows the
 * sailing the app is on. The older Western Caribbean route keeps its authored best-time notes; every other route reads from the served patterns and days.
 */
export function CruiseScreen() {
  useCatalogue()
  const [params] = useSearchParams()
  const focused = useSailing()
  const entry = browseSailingById(params.get('sailing') ?? focused.id) ?? browseSailingById(focused.id)
  const sailing: Sailing = entry ? { id: entry.id, departure: entry.departure, holiday: entry.holiday } : focused
  useEffect(() => { void loadItinerary(sailing.id) }, [sailing.id])
  const cruise = cruiseOf(sailing.id)
  const ship = shipOf(sailing.id)
  const ready = hasSailingDays(sailing.id) || !entry || entry.legs.length === 0 || (entry.legs.length === 1 && entry.legs[0].pattern === 'carib-west-a')
  const days = ready ? itinerary(sailing) : []
  const ports = entry ? portsOf(entry, days) : []
  const sea = entry ? seaDaysOf(entry, days) : null
  const olderRoute = !entry || entry.legs.length === 0 || (entry.legs.length === 1 && entry.legs[0].pattern === 'carib-west-a')
  return (
    <div className="page">
      <h2>{headingCase(cruise.name)}</h2>
      {cruise.intro && <p>{cruise.intro}</p>}
      <dl className="facts">
        <div><dt>{t('discover.fact.ship')}</dt><dd><Link to={`/home/ships/${ship.id}`}>{ship.name}</Link></dd></div>
        <div><dt>{t('discover.fact.nights')}</dt><dd>{cruise.nights}</dd></div>
        <div><dt>{t('discover.fact.from')}</dt><dd>{cruise.homePort}</dd></div>
        {entry && <div><dt>{t('cat.dates')}</dt><dd>{rangeOf(entry)}</dd></div>}
        {entry?.region && <div><dt>{t('cat.region')}</dt><dd>{regionName(entry.region)}</dd></div>}
        {sea !== null && <div><dt>{t('cat.seaDaysLabel')}</dt><dd>{sea}</dd></div>}
      </dl>
      {entry?.dataStatus === 'sample' && <Card info><p>{t('cat.sample')}</p></Card>}

      {!ready ? <p role="status" className="muted">{t('cat.daysLoading')}</p> : (
        <>
          <section aria-labelledby="route-h">
            <h2 id="route-h">{th('discover.route')}</h2>
            <RouteMap days={days} />
          </section>

          <section aria-labelledby="days-h">
            <h2 id="days-h">{th('discover.dayByDay')}</h2>
            <p className="muted">{t('discover.timesNote')}</p>
            <ItineraryList sailing={sailing} dated={!!entry} />
          </section>

          <RegretCards cards={itineraryRegrets(sailing)} heading={t('regret.route')} headingId="regret-route" />
          <p className="muted">{t('regret.note')}</p>
        </>
      )}

      <section aria-labelledby="when-h">
        <h2 id="when-h">{th('discover.whenToGo')}</h2>
        {cruise.bestTime && <Card info><p>{cruise.bestTime}</p></Card>}
        <ul className="plain-list">
          {(olderRoute ? Object.values(PORT_GUIDES).filter((g) => g.id !== 'fll').map((g) => ({ id: g.id, name: g.short, note: g.bestTime })) : ports.filter((p) => p !== (days[0]?.port)).map((id) => ({ id, name: portName(id), note: portById(id)?.country ?? '' }))).map((p) => (
            <li key={p.id}>{portGuideById(p.id) ? <Link to={`/home/ports/${p.id}`}>{p.name}</Link> : p.name} <span className="muted">{p.note}</span></li>
          ))}
        </ul>
      </section>

      <LinkButton to={entry ? `/home/sailings/${entry.id}` : '/home/sailings'} block>{entry ? t('cat.seeThisSailing') : t('discover.seeDates')}</LinkButton>
      <p><Link to="/home/sailings">{t('discover.allDates')}</Link> · <Link to="/home/explore">{t('cat.exploreLink')}</Link></p>
    </div>
  )
}
