import { useState } from 'react'
import { itinerary, PORTS } from '../../domain/sailings'
import { bestSpot } from '../../domain/sky'
import { sailAwayViews } from '../../domain/sailAwayViews'
import { Link } from 'react-router'
import { Chip } from '../Chip'
import { skyNightFeed } from '../../feeds/skyNight'
import { useFeed } from '../../hooks/useServedFeeds'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useSailing } from '../../hooks/useDemo'
import { t, th } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { BackLink } from '../onboard/common'

/** Sun, moon and stars guide (S6-07): sunrise and sunset by the ship's clock, the moon, constellations that are easy to find, and where to watch. Worked out from the date and route (a simulation). */
export function SkyScreen() {
  const sailing = useSailing()
  const current = useCurrentDay()
  const [day, setDay] = useState(current)
  const [stepFree, setStepFree] = useState(false)
  const n = useFeed(skyNightFeed, sailing.id, day)
  const days = itinerary(sailing)
  return (
    <div className="page">
      <BackLink to="/ship" label={t('route.ship')} />
      <p>{t('sky.intro')}</p>
      <Banner kind="info" title={t('sky.sim')} />
      <div className="field">
        <label htmlFor="sky-day">{t('sky.day')}</label>
        <select id="sky-day" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {days.map((d) => <option key={d.day} value={d.day}>{`${d.day} · ${d.port === 'sea' ? 'At sea' : PORTS[d.port].name}`}</option>)}
        </select>
      </div>
      {!n && <FeedWaiting />}
      {n && <>
      <Card labelledBy="sky-times">
        <h2 id="sky-times" className="card__title">{n.sunset}</h2>
        <dl className="facts">
          <div><dt>{t('sky.sunrise')}</dt><dd>{n.sunrise}</dd></div>
          <div><dt>{t('sky.sunset')}</dt><dd>{n.sunset}</dd></div>
          <div><dt>{t('sky.moon')}</dt><dd>{t('sky.moonLit', { phase: n.moon.name, lit: n.moon.lit })}</dd></div>
        </dl>
        {n.sailAway && <p>{t(n.sailAwayAtSunset ? 'sky.sailAway' : 'sky.sailAwayPlain', { time: n.sailAway })}</p>}
      </Card>
      <Card labelledBy="sky-where">
        <h2 id="sky-where" className="card__title">{th('sky.where')}</h2>
        <p>{bestSpot(n)}</p>
        <h3>{th('sky.stars')}</h3>
        <ul className="plain-list">{n.stars.map((s) => <li key={s}>{s}</li>)}</ul>
      </Card>
      </>}
      <Card labelledBy="sky-views">
        <h2 id="sky-views" className="card__title">{th('sky.views')}</h2>
        <div className="chip-row"><Chip pressed={stepFree} onToggle={() => setStepFree(!stepFree)}>{t('rt.stepFree')}</Chip></div>
        <ul className="plain-list">
          {sailAwayViews({ stepFreeOnly: stepFree }).map((p) => <li key={p.id}>{t('sky.viewItem', { name: p.name, deck: p.deck })}{p.stepFree ? '' : ` (${t('onb.notStepFree')})`}{p.note ? <small className="muted"><br />{p.note}</small> : null}</li>)}
        </ul>
        <p className="muted">{t('sky.viewsNote')} <Link to="/ship/map">{t('sky.viewsRoute')}</Link></p>
      </Card>
    </div>
  )
}
