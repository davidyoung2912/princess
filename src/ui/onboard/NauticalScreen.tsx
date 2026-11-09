import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { Compass, LandmarkList, TimeCard } from './NavigationScreens'
import { depthGauge, depthText, distanceParts, speedParts, waterTempText, waveText } from '../../domain/navigation'
import type { AlongTheWay, SeaConditions, ShipPosition } from '../../domain/navigation'
import { degreesMinutes, headingText, knotsText, lengthText, tonnageText, turnText, utcTime, type Nautical } from '../../domain/nautical'
import type { Units } from '../../domain/readiness'
import type { SkyNight } from '../../domain/sky'
import { pressureText, tempText, visibilityText, windText, type ShipWeather } from '../../domain/weather'
import { alongFeed, positionFeed, seaFeed } from '../../feeds/navigation'
import { nauticalFeed } from '../../feeds/nautical'
import { skyNightFeed } from '../../feeds/skyNight'
import { weatherFeed } from '../../feeds/weather'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { useFeed } from '../../hooks/useServedFeeds'
import { t, th, type StringKey } from '../../i18n'
import { compassWord, portName, positionLine } from './navigationText'

const MINUTE = 60_000
const HOUR = 3_600_000

const SECTIONS = ['position', 'voyage', 'clocks', 'sea', 'air', 'light', 'vessel', 'plant', 'bridge', 'radar', 'around'] as const

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>
}

