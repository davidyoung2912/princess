import { useState } from 'react'
import { Link } from 'react-router'
import { placeById } from '../../domain/deck'
import { goodTime, lineReading, LINES, NO_QUIET_FILTER, pulseAt, PULSE_VENUES, quietSpaces, type PulseEnv } from '../../domain/pulse'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useNow, useSailing } from '../../hooks/useDemo'
import { usePulseEnv } from '../../hooks/useServedFeeds'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { BackLink } from '../onboard/common'
import { duration, useShipTime } from './shipTime'

/** Ship Pulse (S6-01), quiet spaces (S6-04) and standby lines (S6-05). Every reading is a simulation and shows how old it is and how sure it is. */
export function PulseScreen() {
  const sailing = useSailing()
  const { env, now } = usePulseEnv(sailing, useNow(), useCurrentDay())
  if (!env) {
    return (
      <div className="page">
        <h1>{t('route.pulse')}</h1>
        <FeedWaiting />
        <BackLink to="/ship" label={t('route.ship')} />
      </div>
    )
  }
  return <PulseBody env={env} now={now} />
}

function PulseBody({ env, now }: { env: PulseEnv; now: number }) {
  const time = useShipTime()
  const [filter, setFilter] = useState(NO_QUIET_FILTER)
  const spaces = quietSpaces(now, env, filter)

  return (
    <div className="page">
      <h1>{t('route.pulse')}</h1>
      <p>{t('pulse.intro')}</p>
      <Banner kind="info" title={t('pulse.honest')}><p>{t('pulse.honestBody')}</p></Banner>

      <Card labelledBy="pulse-h">
        <h2 id="pulse-h" className="card__title">{t('pulse.venues')}</h2>
        <ul className="plain-list">
          {PULSE_VENUES.map((v) => {
            const p = pulseAt(v.id, now, env)
            const g = goodTime(v.id, now, env)
            return (
              <li key={v.id}>
                <strong>{placeById(v.id)?.name}</strong>: {t(`pulse.label.${p.label}` as StringKey)} <span className="pulse-bar" aria-hidden="true"><span style={{ width: `${p.level}%` }} /></span>
                <span className="plan-row__note">{t('pulse.age', { count: p.ageMinutes })} · {t(`pulse.confidence.${p.confidence}` as StringKey)} · {t('pulse.sim')}</span>
                <span className="plan-row__note">{g.now ? t('pulse.goNow') : t('pulse.goAt', { time: time(g.at) })}</span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card labelledBy="lines-h">
        <h2 id="lines-h" className="card__title">{t('lines.title')}</h2>
        <ul className="plain-list">
          {LINES.map((l) => {
            const r = lineReading(l.kind, now, env)
            return (
              <li key={l.kind}>
                <strong>{t(`lines.${l.kind}` as StringKey)}</strong>: {r.waitMinutes < 1 ? t('lines.none') : t('lines.wait', { time: duration(r.waitMinutes) })}
                <span className="plan-row__note">{r.shortest.waitMinutes < r.waitMinutes ? t('lines.shorter', { time: time(r.shortest.at), wait: duration(r.shortest.waitMinutes) }) : t('lines.already')} · {t('pulse.age', { count: r.pulse.ageMinutes })} · {t('pulse.sim')}</span>
                <span className="plan-row__note">{r.virtual ? <Link to={r.path}>{t('lines.virtual')}</Link> : t('lines.noVirtual')}</span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card labelledBy="quiet-h">
        <h2 id="quiet-h" className="card__title">{t('quiet.title')}</h2>
        <fieldset>
          <legend>{t('quiet.filter')}</legend>
          {(['stepFree', 'shade', 'seating'] as const).map((k) => (
            <label key={k} className="choice"><input type="checkbox" checked={filter[k]} onChange={(e) => setFilter({ ...filter, [k]: e.target.checked })} /><span>{t(`quiet.filter.${k}` as StringKey)}</span></label>
          ))}
        </fieldset>
        <ul className="plain-list">
          {spaces.map((q) => (
            <li key={q.id}>
              <strong>{q.name}</strong> · {t('quiet.deck', { deck: q.deck })} · {q.openNow ? t('quiet.open') : t('quiet.closed')}
              <span className="plan-row__note">{t(`quiet.noise.${q.noise}` as StringKey)} · {t(`pulse.label.${q.label}` as StringKey)} · {q.shade ? t('quiet.shade') : t('quiet.sun')} · {q.stepFree ? t('quiet.stepFree') : t('quiet.steps')}</span>
            </li>
          ))}
        </ul>
        {spaces.length === 0 && <p>{t('quiet.none')}</p>}
        <p className="muted"><Link to="/ship/map">{t('quiet.map')}</Link></p>
      </Card>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}
