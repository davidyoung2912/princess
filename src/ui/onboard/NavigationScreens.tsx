import { Link } from 'react-router'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { BackLink } from './common'
import { depthGauge, depthText, differenceHours, distanceParts, speedParts, waterTempText, waveText } from '../../domain/navigation'
import type { Landmark, ShipClock, ShipPosition } from '../../domain/navigation'
import { alongFeed, positionFeed, seaFeed } from '../../feeds/navigation'
import { skyNightFeed } from '../../feeds/skyNight'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { useFeed } from '../../hooks/useServedFeeds'
import { t, th, type StringKey } from '../../i18n'
import { compassWord, coordinates, portName, positionLine } from './navigationText'

const MINUTE = 60_000

/** The whole minute the screens ask the server about, so one answer covers a minute. */
function useMinute(): number {
  return Math.floor(useNow() / MINUTE) * MINUTE
}

/** The ship's wall clock for a moment, "HH:MM", given the ship's offset from UTC then. */
function wallTime(at: number, offsetMinutes: number): string {
  const d = new Date(at + offsetMinutes * MINUTE)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** The compass rose with an arrow turned to the heading. The words beside it carry the same meaning, so the picture is hidden from a screen reader. */
function Compass({ degreesTrue }: { degreesTrue: number }) {
  return (
    <svg className="nav-compass" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">
      <circle className="nav-compass__ring" r="50" />
      {[0, 90, 180, 270].map((a) => <line key={a} className="nav-compass__tick" x1="0" y1="-50" x2="0" y2="-43" transform={`rotate(${a})`} />)}
      <text className="nav-compass__letter" x="0" y="-33">{t('nav.n')}</text>
      <text className="nav-compass__letter" x="0" y="33">{t('nav.s')}</text>
      <text className="nav-compass__letter" x="35" y="0">{t('nav.e')}</text>
      <text className="nav-compass__letter" x="-35" y="0">{t('nav.w')}</text>
      <polygon className="nav-compass__arrow" points="0,-26 7,8 0,3 -7,8" transform={`rotate(${degreesTrue})`} />
    </svg>
  )
}

/** Ship time beside the time at the nearest port, and the next change of the ship's clock. */
function TimeCard({ clock }: { clock: ShipClock }) {
  const diff = differenceHours(clock.differenceMinutes)
  const change = clock.nextChange
  return (
    <Card labelledBy="nav-time">
      <h2 id="nav-time" className="card__title">{th('nav.time.title')}</h2>
      <dl className="facts">
        <div><dt>{t('nav.time.ship', { zone: t(`nav.zone.${clock.shipZone}` as StringKey) })}</dt><dd>{clock.shipTime}</dd></div>
        <div><dt>{t('nav.time.local', { port: portName(clock.localPlace) })}</dt><dd>{clock.localTime}</dd></div>
      </dl>
      <p>{diff === 0 ? t('nav.time.same') : diff > 0 ? t('nav.time.ahead', { count: diff }) : t('nav.time.behind', { count: -diff })}</p>
      <p className="muted">
        {change
          ? t(change.hours > 0 ? 'nav.time.forward' : 'nav.time.back', { count: Math.abs(change.hours), day: change.day, time: wallTime(change.at, clock.shipOffsetMinutes) })
          : t('nav.time.none')}
      </p>
    </Card>
  )
}

/** Where are we (glance): position, speed, heading, how far since the last port and to the next, and the clocks. */
export function WhereScreen() {
  const [settings] = useSettings()
  const sailing = useSailing()
  const p = useFeed(positionFeed, sailing.departure, useMinute())
  return (
    <div className="page">
      <BackLink to="/ship" label={t('route.ship')} />
      <p>{t('nav.where.intro')}</p>
      {!p && <FeedWaiting />}
      {p && <WhereBody p={p} units={settings.units} />}
      <p><Link to="/ship/sea">{t('route.sea')}</Link> · <Link to="/ship/along">{t('route.along')}</Link></p>
    </div>
  )
}

function WhereBody({ p, units }: { p: ShipPosition; units: 'imperial' | 'metric' }) {
  const speed = speedParts(p.speedKnots, units)
  const sailed = distanceParts(p.nmSailed, units)
  const remaining = distanceParts(p.nmRemaining, units)
  const next = p.nextPort
  return (
    <>
      <Card hero labelledBy="nav-now">
        <h2 id="nav-now" className="nav-hero">{positionLine(p, units)}</h2>
        <Compass degreesTrue={p.headingDegrees} />
        <p className="muted">{t('nav.compass.aria', { compass: compassWord(p.compass), deg: p.headingDegrees })}</p>
        <dl className="facts">
          <div><dt>{t('nav.pos')}</dt><dd>{coordinates(p.lat, p.lon)}</dd></div>
          <div><dt>{t('nav.speed')}</dt><dd>{p.speedKnots === 0 ? t('nav.speed.zero') : t('nav.speed.value', { knots: speed.knots, other: speed.other })}</dd></div>
          <div><dt>{t('nav.heading')}</dt><dd>{t('nav.heading.value', { compass: compassWord(p.compass), deg: p.headingDegrees })}</dd></div>
        </dl>
      </Card>
      {next && (
        <Card labelledBy="nav-dist">
          <h2 id="nav-dist" className="card__title">{th('nav.remaining', { port: portName(next) })}</h2>
          <progress className="meter" max={100} value={p.legPercent} aria-label={t('nav.progress', { port: portName(next), percent: p.legPercent })} />
          <dl className="facts">
            {!p.inPort && <div><dt>{t('nav.sailed', { port: portName(p.lastPort) })}</dt><dd>{t('nav.distance', { nm: sailed.nm, other: sailed.other })}</dd></div>}
            <div><dt>{t('nav.remaining', { port: portName(next) })}</dt><dd>{t('nav.distance', { nm: remaining.nm, other: remaining.other })}</dd></div>
            {p.arrival && <div><dt>{t('nav.eta', { port: portName(next) })}</dt><dd>{t('nav.eta.value', { day: p.arrival.day, time: p.arrival.shipTime })}</dd></div>}
            <div><dt>{t('nav.voyage')}</dt><dd>{t('nav.voyage.value', { done: distanceParts(p.voyageNmSailed, units).nm, total: distanceParts(p.voyageNmTotal, units).nm })}</dd></div>
          </dl>
        </Card>
      )}
      <TimeCard clock={p.clock} />
    </>
  )
}

/** The sea beneath us (detail): the depth under the keel, the surface and the light of the day. */
export function SeaScreen() {
  const [settings] = useSettings()
  const sailing = useSailing()
  const day = useCurrentDay()
  const s = useFeed(seaFeed, sailing.departure, useMinute())
  const sky = useFeed(skyNightFeed, sailing.departure, day)
  const units = settings.units
  return (
    <div className="page">
      <BackLink to="/ship" label={t('route.ship')} />
      <p>{t('nav.sea.intro')}</p>
      {!s && <FeedWaiting />}
      {s && (
        <>
          <Card hero labelledBy="nav-depth">
            <h2 id="nav-depth" className="card__title">{th('nav.depth.title')}</h2>
            <p className="nav-big">{depthText(s.depthM, units)}</p>
            <progress className="meter nav-gauge" max={100} value={depthGauge(s.depthM)} aria-label={t('nav.depth.gauge', { depth: depthText(s.depthM, units) })} />
            <p>{t(`nav.depth.${s.depthClass}` as StringKey)}</p>
          </Card>
          <Card labelledBy="nav-surface">
            <h2 id="nav-surface" className="card__title">{th('nav.surface.title')}</h2>
            <dl className="facts">
              <div><dt>{t('nav.water')}</dt><dd>{waterTempText(s.waterTempC, units)}</dd></div>
              <div><dt>{t('nav.wind')}</dt><dd>{t('nav.wind.value', { force: s.beaufort, name: t(`nav.bf.${s.beaufort}` as StringKey), knots: s.windKnots, from: compassWord(s.windFrom) })}</dd></div>
              <div><dt>{t('nav.seastate')}</dt><dd>{t(`nav.ss.${s.seaState}` as StringKey)}</dd></div>
              <div><dt>{t('nav.wave')}</dt><dd>{waveText(s.waveM, units)}</dd></div>
              <div><dt>{t('nav.swell')}</dt><dd>{t('nav.swell.value', { height: waveText(s.swellM, units), seconds: s.swellPeriodSeconds, from: compassWord(s.swellFrom) })}</dd></div>
            </dl>
          </Card>
        </>
      )}
      {sky && (
        <Card labelledBy="nav-light">
          <h2 id="nav-light" className="card__title">{th('nav.light.title')}</h2>
          <dl className="facts">
            <div><dt>{t('nav.light.first')}</dt><dd>{sky.firstLight}</dd></div>
            <div><dt>{t('sky.sunrise')}</dt><dd>{sky.sunrise}</dd></div>
            <div><dt>{t('sky.sunset')}</dt><dd>{sky.sunset}</dd></div>
            <div><dt>{t('nav.light.last')}</dt><dd>{sky.lastLight}</dd></div>
            <div><dt>{t('nav.light.dark')}</dt><dd>{sky.darkAt}</dd></div>
            <div><dt>{t('sky.moon')}</dt><dd>{t('sky.moonLit', { phase: sky.moon.name, lit: sky.moon.lit })}</dd></div>
          </dl>
          <p className="muted">{t('nav.light.note')}</p>
          <p><Link to="/ship/sky">{t('nav.light.more')}</Link></p>
        </Card>
      )}
      <p><Link to="/ship/where">{t('route.where')}</Link> · <Link to="/ship/along">{t('route.along')}</Link></p>
    </div>
  )
}

function LandmarkList({ id, items }: { id: string; items: Landmark[] }) {
  return (
    <ul className="nav-landmarks" aria-labelledby={id}>
      {items.map((l) => (
        <li key={`${l.id}-${l.passesAt}`}>
          <h3>{l.name}</h3>
          <p className="muted">{t(`nav.kind.${l.kind}` as StringKey)} · {t('nav.landmark.when', { day: l.day, time: l.shipTime })}</p>
          <p>{l.blurb}</p>
          <p className="muted">{t('nav.landmark.where', { side: t(`nav.side.${l.side}` as StringKey), nm: l.closestNm })}</p>
          <p className="muted">{t('nav.landmark.away', { nm: l.distanceNm })}</p>
        </li>
      ))}
    </ul>
  )
}

/** Along the way: the sea zone and the wildlife to look for, and the places the ship is passing. */
export function AlongScreen() {
  const sailing = useSailing()
  const a = useFeed(alongFeed, sailing.departure, useMinute())
  return (
    <div className="page">
      <BackLink to="/ship" label={t('route.ship')} />
      <p>{t('nav.along.intro')}</p>
      {!a && <FeedWaiting />}
      {a && (
        <>
          <Card hero labelledBy="nav-zone">
            <h2 id="nav-zone" className="card__title">{a.zone.name}</h2>
            <p>{a.zone.habitat}</p>
            <h3>{th('nav.lookout')}</h3>
            <ul className="plain-list">{a.zone.wildlife.map((w) => <li key={w}>{t(`sight.${w}` as StringKey)}</li>)}</ul>
            <p><Link to="/ship/sightings">{t('route.sightings')}</Link></p>
          </Card>
          <section aria-labelledby="nav-passing">
            <h2 id="nav-passing">{th('nav.passing')}</h2>
            {a.passing.length === 0 ? <p className="muted">{t('nav.passing.none')}</p> : <LandmarkList id="nav-passing" items={a.passing} />}
          </section>
          <section aria-labelledby="nav-ahead">
            <h2 id="nav-ahead">{th('nav.ahead')}</h2>
            {a.ahead.length === 0 ? <p className="muted">{t('nav.ahead.none')}</p> : <LandmarkList id="nav-ahead" items={a.ahead} />}
          </section>
          {a.behind.length > 0 && (
            <section aria-labelledby="nav-behind">
              <h2 id="nav-behind">{th('nav.behind')}</h2>
              <LandmarkList id="nav-behind" items={a.behind} />
            </section>
          )}
        </>
      )}
      <p><Link to="/ship/where">{t('route.where')}</Link> · <Link to="/ship/sea">{t('route.sea')}</Link></p>
    </div>
  )
}