/** Nautical details: everything the ship knows about where it is, how it moves and the sea and sky around it, in one place. Each part comes from the server. */
export function NauticalScreen() {
  const [settings] = useSettings()
  const sailing = useSailing()
  const minute = Math.floor(useNow() / MINUTE) * MINUTE
  const day = useCurrentDay()
  const p = useFeed(positionFeed, sailing.id, minute)
  const s = useFeed(seaFeed, sailing.id, minute)
  const n = useFeed(nauticalFeed, sailing.id, minute)
  const a = useFeed(alongFeed, sailing.id, minute)
  const w = useFeed(weatherFeed, sailing.id, Math.floor(minute / HOUR) * HOUR)
  const sky = useFeed(skyNightFeed, sailing.id, day)
  const units = settings.units
  return (
    <div className="page">
      <p>{t('naut.intro')}</p>
      <nav aria-label={t('naut.jump')}>
        <ul className="naut-jump">
          {SECTIONS.map((id) => <li key={id}><a href={`#naut-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`naut-${id}`)?.scrollIntoView({ block: 'start' }); document.getElementById(`naut-${id}`)?.focus() }}>{t(`naut.${id}` as StringKey)}</a></li>)}
        </ul>
      </nav>
      {!p && !n && <FeedWaiting />}
      {p && n && <Position p={p} n={n} units={units} />}
      {p && n && <Voyage p={p} n={n} units={units} />}
      {p && (
        <section id="naut-clocks" tabIndex={-1} aria-labelledby="naut-clocks-h">
          <h2 id="naut-clocks-h">{th('naut.clocks')}</h2>
          <TimeCard clock={p.clock} />
          <Card><dl className="facts"><Row label={t('naut.utc')}>{utcTime(p.now)}</Row></dl></Card>
        </section>
      )}
      {s && n && <Sea s={s} n={n} units={units} />}
      {w && <Air w={w} units={units} />}
      {sky && <Light sky={sky} />}
      {n && <Vessel n={n} units={units} />}
      {n && <Plant n={n} />}
      {n && <Bridge n={n} />}
      {n && <Radar n={n} />}
      {a && n && <Around a={a} n={n} units={units} />}
      <p><Link to="/weather">{t('route.weatherAtSea')}</Link> · <Link to="/ship/where">{t('route.where')}</Link> · <Link to="/ship/sea">{t('route.sea')}</Link> · <Link to="/ship/along">{t('route.along')}</Link></p>
    </div>
  )
}

function Part({ id, title, children }: { id: (typeof SECTIONS)[number]; title: string; children: ReactNode }) {
  return (
    <section id={`naut-${id}`} tabIndex={-1} aria-labelledby={`naut-${id}-h`}>
      <h2 id={`naut-${id}-h`}>{th(title as StringKey)}</h2>
      {children}
    </section>
  )
}

function Position({ p, n, units }: { p: ShipPosition; n: Nautical; units: Units }) {
  const c = n.course
  const sog = speedParts(c.speedOverGroundKnots, units)
  const stw = speedParts(c.speedThroughWaterKnots, units)
  return (
    <Part id="position" title="naut.position">
      <Card hero labelledBy="naut-pos-line">
        <h3 id="naut-pos-line" className="nav-hero">{positionLine(p, units)}</h3>
        <Compass degreesTrue={c.headingTrue} />
        <dl className="facts">
          <Row label={t('naut.latitude')}>{degreesMinutes(p.lat)} {p.lat >= 0 ? t('nav.n') : t('nav.s')}</Row>
          <Row label={t('naut.longitude')}>{degreesMinutes(p.lon)} {p.lon >= 0 ? t('nav.e') : t('nav.w')}</Row>
          <Row label={t('naut.headingTrue')}>{headingText(c.headingTrue)} {compassWord(p.compass)}</Row>
          <Row label={t('naut.headingMagnetic')}>{headingText(c.headingMagnetic)}</Row>
          <Row label={t('naut.variation')}>{t(c.variationDegrees < 0 ? 'naut.variation.west' : 'naut.variation.east', { deg: Math.abs(c.variationDegrees).toFixed(1) })}</Row>
          <Row label={t('naut.cog')}>{headingText(c.courseOverGround)}</Row>
          <Row label={t('naut.sog')}>{p.speedKnots === 0 ? t('nav.speed.zero') : t('nav.speed.value', { knots: sog.knots, other: sog.other })}</Row>
          <Row label={t('naut.stw')}>{c.speedThroughWaterKnots === 0 ? t('nav.speed.zero') : t('nav.speed.value', { knots: stw.knots, other: stw.other })}</Row>
          <Row label={t('naut.rot')}>{Math.abs(c.rateOfTurnDegreesPerMinute) < 0.05 ? t('naut.rot.steady') : turnText(c.rateOfTurnDegreesPerMinute)}</Row>
          <Row label={t('naut.steering')}>{c.steering}</Row>
        </dl>
      </Card>
    </Part>
  )
}

function Voyage({ p, n, units }: { p: ShipPosition; n: Nautical; units: Units }) {
  const next = p.nextPort
  const np = n.nextPort
  return (
    <Part id="voyage" title="naut.voyage">
      {next && (
        <Card labelledBy="naut-leg">
          <h3 id="naut-leg" className="card__title">{th('nav.remaining', { port: portName(next) })}</h3>
          <progress className="meter" max={100} value={p.legPercent} aria-label={t('nav.progress', { port: portName(next), percent: p.legPercent })} />
          <dl className="facts">
            {!p.inPort && <Row label={t('nav.sailed', { port: portName(p.lastPort) })}>{t('nav.distance', { nm: distanceParts(p.nmSailed, units).nm, other: distanceParts(p.nmSailed, units).other })}</Row>}
            <Row label={t('nav.remaining', { port: portName(next) })}>{t('nav.distance', { nm: distanceParts(p.nmRemaining, units).nm, other: distanceParts(p.nmRemaining, units).other })}</Row>
            {np && <Row label={t('naut.straight')}>{t('naut.bearingDist', { bearing: headingText(np.bearingDegrees), nm: distanceParts(np.straightLineNm, units).nm })}</Row>}
            {p.arrival && <Row label={t('nav.eta', { port: portName(next) })}>{t('nav.eta.value', { day: p.arrival.day, time: p.arrival.shipTime })}</Row>}
            {np && <Row label={t('naut.pilot')}>{np.pilotShipTime && np.pilotDay ? t('nav.eta.value', { day: np.pilotDay, time: np.pilotShipTime }) : t('naut.pilot.tender')}</Row>}
          </dl>
        </Card>
      )}
      <Card labelledBy="naut-run">
        <h3 id="naut-run" className="card__title">{th('naut.run')}</h3>
        <dl className="facts">
          <Row label={t('naut.run24')}>{t('nav.distance', { nm: distanceParts(n.run.last24HoursNm, units).nm, other: distanceParts(n.run.last24HoursNm, units).other })}</Row>
          <Row label={t('naut.runAvg')}>{knotsText(n.run.last24HoursAverageKnots)}</Row>
          <Row label={t('nav.voyage')}>{t('nav.voyage.value', { done: distanceParts(p.voyageNmSailed, units).nm, total: distanceParts(p.voyageNmTotal, units).nm })}</Row>
          <Row label={t('naut.toGo')}>{t('nav.distance', { nm: distanceParts(n.run.toGoNm, units).nm, other: distanceParts(n.run.toGoNm, units).other })}</Row>
        </dl>
      </Card>
    </Part>
  )
}

function Sea({ s, n, units }: { s: SeaConditions; n: Nautical; units: Units }) {
  const c = n.course
  const tide = n.tide
  return (
    <Part id="sea" title="naut.sea">
      <Card hero labelledBy="naut-depth">
        <h3 id="naut-depth" className="card__title">{th('nav.depth.title')}</h3>
        <p className="nav-big">{depthText(s.depthM, units)}</p>
        <progress className="meter nav-gauge" max={100} value={depthGauge(s.depthM)} aria-label={t('nav.depth.gauge', { depth: depthText(s.depthM, units) })} />
        <p>{t(`nav.depth.${s.depthClass}` as StringKey)}</p>
        <dl className="facts">
          <Row label={t('naut.keel')}>{depthText(n.nearestLand.clearanceUnderKeelM, units)}</Row>
        </dl>
      </Card>
      <Card labelledBy="naut-surface">
        <h3 id="naut-surface" className="card__title">{th('nav.surface.title')}</h3>
        <dl className="facts">
          <Row label={t('nav.water')}>{waterTempText(s.waterTempC, units)}</Row>
          <Row label={t('nav.wind')}>{t('nav.wind.value', { force: s.beaufort, name: t(`nav.bf.${s.beaufort}` as StringKey), knots: s.windKnots, from: compassWord(s.windFrom) })}</Row>
          <Row label={t('nav.seastate')}>{t(`nav.ss.${s.seaState}` as StringKey)}</Row>
          <Row label={t('nav.wave')}>{waveText(s.waveM, units)}</Row>
          <Row label={t('nav.swell')}>{t('nav.swell.value', { height: waveText(s.swellM, units), seconds: s.swellPeriodSeconds, from: compassWord(s.swellFrom) })}</Row>
        </dl>
      </Card>
      <Card labelledBy="naut-current">
        <h3 id="naut-current" className="card__title">{th('naut.current')}</h3>
        <dl className="facts">
          <Row label={t('naut.current.name')}>{c.currentName}</Row>
          <Row label={t('naut.current.set')}>{t('naut.current.setValue', { heading: headingText(c.currentSetDegrees) })}</Row>
          <Row label={t('naut.current.drift')}>{knotsText(c.currentDriftKnots)}</Row>
        </dl>
        <h3 className="card__title">{th('naut.tide')}</h3>
        <dl className="facts">
          <Row label={t('naut.tide.state')}>{t(`naut.tide.${tide.state}` as StringKey)}</Row>
          <Row label={t('naut.tide.height')}>{waveText(tide.heightM, units)}</Row>
          <Row label={t('naut.tide.range')}>{t('naut.tide.rangeValue', { range: waveText(tide.rangeM, units), cycle: t(`naut.tide.cycle.${tide.cycle}` as StringKey) })}</Row>
          <Row label={t('naut.tide.high')}>{tide.nextHighShipTime}</Row>
          <Row label={t('naut.tide.low')}>{tide.nextLowShipTime}</Row>
        </dl>
        <p className="muted">{t('naut.tide.note')}</p>
      </Card>
    </Part>
  )
}

function Air({ w, units }: { w: ShipWeather; units: Units }) {
  const c = w.current
  return (
    <Part id="air" title="naut.air">
      <Card labelledBy="naut-air-card">
        <h3 id="naut-air-card" className="card__title">{t(`ship.wx.cond.${c.condition}` as StringKey)}, {tempText(c.tempC, units)}</h3>
        <dl className="facts">
          <Row label={t('ship.wx.wind')}>{t('ship.wx.wind.value', { speed: windText(c.windKnots, units), from: compassWord(c.windFrom), gust: windText(c.gustKnots, units) })}</Row>
          <Row label={t('ship.wx.pressure')}>{pressureText(c.pressureHpa, units)}</Row>
          <Row label={t('ship.wx.visibility')}>{visibilityText(c.visibilityKm, units)}</Row>
          <Row label={t('ship.wx.cloud')}>{c.cloudPercent}%</Row>
          <Row label={t('ship.wx.rain')}>{c.rainChancePercent}%</Row>
        </dl>
        <p><Link to="/weather">{t('naut.air.more')}</Link></p>
      </Card>
    </Part>
  )
}

function Light({ sky }: { sky: SkyNight }) {
  return (
    <Part id="light" title="nav.light.title">
      <Card>
        <dl className="facts">
          <Row label={t('nav.light.first')}>{sky.firstLight}</Row>
          <Row label={t('sky.sunrise')}>{sky.sunrise}</Row>
          <Row label={t('sky.sunset')}>{sky.sunset}</Row>
          <Row label={t('nav.light.last')}>{sky.lastLight}</Row>
          <Row label={t('nav.light.dark')}>{sky.darkAt}</Row>
          <Row label={t('sky.moon')}>{t('sky.moonLit', { phase: sky.moon.name, lit: sky.moon.lit })}</Row>
        </dl>
        <p className="muted">{t('nav.light.note')}</p>
        <p><Link to="/ship/sky">{t('nav.light.more')}</Link></p>
      </Card>
    </Part>
  )
}

function Vessel({ n, units }: { n: Nautical; units: Units }) {
  const v = n.vessel
  const sp = (k: number) => speedParts(k, units)
  return (
    <Part id="vessel" title="naut.vessel">
      <Card labelledBy="naut-vessel-card">
        <h3 id="naut-vessel-card" className="card__title">{v.name}</h3>
        <dl className="facts">
          <Row label={t('naut.vessel.class')}>{t('naut.vessel.classValue', { name: v.shipClass })}</Row>
          <Row label={t('naut.vessel.flag')}>{v.flag}</Row>
          <Row label={t('naut.vessel.registry')}>{v.portOfRegistry}</Row>
          <Row label={t('naut.vessel.built')}>{v.yearBuilt}</Row>
          <Row label={t('naut.vessel.gt')}>{tonnageText(v.grossTonnage)}</Row>
          <Row label={t('naut.vessel.length')}>{lengthText(v.lengthM, units)}</Row>
          <Row label={t('naut.vessel.beam')}>{lengthText(v.beamM, units)}</Row>
          <Row label={t('naut.vessel.draft')}>{lengthText(v.draftM, units)}</Row>
          <Row label={t('naut.vessel.air')}>{lengthText(v.airDraftM, units)}</Row>
          <Row label={t('naut.vessel.decks')}>{v.decks}</Row>
          <Row label={t('naut.vessel.service')}>{t('nav.speed.value', { knots: sp(v.serviceSpeedKnots).knots, other: sp(v.serviceSpeedKnots).other })}</Row>
          <Row label={t('naut.vessel.max')}>{t('nav.speed.value', { knots: sp(v.maxSpeedKnots).knots, other: sp(v.maxSpeedKnots).other })}</Row>
          <Row label={t('naut.vessel.propulsion')}>{v.propulsion}</Row>
        </dl>
      </Card>
    </Part>
  )
}

function Plant({ n }: { n: Nautical }) {
  const p = n.plant
  return (
    <Part id="plant" title="naut.plant">
      <Card>
        <dl className="facts">
          <Row label={t('naut.plant.gens')}>{t('naut.plant.gensValue', { on: p.generatorsOnline, total: p.generatorsTotal })}</Row>
          <Row label={t('naut.plant.power')}>{p.propulsionMw.toFixed(1)} MW</Row>
          <Row label={t('naut.plant.rpm')}>{p.shaftRpm}</Row>
          <Row label={t('naut.plant.fuel')}>{p.fuelTankPercent}%</Row>
          <Row label={t('naut.plant.burn')}>{p.fuelTonnesPerHour.toFixed(1)} t/h</Row>
          <Row label={t('naut.plant.stab')}>{t(p.stabilisersOut ? 'naut.plant.out' : 'naut.plant.in')}</Row>
          <Row label={t('naut.plant.roll')}>{p.rollDegrees.toFixed(1)}°</Row>
          <Row label={t('naut.plant.pitch')}>{p.pitchDegrees.toFixed(1)}°</Row>
          <Row label={t('naut.plant.thrusters')}>{t(p.bowThrusters === 'standby' ? 'naut.plant.standby' : 'naut.plant.off')}</Row>
        </dl>
      </Card>
    </Part>
  )
}

function Bridge({ n }: { n: Nautical }) {
  const w = n.watch
  return (
    <Part id="bridge" title="naut.bridge">
      <Card>
        <dl className="facts">
          <Row label={t('naut.bridge.watch')}>{t('naut.bridge.watchValue', { name: t(`naut.watch.${w.name}` as StringKey), from: w.from, to: w.to })}</Row>
          <Row label={t('naut.bridge.officers')}>{w.bridgeOfficers}</Row>
          <Row label={t('naut.bridge.lookouts')}>{w.lookouts}</Row>
          <Row label={t('naut.bridge.radar')}>{t('naut.bridge.radarValue', { nm: w.radarRangeNm })}</Row>
          <Row label={t('naut.bridge.lights')}>{t(w.navigationLightsOn ? 'naut.bridge.lightsOn' : 'naut.bridge.lightsOff')}</Row>
        </dl>
      </Card>
    </Part>
  )
}

function Radar({ n }: { n: Nautical }) {
  return (
    <Part id="radar" title="naut.radar">
      {n.traffic.length === 0 ? <p className="muted">{t('naut.radar.none')}</p> : (
        <>
          <p className="muted">{t('naut.radar.count', { count: n.traffic.length })}</p>
          <ul className="nav-landmarks">
            {n.traffic.map((v, i) => (
              <li key={`${v.kind}-${i}`}>
                <h4>{t(`naut.kind.${v.kind}` as StringKey)}{v.alert && <> <strong>{t('naut.radar.alert')}</strong></>}</h4>
                <p>{t('naut.radar.line', { bearing: headingText(v.bearingDegrees), nm: v.distanceNm.toFixed(1) })}</p>
                <p className="muted">{t('naut.radar.course', { course: headingText(v.courseDegrees), knots: v.speedKnots })}</p>
                <p className="muted">{t('naut.radar.cpa', { nm: v.closestApproachNm.toFixed(1), minutes: v.minutesToClosest })}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted">{t('naut.radar.note')}</p>
    </Part>
  )
}

function Around({ a, n, units }: { a: AlongTheWay; n: Nautical; units: Units }) {
  const l = n.nearestLand
  return (
    <Part id="around" title="naut.around">
      <Card labelledBy="naut-land">
        <h3 id="naut-land" className="card__title">{th('naut.land')}</h3>
        <p>{t('naut.land.value', { name: l.name, nm: distanceParts(l.distanceNm, units).nm, bearing: headingText(l.bearingDegrees), compass: compassWord(l.compass) })}</p>
      </Card>
      <Card labelledBy="naut-zone">
        <h3 id="naut-zone" className="card__title">{a.zone.name}</h3>
        <p>{a.zone.habitat}</p>
        <ul className="plain-list">{a.zone.wildlife.map((x) => <li key={x}>{t(`sight.${x}` as StringKey)}</li>)}</ul>
      </Card>
      {a.passing.length > 0 && <><h3>{th('nav.passing')}</h3><LandmarkList id="nav-passing" items={a.passing} /></>}
      {a.ahead.length > 0 && <><h3>{th('nav.ahead')}</h3><LandmarkList id="nav-ahead" items={a.ahead} /></>}
      {a.behind.length > 0 && <><h3>{th('nav.behind')}</h3><LandmarkList id="nav-behind" items={a.behind} /></>}
    </Part>
  )
}

